import type { Prisma, Subject } from "@prisma/client";
import type { DocumentItemInput } from "./schemas";
import type { Settings } from "./settings";

export interface EditorItem {
  key: string;
  priceItemId: string | null;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: number;
  discountPercent: string;
  noDiscount?: boolean;
}

type ItemRow = {
  priceItemId: string | null;
  name: string;
  description: string;
  quantity: Prisma.Decimal | string | number;
  unit: string;
  unitPrice: Prisma.Decimal | string | number;
  vatRate: number;
  discountPercent: Prisma.Decimal | string | number;
  noDiscount?: boolean;
};

export function toEditorItems(items: ItemRow[]): EditorItem[] {
  return items.map((it, i) => ({
    key: `i${i}`,
    priceItemId: it.priceItemId,
    name: it.name,
    description: it.description,
    quantity: it.quantity.toString(),
    unit: it.unit,
    unitPrice: it.unitPrice.toString(),
    vatRate: it.vatRate,
    discountPercent: it.discountPercent.toString(),
    noDiscount: it.noDiscount ?? false,
  }));
}

export function itemsToCreate(items: DocumentItemInput[]) {
  return items.map((it, i) => ({
    position: i,
    priceItemId: it.priceItemId || null,
    name: it.name,
    description: it.description ?? "",
    quantity: it.quantity,
    unit: it.unit || "ks",
    unitPrice: it.unitPrice,
    vatRate: it.vatRate,
    discountPercent: it.discountPercent,
    noDiscount: it.noDiscount ?? false,
  }));
}

export interface SupplierSnapshot {
  name: string;
  ico: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  web: string;
  registrationNote: string;
  bankAccount: string;
  bankCode: string;
  iban: string;
  bic: string;
  vatPayer: boolean;
}

export function supplierSnapshot(s: Settings): SupplierSnapshot {
  return {
    name: s.name,
    ico: s.ico,
    dic: s.dic,
    street: s.street,
    city: s.city,
    zip: s.zip,
    country: s.country,
    email: s.email,
    phone: s.phone,
    web: s.web,
    registrationNote: s.registrationNote,
    bankAccount: s.bankAccount,
    bankCode: s.bankCode,
    iban: s.iban,
    bic: s.bic,
    vatPayer: s.vatPayer,
  };
}

export function customerSnapshot(subject: Subject) {
  return {
    customerName: subject.name,
    customerIco: subject.ico,
    customerDic: subject.dic,
    customerStreet: subject.street,
    customerCity: subject.city,
    customerZip: subject.zip,
    customerCountry: subject.country,
    customerEmail: subject.email,
  };
}

export function readSupplier(json: Prisma.JsonValue | null | undefined, fallback: Settings): SupplierSnapshot {
  if (json && typeof json === "object" && !Array.isArray(json) && "name" in json) {
    return json as unknown as SupplierSnapshot;
  }
  return supplierSnapshot(fallback);
}
