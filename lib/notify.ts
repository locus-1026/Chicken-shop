import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind =
  | "nudge_sales"
  | "nudge_royalty"
  | "nudge_training"
  | "coaching_call"
  | "warning_notice"
  | "info";

/**
 * Insert a notification row for every profile that belongs to the given franchisee.
 * A franchisee can have multiple users; every user gets their own row so they
 * each see the toast in their own session.
 */
export async function notifyFranchisee(
  supabase: SupabaseClient,
  franchiseeId: string,
  n: { kind: NotificationKind; title: string; body: string; link?: string }
) {
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("franchisee_id", franchiseeId);
  if (error || !users || users.length === 0) return { error: error ?? new Error("no recipients") };
  const rows = (users as { id: string }[]).map((u) => ({
    recipient_id: u.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
  }));
  const { error: insErr } = await supabase.from("notifications").insert(rows);
  return { error: insErr ?? null };
}

/** Same but push to every franchisee user at once (for bulk nudges). */
export async function notifyAllFranchisees(
  supabase: SupabaseClient,
  n: { kind: NotificationKind; title: string; body: string; link?: string }
) {
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "franchisee");
  if (error || !users) return { error: error ?? new Error("no recipients") };
  const rows = (users as { id: string }[]).map((u) => ({
    recipient_id: u.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
  }));
  const { error: insErr } = await supabase.from("notifications").insert(rows);
  return { error: insErr ?? null };
}
