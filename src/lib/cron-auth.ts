import "server-only";

export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : new URL(req.url).searchParams.get("secret") ?? "";
  return !!secret && provided === secret;
}
