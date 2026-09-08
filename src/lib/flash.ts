import "server-only";
import { redirect } from "next/navigation";

/** Redirects to the given path with an error message shown as a flash banner. */
export function redirectWithError(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}chyba=${encodeURIComponent(message)}`);
}

export function redirectWithSuccess(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}ok=${encodeURIComponent(message)}`);
}
