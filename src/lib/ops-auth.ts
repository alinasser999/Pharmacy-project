import { cookies } from "next/headers";

// Boring, simple gate for the single-operator ops dashboard (playbook says keep
// it simple). One shared password -> httpOnly cookie. Full Supabase Auth is
// deferred until there's more than one operator (see DECISIONS.md).
export const OPS_COOKIE = "mf_ops";

export function isOpsAuthed(): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  return cookies().get(OPS_COOKIE)?.value === expected;
}
