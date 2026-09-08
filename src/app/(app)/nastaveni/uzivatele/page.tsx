import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { CopyLink, InviteForm, ResetPasswordForm } from "./invite-form";
import { deleteInvitationAction, updateUserAction } from "../actions";

const ROLES = ["ADMIN", "SALES", "ACCOUNTANT", "VIEWER"] as const;

export default async function UsersPage() {
  const me = await requireUser("users:manage");
  const [users, invitations] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.invitation.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <PageHeader title="Uživatelé a přístupy" actions={<LinkButton href="/nastaveni">Zpět na nastavení</LinkButton>} />

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Pozvat uživatele</h2>
        <InviteForm />
      </div>

      {invitations.length > 0 && (
        <div className="card">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">Čekající pozvánky</h2>
          </div>
          <table className="table">
            <tbody>
              {invitations.map((inv) => {
                const url = `${appUrl}/pozvanka/${inv.token}`;
                const expired = inv.expiresAt < new Date();
                return (
                  <tr key={inv.id}>
                    <td>
                      <div className="font-medium">{inv.email}</div>
                      <div className="text-xs text-slate-500">{inv.name}</div>
                    </td>
                    <td>{ROLE_LABELS[inv.role]}</td>
                    <td className="text-xs text-slate-500">{expired ? <span className="text-rose-600">vypršela</span> : `platí do ${formatDate(inv.expiresAt)}`}</td>
                    <td className="max-w-md truncate font-mono text-xs text-slate-500">{url}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <CopyLink url={url} />
                        <form action={deleteInvitationAction}>
                          <input type="hidden" name="id" value={inv.id} />
                          <button className="btn-danger btn-sm">Zrušit</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Uživatelé</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Uživatel</th>
              <th>Role</th>
              <th>Stav</th>
              <th>Vytvořen</th>
              <th>Heslo</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium">
                    {u.name} {u.id === me.id && <span className="text-xs text-slate-400">(vy)</span>}
                  </div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td>
                  <form action={updateUserAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="active" value={u.active ? "1" : "0"} />
                    <select name="role" className="input max-w-[11rem] py-1 text-xs" defaultValue={u.role} disabled={u.id === me.id}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    {u.id !== me.id && <button className="btn-secondary btn-sm">Uložit</button>}
                  </form>
                </td>
                <td>
                  {u.active ? <Badge className="bg-emerald-100 text-emerald-800">aktivní</Badge> : <Badge className="bg-slate-100 text-slate-500">deaktivován</Badge>}
                  {u.id !== me.id && (
                    <form action={updateUserAction} className="mt-1">
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="role" value={u.role} />
                      <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                      <button className="text-xs text-indigo-700 hover:underline">{u.active ? "Deaktivovat" : "Aktivovat"}</button>
                    </form>
                  )}
                </td>
                <td className="text-xs text-slate-500">{formatDateTime(u.createdAt)}</td>
                <td>
                  <ResetPasswordForm userId={u.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
