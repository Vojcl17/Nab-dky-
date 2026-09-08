import "server-only";
import { prisma } from "./db";
import { getSettings } from "./settings";
import type { EditorPriceItem, EditorSettings, EditorSubject } from "@/components/document-editor";

export async function loadEditorData(): Promise<{ subjects: EditorSubject[]; priceItems: EditorPriceItem[]; settings: EditorSettings; raw: Awaited<ReturnType<typeof getSettings>> }> {
  const [subjects, priceItems, settings] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, ico: true, city: true } }),
    prisma.priceItem.findMany({ where: { active: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }),
    getSettings(),
  ]);
  return {
    subjects,
    priceItems: priceItems.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      unit: p.unit,
      priceCzk: p.priceCzk.toString(),
      priceEur: p.priceEur?.toString() ?? null,
      vatRate: p.vatRate,
    })),
    settings: { vatPayer: settings.vatPayer, defaultVatRate: settings.defaultVatRate, roundCzkTotals: settings.roundCzkTotals },
    raw: settings,
  };
}
