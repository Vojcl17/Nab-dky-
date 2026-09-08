import { computeTotals, type DocumentTotals } from "@/lib/totals";
import { formatMoney, formatQuantity } from "@/lib/format";

interface ItemRow {
  id: string;
  name: string;
  description: string;
  quantity: { toString(): string };
  unit: string;
  unitPrice: { toString(): string };
  vatRate: number;
  discountPercent: { toString(): string };
}

export function DocumentItems({
  items,
  totals,
  currency,
  vatApplicable = true,
}: {
  items: ItemRow[];
  totals: DocumentTotals;
  currency: string;
  vatApplicable?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>Položka</th>
            <th className="text-right">Množství</th>
            <th className="text-right">Cena/MJ</th>
            {vatApplicable && <th className="text-right">DPH</th>}
            <th className="text-right">Sleva</th>
            <th className="text-right">Bez DPH</th>
            {vatApplicable && <th className="text-right">S DPH</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const l = totals.lines[i];
            return (
              <tr key={it.id}>
                <td className="text-xs text-slate-400">{i + 1}.</td>
                <td>
                  <div className="font-medium">{it.name}</div>
                  {it.description && <div className="text-xs text-slate-500">{it.description}</div>}
                </td>
                <td className="whitespace-nowrap text-right">
                  {formatQuantity(it.quantity)} {it.unit}
                </td>
                <td className="whitespace-nowrap text-right">{formatMoney(it.unitPrice, currency)}</td>
                {vatApplicable && <td className="text-right">{it.vatRate} %</td>}
                <td className="text-right">{Number(it.discountPercent) ? `${formatQuantity(it.discountPercent)} %` : "—"}</td>
                <td className="whitespace-nowrap text-right">{formatMoney(l.base.toNumber(), currency)}</td>
                {vatApplicable && <td className="whitespace-nowrap text-right">{formatMoney(l.base.mul(100 + l.vatRate).div(100).toNumber(), currency)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TotalsSummary({
  totals,
  currency,
  vatApplicable = true,
  exchangeRate,
  paidAmount,
}: {
  totals: DocumentTotals;
  currency: string;
  vatApplicable?: boolean;
  exchangeRate?: { toString(): string } | number;
  paidAmount?: { toString(): string } | number;
}) {
  const rate = Number(exchangeRate ?? 1);
  const paid = paidAmount !== undefined ? Number(paidAmount.toString()) : undefined;
  return (
    <dl className="space-y-1 text-sm">
      {totals.discountAmount.gt(0) && (
        <>
          <div className="flex justify-between">
            <dt className="text-slate-500">Položky bez DPH</dt>
            <dd>{formatMoney(totals.subtotal.toNumber(), currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Sleva na doklad</dt>
            <dd>− {formatMoney(totals.discountAmount.toNumber(), currency)}</dd>
          </div>
        </>
      )}
      {vatApplicable ? (
        totals.vatGroups.map((g) => (
          <div key={g.rate} className="flex justify-between text-slate-500">
            <dt>
              Základ {g.rate} % / DPH {g.rate} %
            </dt>
            <dd>
              {formatMoney(g.base.toNumber(), currency)} / {formatMoney(g.vat.toNumber(), currency)}
            </dd>
          </div>
        ))
      ) : (
        <div className="flex justify-between text-slate-500">
          <dt>Celkem bez DPH</dt>
          <dd>{formatMoney(totals.base.toNumber(), currency)}</dd>
        </div>
      )}
      {!totals.rounding.isZero() && (
        <div className="flex justify-between text-slate-500">
          <dt>Zaokrouhlení</dt>
          <dd>{formatMoney(totals.rounding.toNumber(), currency)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
        <dt>Celkem k úhradě</dt>
        <dd>{formatMoney(totals.payable.toNumber(), currency)}</dd>
      </div>
      {currency !== "CZK" && rate > 0 && (
        <div className="flex justify-between text-xs text-slate-400">
          <dt>Kurz {rate} · v CZK</dt>
          <dd>{formatMoney(totals.payable.toNumber() * rate, "CZK")}</dd>
        </div>
      )}
      {paid !== undefined && (
        <>
          <div className="flex justify-between text-slate-500">
            <dt>Uhrazeno</dt>
            <dd>{formatMoney(paid, currency)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Zbývá uhradit</dt>
            <dd>{formatMoney(Math.max(0, totals.payable.toNumber() - paid), currency)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}

export function totalsForDoc(doc: {
  items: ItemRow[];
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue: { toString(): string };
  roundTotal?: boolean;
}, vatApplicable = true) {
  return computeTotals({
    items: doc.items,
    discountType: doc.discountType,
    discountValue: doc.discountValue,
    roundTotal: doc.roundTotal ?? false,
    vatApplicable,
  });
}
