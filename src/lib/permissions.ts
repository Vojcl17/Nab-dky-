import type { Role } from "@prisma/client";

export type Permission =
  | "read"
  | "pricelist:write"
  | "subjects:write"
  | "offers:write"
  | "inquiries:write"
  | "invoices:write"
  | "payments:write"
  | "bank:sync"
  | "settings:write"
  | "users:manage";

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "read",
    "pricelist:write",
    "subjects:write",
    "offers:write",
    "inquiries:write",
    "invoices:write",
    "payments:write",
    "bank:sync",
    "settings:write",
    "users:manage",
  ],
  SALES: ["read", "pricelist:write", "subjects:write", "offers:write", "inquiries:write", "invoices:write"],
  ACCOUNTANT: ["read", "subjects:write", "invoices:write", "payments:write", "bank:sync"],
  VIEWER: ["read"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrátor",
  SALES: "Obchodník",
  ACCOUNTANT: "Účetní",
  VIEWER: "Jen čtení",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Vše včetně nastavení firmy a správy uživatelů.",
  SALES: "Poptávky, ceník, subjekty, nabídky a vystavování faktur.",
  ACCOUNTANT: "Faktury, platby, banka a subjekty.",
  VIEWER: "Pouze prohlížení a export.",
};
