"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function FlashInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const error = params.get("chyba");
  const ok = params.get("ok");
  if (!error && !ok) return null;
  const dismiss = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("chyba");
    next.delete("ok");
    router.replace(next.size ? `${pathname}?${next}` : pathname);
  };
  return (
    <div
      className={`mb-4 flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
      role="alert"
    >
      <span>{error ?? ok}</span>
      <button type="button" onClick={dismiss} className="text-xs opacity-70 hover:opacity-100" aria-label="Zavřít">
        ✕
      </button>
    </div>
  );
}

export function Flash() {
  return (
    <Suspense fallback={null}>
      <FlashInner />
    </Suspense>
  );
}
