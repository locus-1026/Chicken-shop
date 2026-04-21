"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

type Row = {
  business_name: string;
  owner_name: string;
  status: string;
  agreement_end: string;
};

export default function SupabaseDebugPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [modules, setModules] = useState<{ title: string; category: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ url: string; hasKey: boolean }>({ url: "", hasKey: false });

  useEffect(() => {
    setMeta({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(missing)",
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("franchisees")
          .select("business_name, owner_name, status, agreement_end")
          .order("business_name");
        if (error) setError(error.message);
        else setRows(data as Row[]);

        const { data: mods, error: modsErr } = await supabase
          .from("training_modules")
          .select("title, category")
          .order("title");
        if (modsErr) setError((prev) => prev ?? modsErr.message);
        else setModules(mods ?? []);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-[color:var(--color-background)] px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <Card>
          <CardTitle>Supabase connectivity check</CardTitle>
          <CardSubtitle>Lives at /debug/supabase — confirms env vars and RLS both work.</CardSubtitle>
          <div className="mt-3 space-y-1 text-[12px] text-[color:var(--color-ink-soft)]">
            <div>URL: <code>{meta.url}</code></div>
            <div>Anon key set: {meta.hasKey ? <Pill tone="success">yes</Pill> : <Pill tone="danger">no</Pill>}</div>
          </div>
        </Card>

        {error && (
          <Card className="!border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]">
            <CardTitle>Error</CardTitle>
            <pre className="mt-2 whitespace-pre-wrap text-[12px]">{error}</pre>
          </Card>
        )}

        {rows === null && !error && (
          <Card><div className="skeleton h-8 w-full" /></Card>
        )}

        {rows && rows.length > 0 && (
          <Card>
            <CardTitle>Franchisees ({rows.length})</CardTitle>
            <ul className="mt-3 space-y-2">
              {rows.map((r) => (
                <li key={r.business_name} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                  <div>
                    <div className="font-medium">{r.business_name}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">{r.owner_name}</div>
                  </div>
                  <div className="flex gap-2">
                    <Pill tone="success">{r.status}</Pill>
                    <Pill tone="neutral">ends {r.agreement_end}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {rows && rows.length === 0 && !error && (
          <Card className="!border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]">
            <CardTitle>Franchisees: 0 rows — this is expected ✓</CardTitle>
            <CardSubtitle>
              RLS is doing its job. Only authenticated admins or the outlet's own franchisee can read this table.
              Training modules below are publicly readable — if you see 5 of them, Supabase is fully wired up.
            </CardSubtitle>
          </Card>
        )}

        {modules && (
          <Card>
            <CardTitle>Training modules ({modules.length})</CardTitle>
            <CardSubtitle>Public read — proves anon key + URL both work.</CardSubtitle>
            <ul className="mt-3 space-y-2">
              {modules.map((m) => (
                <li key={m.title} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                  <span className="text-sm">{m.title}</span>
                  <Pill tone="brand">{m.category}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </main>
  );
}
