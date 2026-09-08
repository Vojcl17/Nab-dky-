import Decimal from "decimal.js";

export type DiscountType = "NONE" | "PERCENT" | "AMOUNT";

export type DecimalLike = Decimal.Value | { toString(): string };

export interface LineInput {
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  vatRate: number;
  discountPercent?: DecimalLike | null;
  /** Line is excluded from the document-level discount. */
  noDiscount?: boolean;
}

export interface DocumentInput {
  items: LineInput[];
  discountType: DiscountType;
  discountValue: DecimalLike;
  /** Round the payable total to whole units (CZK). */
  roundTotal?: boolean;
  /** When false, VAT is not applied at all (non-VAT payer). */
  vatApplicable?: boolean;
}

export interface LineTotals {
  /** quantity * unitPrice */
  gross: Decimal;
  /** after line discount, before document discount */
  base: Decimal;
  /** after line and document discounts */
  netBase: Decimal;
  vat: Decimal;
  total: Decimal;
  vatRate: number;
  discountPercent: Decimal;
}

export interface VatGroup {
  rate: number;
  base: Decimal;
  vat: Decimal;
  total: Decimal;
}

export interface DocumentTotals {
  lines: LineTotals[];
  /** sum of line bases before document discount */
  subtotal: Decimal;
  discountAmount: Decimal;
  base: Decimal;
  vat: Decimal;
  total: Decimal;
  rounding: Decimal;
  payable: Decimal;
  vatGroups: VatGroup[];
}

export function dec(v: DecimalLike | null | undefined): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  if (v instanceof Decimal) return v;
  if (typeof v === "number" || typeof v === "string") {
    const n = new Decimal(typeof v === "string" ? v.replace(",", ".").trim() || "0" : v);
    return n.isNaN() ? new Decimal(0) : n;
  }
  return new Decimal(v.toString());
}

const r2 = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function computeTotals(doc: DocumentInput): DocumentTotals {
  const vatApplicable = doc.vatApplicable ?? true;
  const partial = doc.items.map((it) => {
    const qty = dec(it.quantity);
    const price = dec(it.unitPrice);
    const disc = dec(it.discountPercent);
    const gross = r2(qty.mul(price));
    const base = r2(gross.mul(new Decimal(100).minus(disc)).div(100));
    return { gross, base, vatRate: vatApplicable ? it.vatRate : 0, discountPercent: disc, noDiscount: !!it.noDiscount };
  });

  const subtotal = partial.reduce((s, l) => s.plus(l.base), new Decimal(0));
  /** base of lines eligible for the document discount */
  const discountable = partial.reduce((s, l) => (l.noDiscount ? s : s.plus(l.base)), new Decimal(0));

  // document discount
  let discountAmount = new Decimal(0);
  if (doc.discountType === "PERCENT") {
    const p = dec(doc.discountValue);
    discountAmount = r2(discountable.mul(p).div(100));
  } else if (doc.discountType === "AMOUNT") {
    discountAmount = r2(dec(doc.discountValue));
    if (discountAmount.gt(discountable)) discountAmount = discountable;
  }
  if (discountAmount.lt(0)) discountAmount = new Decimal(0);

  // distribute document discount proportionally to line bases; residual goes to the largest line
  const netBases: Decimal[] = partial.map(() => new Decimal(0));
  if (discountAmount.gt(0) && discountable.gt(0)) {
    let allocated = new Decimal(0);
    partial.forEach((l, i) => {
      if (l.noDiscount) {
        netBases[i] = l.base;
        return;
      }
      const share = r2(discountAmount.mul(l.base).div(discountable));
      netBases[i] = l.base.minus(share);
      allocated = allocated.plus(share);
    });
    const residual = discountAmount.minus(allocated);
    if (!residual.isZero()) {
      let idx = -1;
      partial.forEach((l, i) => {
        if (!l.noDiscount && (idx < 0 || l.base.abs().gt(partial[idx].base.abs()))) idx = i;
      });
      if (idx >= 0) netBases[idx] = netBases[idx].minus(residual);
    }
  } else {
    partial.forEach((l, i) => (netBases[i] = l.base));
  }

  // VAT per group computed from the summed base of the group (Czech practice)
  const groupMap = new Map<number, VatGroup>();
  partial.forEach((l, i) => {
    const g = groupMap.get(l.vatRate) ?? { rate: l.vatRate, base: new Decimal(0), vat: new Decimal(0), total: new Decimal(0) };
    g.base = g.base.plus(netBases[i]);
    groupMap.set(l.vatRate, g);
  });
  const vatGroups = [...groupMap.values()]
    .sort((a, b) => b.rate - a.rate)
    .map((g) => {
      const vat = r2(g.base.mul(g.rate).div(100));
      return { ...g, vat, total: g.base.plus(vat) };
    });

  const lines: LineTotals[] = partial.map((l, i) => {
    const vat = r2(netBases[i].mul(l.vatRate).div(100));
    return {
      gross: l.gross,
      base: l.base,
      netBase: netBases[i],
      vat,
      total: netBases[i].plus(vat),
      vatRate: l.vatRate,
      discountPercent: l.discountPercent,
    };
  });

  const base = vatGroups.reduce((s, g) => s.plus(g.base), new Decimal(0));
  const vat = vatGroups.reduce((s, g) => s.plus(g.vat), new Decimal(0));
  const total = base.plus(vat);
  let rounding = new Decimal(0);
  let payable = total;
  if (doc.roundTotal) {
    payable = total.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    rounding = payable.minus(total);
  }

  return { lines, subtotal, discountAmount, base, vat, total, rounding, payable, vatGroups };
}

/** Serializable version (numbers) for client components. */
export function totalsToNumbers(t: DocumentTotals) {
  return {
    subtotal: t.subtotal.toNumber(),
    discountAmount: t.discountAmount.toNumber(),
    base: t.base.toNumber(),
    vat: t.vat.toNumber(),
    total: t.total.toNumber(),
    rounding: t.rounding.toNumber(),
    payable: t.payable.toNumber(),
    vatGroups: t.vatGroups.map((g) => ({ rate: g.rate, base: g.base.toNumber(), vat: g.vat.toNumber(), total: g.total.toNumber() })),
    lines: t.lines.map((l) => ({ base: l.base.toNumber(), netBase: l.netBase.toNumber(), vat: l.vat.toNumber(), total: l.total.toNumber() })),
  };
}
