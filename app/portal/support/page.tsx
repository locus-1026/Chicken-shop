"use client";

import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { mockTickets } from "@/lib/mock-data";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { formatDate } from "@/lib/utils";
import type { SupportTicket } from "@/lib/types";
import { Paperclip } from "lucide-react";

const categories = ["IT / POS", "Supply Chain", "Marketing", "HR / Staffing", "Facility", "Other"];

export default function SupportPage() {
  const { outlet } = useCurrentOutlet();
  const [tickets, setTickets] = useState<SupportTicket[]>(mockTickets);
  const [form, setForm] = useState({ category: categories[0], subject: "", description: "" });

  const submit = () => {
    if (!form.subject.trim() || !form.description.trim()) return;
    const t: SupportTicket = {
      id: "tk-new-" + Date.now(),
      outlet_id: outlet.id,
      category: form.category,
      subject: form.subject,
      description: form.description,
      photo_url: null,
      status: "open",
      created_at: new Date().toISOString(),
    };
    setTickets([t, ...tickets]);
    setForm({ category: categories[0], subject: "", description: "" });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>Open a new ticket</CardTitle>
          <CardSubtitle>Someone at HQ responds within one business day.</CardSubtitle>
          <div className="mt-4 grid gap-4">
            <label>
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5"
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Subject</span>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5"
                placeholder="Short summary"
              />
            </label>
            <label>
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5"
                placeholder="Tell us what's happening"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[color:var(--color-border)] px-3 py-3 text-sm text-[color:var(--color-ink-soft)]">
              <Paperclip size={16} /> Attach photo (optional)
              <input type="file" className="hidden" />
            </label>
            <Button onClick={submit} className="self-start">Submit ticket</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Your stats</CardTitle>
          <div className="mt-4 space-y-3">
            <StatRow label="Open" value={tickets.filter((t) => t.status === "open").length} tone="warning" />
            <StatRow label="In progress" value={tickets.filter((t) => t.status === "in_progress").length} tone="brand" />
            <StatRow label="Resolved (lifetime)" value={tickets.filter((t) => t.status === "resolved").length} tone="success" />
          </div>
          <div className="mt-5 rounded-xl bg-[color:var(--color-brand-50)] px-3 py-3 text-[13px]">
            For urgent outlet-down issues, WhatsApp HQ at <b>+603-4256 7700</b>.
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Ticket history</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--color-border)]">
                  <td className="py-2.5 pr-4">{formatDate(t.created_at)}</td>
                  <td className="py-2.5 pr-4">{t.category}</td>
                  <td className="py-2.5 pr-4 font-medium">{t.subject}</td>
                  <td className="py-2.5 pr-4">
                    <Pill tone={t.status === "resolved" ? "success" : t.status === "open" ? "warning" : "brand"}>
                      {t.status.replace("_", " ")}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "brand" }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
      <span className="text-sm text-[color:var(--color-ink-soft)]">{label}</span>
      <Pill tone={tone}>{value}</Pill>
    </div>
  );
}
