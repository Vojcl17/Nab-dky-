import "server-only";
import { prisma } from "./db";
import { parseDateInput } from "./format";

/**
 * Returns the ČNB exchange rate (CZK per 1 unit of currency) valid for the given day.
 * ČNB publishes rates on working days after 14:30; for other days the last published rate is used.
 */
export async function getCnbRate(currency: string, dateStr: string): Promise<{ rate: number; date: string } | null> {
  if (currency === "CZK") return { rate: 1, date: dateStr };
  const date = parseDateInput(dateStr);
  const cached = await prisma.exchangeRate.findUnique({ where: { currency_date: { currency, date } } });
  if (cached) return { rate: Number(cached.rate) / cached.amount, date: dateStr };

  const [y, m, d] = dateStr.split("-");
  const url = `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=${d}.${m}.${y}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ČNB odpověděla chybou ${res.status}.`);
  const text = await res.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // line 0: "08.09.2026 #173", line 1: header, rest: země|měna|množství|kód|kurz
  for (const line of lines.slice(2)) {
    const parts = line.split("|");
    if (parts.length < 5) continue;
    const [, , amountStr, code, rateStr] = parts;
    if (code !== currency) continue;
    const amount = Number(amountStr);
    const rate = Number(rateStr.replace(",", "."));
    if (!amount || !rate) continue;
    await prisma.exchangeRate.upsert({
      where: { currency_date: { currency, date } },
      create: { currency, date, rate, amount },
      update: { rate, amount },
    });
    return { rate: rate / amount, date: dateStr };
  }
  return null;
}
