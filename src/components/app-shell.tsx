"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { can, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { logoutAction } from "@/app/(auth)/actions";
import { Flash } from "@/components/flash";

const NAV: { href: string; label: string; permission?: Permission }[] = [
  { href: "/", label: "Přehled" },
  { href: "/nabidky", label: "Nabídky" },
  { href: "/faktury", label: "Faktury" },
  { href: "/subjekty", label: "Subjekty" },
  { href: "/cenik", label: "Ceník" },
  { href: "/banka", label: "Banka" },
  { href: "/nastaveni", label: "Nastavení", permission: "settings:write" },
];

export function AppShell({
  user,
  companyName,
  children,
}: {
  user: { name: string; email: string; role: Role };
  companyName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            {companyName || "Nabídky a faktury"}
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.filter((n) => !n.permission || can(user.role, n.permission)).map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
            </div>
            <form action={logoutAction}>
              <button className="btn-secondary btn-sm" type="submit">
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Flash />
        {children}
      </main>
    </div>
  );
}
