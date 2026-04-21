"use client";

import { useRef, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { mockAnnouncements, mockFranchisees } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import type { Announcement } from "@/lib/types";
import { Send, Eye } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// Stable per-announcement open-rate (simple hash → 55..95%).
function openRate(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 55 + (Math.abs(h) % 40);
}

export default function AdminAnnouncementsPage() {
  const toast = useToast();
  const [list, setList] = useState<Announcement[]>(mockAnnouncements);
  const [title, setTitle] = useState("");
  // "all" = everyone, "franchisees" = all franchisees, or a franchisee id = that one only.
  const [target, setTarget] = useState<string>("all");
  const targetLabel =
    target === "all" ? "All users"
    : target === "franchisees" ? "All franchisees"
    : mockFranchisees.find((f) => f.id === target)?.business_name ?? "Custom";
  const [schedule, setSchedule] = useState("");
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const exec = (cmd: string) => document.execCommand(cmd, false);

  const publish = () => {
    const body = bodyRef.current?.innerHTML ?? "";
    if (!title.trim()) {
      toast("error", "Please give the announcement a title.");
      return;
    }
    if (!body.replace(/<[^>]+>/g, "").trim()) {
      toast("error", "Please write the announcement body.");
      return;
    }
    const a: Announcement = {
      id: "an-new-" + Date.now(),
      title,
      body,
      pinned: false,
      publish_at: schedule ? new Date(schedule).toISOString() : new Date().toISOString(),
      target_role: target === "all" || target === "franchisees" ? (target === "franchisees" ? "franchisee" : null) : "franchisee",
      target_label: targetLabel,
    } as Announcement & { target_label?: string };
    setList([a, ...list]);
    setTitle("");
    if (bodyRef.current) bodyRef.current.innerHTML = "";
    setSchedule("");
    setPreview(false);
    toast("success", `Announcement "${a.title}" queued.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>New announcement</CardTitle>
          <CardSubtitle>Target a role, schedule publish, preview before send.</CardSubtitle>

          <div className="mt-4 space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-2.5 text-lg font-semibold"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-2 py-1">
              <div className="flex items-center gap-1">
                <FormatBtn label="B" onClick={() => exec("bold")} />
                <FormatBtn label="I" onClick={() => exec("italic")} />
                <FormatBtn label="U" onClick={() => exec("underline")} />
                <FormatBtn label="• List" onClick={() => exec("insertUnorderedList")} />
              </div>
              <span className="pr-2 text-[11px] text-[color:var(--color-ink-soft)]">Select text first, then format.</span>
            </div>
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[180px] rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[color:var(--color-brand)]"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Target audience</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2"
                >
                  <option value="all">All users (franchisees + HQ)</option>
                  <option value="franchisees">All franchisees</option>
                  <optgroup label="Specific franchisee">
                    {mockFranchisees.map((f) => (
                      <option key={f.id} value={f.id}>{f.business_name} · {f.owner_name}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label>
                <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Publish at</span>
                <input
                  type="datetime-local"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2"
                />
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview((p) => !p)}>
                <Eye size={16} /> {preview ? "Hide preview" : "Preview"}
              </Button>
              <Button onClick={publish}><Send size={16} /> Publish</Button>
            </div>

            {preview && (
              <div className="rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-4">
                <div className="text-[11px] font-semibold uppercase text-[color:var(--color-brand-700)]">Preview</div>
                <h3 className="mt-1 text-lg font-semibold">{title || "Untitled"}</h3>
                <div className="prose prose-sm mt-2" dangerouslySetInnerHTML={{ __html: bodyRef.current?.innerHTML ?? "" }} />
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Sent history</CardTitle>
          <CardSubtitle>Mock open-rate tracking.</CardSubtitle>
          <ul className="mt-3 space-y-2">
            {list.map((a) => (
              <li key={a.id} className="rounded-xl border border-[color:var(--color-border)] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{a.title}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">
                      {formatDate(a.publish_at)} · {(a as Announcement & { target_label?: string }).target_label ?? (a.target_role ?? "all")}
                    </div>
                  </div>
                  <Pill tone="brand">{openRate(a.id)}% opened</Pill>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function FormatBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="rounded-lg px-2.5 py-1 text-[13px] font-semibold text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)] hover:text-[color:var(--color-brand-700)]"
    >
      {label}
    </button>
  );
}
