/** Computes a Czech IBAN from account number ("prefix-number" or "number") and bank code. */
export function czechIban(account: string, bankCode: string): string {
  const acc = account.replace(/\s/g, "");
  const code = bankCode.replace(/\s/g, "");
  if (!acc || !/^\d{4}$/.test(code)) return "";
  const [a, b] = acc.includes("-") ? acc.split("-") : ["", acc];
  if (!/^\d{0,6}$/.test(a) || !/^\d{1,10}$/.test(b)) return "";
  const bban = code + a.padStart(6, "0") + b.padStart(10, "0");
  // checksum: move "CZ00" to end, convert letters (C=12, Z=35), mod 97
  const numeric = bban + "12" + "35" + "00";
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  const check = String(98 - rem).padStart(2, "0");
  return `CZ${check}${bban}`;
}

/** Short Payment Descriptor (QR platba) string. */
export function spaydString(opts: { iban: string; amount: string; currency: string; vs?: string; ks?: string; message?: string; bic?: string }) {
  const parts = ["SPD*1.0", `ACC:${opts.iban}${opts.bic ? "+" + opts.bic : ""}`, `AM:${opts.amount}`, `CC:${opts.currency}`];
  if (opts.vs) parts.push(`X-VS:${opts.vs}`);
  if (opts.ks) parts.push(`X-KS:${opts.ks}`);
  if (opts.message) parts.push(`MSG:${opts.message.replace(/[*]/g, " ").slice(0, 60)}`);
  return parts.join("*");
}
