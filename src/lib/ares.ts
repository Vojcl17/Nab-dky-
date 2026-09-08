import "server-only";

export interface AresSubject {
  ico: string;
  dic: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
}

interface AresResponse {
  ico?: string;
  dic?: string;
  obchodniJmeno?: string;
  sidlo?: {
    nazevUlice?: string;
    cisloDomovni?: number;
    cisloOrientacni?: number;
    cisloOrientacniPismeno?: string;
    nazevObce?: string;
    nazevCastiObce?: string;
    nazevMestskeCastiObvodu?: string;
    psc?: number;
    kodStatu?: string;
    textovaAdresa?: string;
  };
}

/** Looks up a company in ARES (Czech company register) by IČO. */
export async function lookupAres(icoRaw: string): Promise<AresSubject | null> {
  const ico = icoRaw.replace(/\s/g, "").padStart(8, "0");
  if (!/^\d{8}$/.test(ico)) throw new Error("IČO musí mít 8 číslic.");
  const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ARES odpověděl chybou ${res.status}.`);
  const data = (await res.json()) as AresResponse;
  const s = data.sidlo ?? {};
  let street = s.nazevUlice ?? "";
  if (!street) street = s.nazevCastiObce ?? s.nazevObce ?? "";
  const numbers = [s.cisloDomovni, s.cisloOrientacni ? `${s.cisloOrientacni}${s.cisloOrientacniPismeno ?? ""}` : undefined]
    .filter(Boolean)
    .join("/");
  if (numbers) street = `${street} ${numbers}`.trim();
  return {
    ico: data.ico ?? ico,
    dic: data.dic ?? "",
    name: data.obchodniJmeno ?? "",
    street,
    city: s.nazevObce ?? "",
    zip: s.psc ? String(s.psc) : "",
    country: s.kodStatu ?? "CZ",
  };
}
