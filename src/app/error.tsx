"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Něco se nepovedlo</h1>
      <p className="mt-2 text-sm text-slate-500">{error.message?.includes("oprávnění") ? error.message : "Akce se nezdařila. Zkuste to znovu, případně kontaktujte administrátora."}</p>
      <button className="btn-primary mt-6" onClick={reset}>
        Zkusit znovu
      </button>
    </div>
  );
}
