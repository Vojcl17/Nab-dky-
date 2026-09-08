import type { Prisma, SequenceKind } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Formats: {YYYY} year, {YY} short year, {MM} month, {NNNN} counter padded to the number of N's.
 * The counter resets each year.
 */
export async function nextNumber(tx: Tx, kind: SequenceKind, format: string, date: Date): Promise<string> {
  const year = date.getUTCFullYear();
  const seq = await tx.numberSequence.upsert({
    where: { kind_year: { kind, year } },
    create: { kind, year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return renderNumber(format, date, seq.last);
}

export function renderNumber(format: string, date: Date, counter: number) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return format
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{YY\}/g, String(year).slice(-2))
    .replace(/\{MM\}/g, month)
    .replace(/\{(N+)\}/g, (_m, ns: string) => String(counter).padStart(ns.length, "0"));
}

export function variableSymbolFromNumber(number: string) {
  return number.replace(/\D/g, "").slice(0, 10);
}
