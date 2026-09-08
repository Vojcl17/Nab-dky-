import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { recalcInvoicePayments } from "./invoices";
import { computeTotals, dec } from "./totals";
import { getSettings } from "./settings";

interface FioColumn<T> {
  value: T;
  name: string;
  id: number;
}

interface FioTransaction {
  column0?: FioColumn<string> | null; // date "2026-09-08+0200"
  column1?: FioColumn<number> | null; // amount
  column2?: FioColumn<string> | null; // counter account
  column3?: FioColumn<string> | null; // bank code
  column4?: FioColumn<string> | null; // KS
  column5?: FioColumn<string> | null; // VS
  column6?: FioColumn<string> | null; // SS
  column7?: FioColumn<string> | null; // user identification
  column8?: FioColumn<string> | null; // type
  column10?: FioColumn<string> | null; // counter account name
  column12?: FioColumn<string> | null; // bank name
  column14?: FioColumn<string> | null; // currency
  column16?: FioColumn<string> | null; // message for recipient
  column22?: FioColumn<number> | null; // transaction id
  column25?: FioColumn<string> | null; // comment
}

interface FioResponse {
  accountStatement: {
    info: { accountId: string; bankId: string; currency: string; iban: string; closingBalance: number };
    transactionList: { transaction: FioTransaction[] };
  };
}

export interface FioSyncResult {
  ok: boolean;
  message: string;
  imported: number;
  matched: number;
}

function parseFioDate(s: string | undefined | null): Date {
  const d = (s ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00.000Z`) : new Date();
}

async function fetchFio(url: string) {
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (res.status === 409) throw new Error("Fio API: příliš časté dotazy, zkuste to za 30 sekund.");
  if (res.status === 500 || res.status === 404) throw new Error("Fio API: neplatný token nebo chybný požadavek.");
  if (!res.ok) throw new Error(`Fio API odpovědělo chybou ${res.status}.`);
  return res;
}

/**
 * Downloads new transactions from Fio (using the "last" pointer maintained by Fio) and matches
 * incoming payments to invoices by variable symbol.
 */
export async function syncFio(options: { from?: string; to?: string } = {}): Promise<FioSyncResult> {
  const settings = await getSettings();
  const token = settings.fioToken.trim();
  if (!token) return { ok: false, message: "Není nastaven Fio API token (Nastavení → Banka).", imported: 0, matched: 0 };

  const url =
    options.from && options.to
      ? `https://fioapi.fio.cz/v1/rest/periods/${token}/${options.from}/${options.to}/transactions.json`
      : `https://fioapi.fio.cz/v1/rest/last/${token}/transactions.json`;

  let imported = 0;
  let matched = 0;
  try {
    const res = await fetchFio(url);
    const data = (await res.json()) as FioResponse;
    const list = data.accountStatement?.transactionList?.transaction ?? [];
    for (const t of list) {
      const fioId = t.column22?.value;
      if (fioId == null) continue;
      const existing = await prisma.bankTransaction.findUnique({ where: { fioId: BigInt(fioId) } });
      if (existing) continue;
      const tx = await prisma.bankTransaction.create({
        data: {
          fioId: BigInt(fioId),
          date: parseFioDate(t.column0?.value),
          amount: String(t.column1?.value ?? 0),
          currency: t.column14?.value ?? data.accountStatement.info.currency ?? "CZK",
          counterAccount: t.column2?.value ?? "",
          counterBankCode: t.column3?.value ?? "",
          counterName: t.column10?.value ?? "",
          variableSymbol: (t.column5?.value ?? "").replace(/^0+/, ""),
          constantSymbol: t.column4?.value ?? "",
          specificSymbol: t.column6?.value ?? "",
          message: t.column16?.value ?? "",
          comment: t.column25?.value ?? "",
          type: t.column8?.value ?? "",
        },
      });
      imported++;
      if (await matchTransaction(tx.id)) matched++;
    }
    await prisma.companySettings.update({ where: { id: "default" }, data: { fioLastSyncAt: new Date() } });
    const message = `Staženo ${imported} nových pohybů, spárováno ${matched}.`;
    await prisma.fioSyncLog.create({ data: { ok: true, message, imported, matched } });
    return { ok: true, message, imported, matched };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neznámá chyba";
    await prisma.fioSyncLog.create({ data: { ok: false, message, imported, matched } });
    return { ok: false, message, imported, matched };
  }
}

/** Sets Fio's "last download" pointer so that the next sync starts from the given date. */
export async function setFioPointer(dateStr: string) {
  const settings = await getSettings();
  const token = settings.fioToken.trim();
  if (!token) throw new Error("Není nastaven Fio API token.");
  await fetchFio(`https://fioapi.fio.cz/v1/rest/set-last-date/${token}/${dateStr}/`);
}

/** Tries to match an incoming transaction to an open invoice by VS + currency. Returns true when matched. */
export async function matchTransaction(transactionId: string, forcedInvoiceId?: string): Promise<boolean> {
  const tx = await prisma.bankTransaction.findUnique({ where: { id: transactionId }, include: { payment: true } });
  if (!tx || tx.payment) return false;
  const amount = dec(tx.amount);
  if (amount.lte(0) && !forcedInvoiceId) return false;

  let invoice: Prisma.InvoiceGetPayload<{ include: { items: true } }> | null = null;
  if (forcedInvoiceId) {
    invoice = await prisma.invoice.findUnique({ where: { id: forcedInvoiceId }, include: { items: true } });
  } else {
    const vs = tx.variableSymbol.replace(/^0+/, "");
    if (!vs) return false;
    const candidates = await prisma.invoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        type: { in: ["INVOICE", "ADVANCE"] },
        currency: tx.currency as "CZK" | "EUR",
        OR: [{ variableSymbol: vs }, { variableSymbol: vs.padStart(10, "0") }],
      },
      include: { items: true },
      orderBy: { issueDate: "asc" },
    });
    if (candidates.length === 0) return false;
    // prefer an invoice whose remaining amount equals the payment
    invoice =
      candidates.find((c) => {
        const t = computeTotals({ items: c.items, discountType: c.discountType, discountValue: c.discountValue, roundTotal: c.roundTotal });
        return t.payable.minus(dec(c.paidAmount)).minus(amount).abs().lt(0.01);
      }) ?? candidates[0];
  }
  if (!invoice) return false;
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return false;

  await prisma.$transaction(async (t) => {
    await t.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: amount.toFixed(2),
        currency: invoice.currency,
        date: tx.date,
        note: [tx.counterName, tx.message].filter(Boolean).join(" · ").slice(0, 200),
        bankTransactionId: tx.id,
      },
    });
    await recalcInvoicePayments(t, invoice.id);
  });
  return true;
}
