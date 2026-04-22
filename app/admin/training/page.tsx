"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { TrainingModule, TrainingProgress, Outlet, Franchisee, Profile } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { notifyFranchisee, notifyAllFranchisees } from "@/lib/notify";
import { UploadCloud, Check, Clock, X as XIcon, Bell, Mail } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

type Cell = "passed" | "in_progress" | "not_started";

export default function AdminTrainingPage() {
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [franchiseesList, setFranchiseesList] = useState<Franchisee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [{ data: mods }, { data: prog }, { data: outs }, { data: fs }, { data: profs }] = await Promise.all([
      supabase.from("training_modules").select("*"),
      supabase.from("training_progress").select("*"),
      supabase.from("outlets").select("*").order("outlet_code"),
      supabase.from("franchisees").select("*"),
      supabase.from("profiles").select("*"),
    ]);
    setModules((mods ?? []) as TrainingModule[]);
    setProgress((prog ?? []) as TrainingProgress[]);
    setOutlets((outs ?? []) as Outlet[]);
    setFranchiseesList((fs ?? []) as Franchisee[]);
    setProfiles((profs ?? []) as Profile[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-training")
      .on("postgres_changes", { event: "*", schema: "public", table: "training_progress" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "training_modules" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  // For each outlet we look at its franchisee's users and their training_progress.
  const cellFor = useCallback((moduleId: string, outletId: string): Cell => {
    const outlet = outlets.find((o) => o.id === outletId);
    if (!outlet) return "not_started";
    const users = profiles.filter((p) => p.franchisee_id === outlet.franchisee_id);
    if (users.length === 0) return "not_started";
    const rel = progress.filter((p) => p.module_id === moduleId && users.some((u) => u.id === p.user_id));
    if (rel.some((r) => r.completed_at && r.score !== null)) return "passed";
    if (rel.some((r) => r.attempts > 0)) return "in_progress";
    return "not_started";
  }, [outlets, profiles, progress]);

  const scoreFor = useCallback((moduleId: string, outletId: string): number => {
    const outlet = outlets.find((o) => o.id === outletId);
    if (!outlet) return 0;
    const users = profiles.filter((p) => p.franchisee_id === outlet.franchisee_id);
    const rel = progress.filter((p) => p.module_id === moduleId && users.some((u) => u.id === p.user_id) && p.score !== null);
    if (rel.length === 0) return 0;
    return Math.max(...rel.map((r) => r.score ?? 0));
  }, [outlets, profiles, progress]);

  // Per-module completion = % of outlets with "passed".
  const moduleCompletion = useMemo(
    () =>
      modules.map((m) => {
        const passed = outlets.filter((o) => cellFor(m.id, o.id) === "passed").length;
        return { id: m.id, title: m.title, passed, total: outlets.length, pct: outlets.length ? Math.round((passed / outlets.length) * 100) : 0 };
      }),
    [modules, outlets, cellFor]
  );

  // Overall completion = avg across modules.
  const overall = Math.round(
    moduleCompletion.reduce((s, m) => s + m.pct, 0) / Math.max(1, moduleCompletion.length)
  );

  // Per-outlet completion for the "laggards" table + per-row completion.
  const outletCompletion = useMemo(
    () =>
      outlets.map((o) => {
        const passedCount = modules.filter((m) => cellFor(m.id, o.id) === "passed").length;
        const franchisee = franchiseesList.find((f) => f.id === o.franchisee_id);
        return {
          outlet: o,
          franchisee,
          passedCount,
          totalModules: modules.length,
          pct: Math.round((passedCount / Math.max(1, modules.length)) * 100),
        };
      }),
    [modules, outlets, franchiseesList, cellFor]
  );

  const addFile = async (name: string) => {
    const { error } = await supabase.from("training_modules").insert({
      title: name.replace(/\.[^.]+$/, ""),
      description: "Newly uploaded — edit metadata below.",
      video_url: "#",
      materials_url: null,
      category: "Operations",
      passing_score: 80,
    });
    if (error) { toast("error", `Upload failed: ${error.message}`); return; }
    await load();
    toast("success", `Uploaded "${name}" as a new draft module.`);
  };

  const nudgeOutlet = async (outletCode: string, missingCount: number, franchiseeId: string | undefined) => {
    if (!franchiseeId) return;
    await notifyFranchisee(supabase, franchiseeId, {
      kind: "nudge_training",
      title: "HQ reminder · Training outstanding",
      body: `${outletCode} has ${missingCount} training module${missingCount > 1 ? "s" : ""} still to complete. Please finish this week.`,
      link: "/portal/training",
    });
    toast("success", `Nudge sent to ${outletCode} for ${missingCount} outstanding module${missingCount > 1 ? "s" : ""}.`);
  };

  const nudgeAllIncomplete = async () => {
    const incomplete = outletCompletion.filter((o) => o.pct < 100 && o.franchisee?.id);
    if (incomplete.length === 0) {
      toast("info", "Everyone's caught up.");
      return;
    }
    // Dedup by franchisee id (several outlets per franchisee).
    const seen = new Set<string>();
    for (const row of incomplete) {
      const fid = row.franchisee?.id;
      if (!fid || seen.has(fid)) continue;
      seen.add(fid);
      await notifyFranchisee(supabase, fid, {
        kind: "nudge_training",
        title: "HQ reminder · Training outstanding",
        body: `Your team still has training modules to finish. Please complete them this week.`,
        link: "/portal/training",
      });
    }
    toast("success", `Reminder sent to ${seen.size} franchisee${seen.size > 1 ? "s" : ""} with outstanding modules.`);
    void notifyAllFranchisees; // kept for future bulk broadcast
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card
          className={
            "lg:col-span-2 border-dashed " +
            (dragOver ? "!border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)]" : "")
          }
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFile(e.dataTransfer.files[0]?.name ?? "New Module");
          }}
        >
          <div className="flex flex-col items-center py-8 text-center">
            <UploadCloud size={40} className="mb-3 text-[color:var(--color-brand)]" />
            <CardTitle>Drop a video or PDF</CardTitle>
            <CardSubtitle>Uploads to Supabase Storage (mocked).</CardSubtitle>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".mp4,.pdf,.mov,.zip"
              onChange={(e) => {
                const name = e.target.files?.[0]?.name;
                if (name) addFile(name);
                e.target.value = "";
              }}
            />
            <Button variant="outline" className="mt-4" onClick={() => fileRef.current?.click()}>
              Browse files
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Overall completion</CardTitle>
              <CardSubtitle>Passed / eligible, across every module</CardSubtitle>
            </div>
            <Button size="sm" variant="outline" onClick={nudgeAllIncomplete}>
              <Bell size={14} /> Nudge all incomplete
            </Button>
          </div>
          <div className="mt-4 flex items-end gap-4">
            <div className="text-[44px] font-semibold leading-none">{overall}%</div>
            <div className="pb-2 text-[12px] text-[color:var(--color-ink-soft)]">
              <div>Passing threshold 80%</div>
              <div>{outletCompletion.filter((o) => o.pct === 100).length} of {outletCompletion.length} outlets fully caught up</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {moduleCompletion.map((m) => (
              <div key={m.id}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="truncate pr-2 font-medium">{m.title}</span>
                  <span className="shrink-0 text-[color:var(--color-ink-soft)]">{m.passed}/{m.total} · {m.pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[color:var(--color-border)]">
                  <div
                    style={{ width: m.pct + "%" }}
                    className={
                      m.pct >= 80 ? "h-full bg-[color:var(--color-success)]"
                      : m.pct >= 60 ? "h-full bg-[color:var(--color-brand)]"
                      : "h-full bg-[color:var(--color-warning)]"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <CardTitle>Per-outlet completion</CardTitle>
            <CardSubtitle>Click a row to see exactly which modules are still outstanding.</CardSubtitle>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Owner</th>
              {modules.map((m) => (
                <th key={m.id} className="px-2 py-3 text-center" title={m.title}>
                  {m.title.slice(0, 12)}{m.title.length > 12 ? "…" : ""}
                </th>
              ))}
              <th className="px-4 py-3">Completion</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {outletCompletion.map((row) => {
              const missing = modules.length - row.passedCount;
              return (
                <tr key={row.outlet.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.outlet.outlet_code}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">{row.outlet.location}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px]">{row.franchisee?.owner_name ?? "—"}</td>
                  {modules.map((m) => {
                    const state = cellFor(m.id, row.outlet.id);
                    return (
                      <td key={m.id} className="px-2 py-3 text-center">
                        <CellBadge state={state} score={scoreFor(m.id, row.outlet.id)} />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[color:var(--color-border)]">
                        <div
                          style={{ width: row.pct + "%" }}
                          className={row.pct >= 80 ? "h-full bg-[color:var(--color-success)]" : "h-full bg-[color:var(--color-warning)]"}
                        />
                      </div>
                      <span className="text-[12px] font-semibold">{row.pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {missing > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => nudgeOutlet(row.outlet.outlet_code, missing, row.franchisee?.id)}
                      >
                        <Mail size={12} /> Nudge {missing}
                      </Button>
                    ) : (
                      <span className="text-[12px] text-[color:var(--color-success)]">
                        <Check size={12} className="inline -mt-0.5" /> Complete
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Passing</th>
              <th className="px-4 py-3">Assets</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id} className="border-t border-[color:var(--color-border)]">
                <td className="px-4 py-3">
                  <div className="font-medium">{m.title}</div>
                  <div className="text-[12px] text-[color:var(--color-ink-soft)]">{m.description}</div>
                </td>
                <td className="px-4 py-3"><Pill tone="brand">{m.category}</Pill></td>
                <td className="px-4 py-3">{m.passing_score}%</td>
                <td className="px-4 py-3 space-x-1">
                  {m.video_url && <Pill tone="neutral">video</Pill>}
                  {m.materials_url && <Pill tone="neutral">pdf</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CellBadge({ state, score }: { state: Cell; score: number }) {
  if (state === "passed") {
    return (
      <span
        title={`Passed with ${score}%`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
      >
        <Check size={14} />
      </span>
    );
  }
  if (state === "in_progress") {
    return (
      <span
        title="In progress"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning)]"
      >
        <Clock size={14} />
      </span>
    );
  }
  return (
    <span
      title="Not started"
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
    >
      <XIcon size={14} />
    </span>
  );
}
