import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Stránka nenalezena</h1>
      <Link href="/" className="btn-secondary mt-6">
        Zpět na přehled
      </Link>
    </div>
  );
}
