import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { nextNumber } from "./numbering";

export interface MailSyncResult {
  ok: boolean;
  message: string;
  imported: number;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const FIRST_SYNC_DAYS = 30;

function firstAddress(a: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(a) ? a : a ? [a] : [];
  const first = list[0]?.value?.[0];
  return { name: first?.name ?? "", address: (first?.address ?? "").toLowerCase() };
}

function extractPhone(text: string) {
  const m = text.match(/(?:\+420\s?)?(?:\d{3}\s?){3}(?!\d)/);
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

/** Stores a parsed e-mail as a new inquiry. Returns null when it already exists. */
export async function importParsedMail(parsed: ParsedMail, fallbackId: string) {
  const messageId = (parsed.messageId ?? "").trim() || fallbackId;
  const existing = await prisma.inquiry.findUnique({ where: { messageId }, select: { id: true } });
  if (existing) return null;
  const from = firstAddress(parsed.from);
  const settings = await getSettings();
  const receivedAt = parsed.date ?? new Date();
  const bodyText = (parsed.text ?? "").trim();
  const attachments = (parsed.attachments ?? []).filter((a) => a.content && a.content.length <= MAX_ATTACHMENT_BYTES);
  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, "INQUIRY", settings.inquiryNumberFormat, receivedAt);
    return tx.inquiry.create({
      data: {
        number,
        source: "EMAIL",
        fromName: from.name,
        fromEmail: from.address,
        fromPhone: extractPhone(bodyText),
        subject: (parsed.subject ?? "").trim() || "(bez předmětu)",
        bodyText,
        bodyHtml: typeof parsed.html === "string" ? parsed.html : "",
        receivedAt,
        messageId,
        attachments: {
          create: attachments.map((a) => ({
            filename: a.filename || "priloha",
            contentType: a.contentType || "application/octet-stream",
            size: a.size ?? a.content.length,
            data: new Uint8Array(a.content),
          })),
        },
      },
    });
  });
}

/** Connects to the configured IMAP mailbox and imports new messages as inquiries. */
export async function syncMail(): Promise<MailSyncResult> {
  const settings = await getSettings();
  if (!settings.imapHost || !settings.imapUser) {
    return { ok: false, message: "Není nastavena e-mailová schránka pro poptávky (Nastavení → Poptávky).", imported: 0 };
  }
  const client = new ImapFlow({
    host: settings.imapHost,
    port: settings.imapPort,
    secure: settings.imapSecure,
    auth: { user: settings.imapUser, pass: settings.imapPassword },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 60000,
  });
  let imported = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(settings.imapFolder || "INBOX");
    try {
      const since = settings.imapLastSyncAt
        ? new Date(settings.imapLastSyncAt.getTime() - 2 * 86400000)
        : new Date(Date.now() - FIRST_SYNC_DAYS * 86400000);
      const uids = (await client.search({ since }, { uid: true })) || [];
      const mailbox = typeof client.mailbox === "object" ? client.mailbox : null;
      const uidValidity = mailbox?.uidValidity?.toString() ?? "0";
      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const created = await importParsedMail(parsed, `imap-${uidValidity}-${uid}@${settings.imapHost}`);
        if (created) imported++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await prisma.companySettings.update({ where: { id: "default" }, data: { imapLastSyncAt: new Date() } });
    const message = `Staženo ${imported} nových poptávek.`;
    await prisma.syncLog.create({ data: { kind: "MAIL", ok: true, message, imported } });
    return { ok: true, message, imported };
  } catch (e) {
    try {
      client.close();
    } catch {
      /* ignore */
    }
    const raw = e instanceof Error ? e.message : String(e);
    const message = /auth/i.test(raw) ? "Přihlášení do schránky se nezdařilo – zkontrolujte uživatele a heslo." : `Chyba spojení se schránkou: ${raw}`;
    await prisma.syncLog.create({ data: { kind: "MAIL", ok: false, message, imported } });
    return { ok: false, message, imported };
  }
}
