export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className="mx-auto mb-2 h-16 w-auto" />
          <div className="text-2xl font-semibold tracking-tight">Nabídky a faktury</div>
          <div className="text-sm text-slate-500">Ceník · Nabídky · Faktury · ARES · Fio</div>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
