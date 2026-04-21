"use client";

import { useMemo, useRef, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { mockTrainingModules } from "@/lib/mock-data";
import type { TrainingModule } from "@/lib/types";
import { UploadCloud } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function AdminTrainingPage() {
  const toast = useToast();
  const [modules, setModules] = useState<TrainingModule[]>(mockTrainingModules);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Stable synthetic completion stats (computed once per module set).
  const stats = useMemo(
    () =>
      modules.map((m, idx) => ({
        name: m.title.length > 18 ? m.title.slice(0, 17) + "…" : m.title,
        completion: 35 + ((idx * 17 + m.title.length * 3) % 60),
      })),
    [modules]
  );

  const addFile = (name: string) => {
    setModules((prev) => [
      {
        id: "t-new-" + Date.now(),
        title: name.replace(/\.[^.]+$/, ""),
        description: "Newly uploaded — edit metadata below.",
        video_url: "#",
        materials_url: null,
        category: "Operations",
        passing_score: 80,
      },
      ...prev,
    ]);
    toast("success", `Uploaded "${name}" as a new draft module.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card
          className={
            "lg:col-span-2 border-dashed " +
            (dragOver ? "!border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)]" : "")
          }
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
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
            <CardSubtitle>Uploads to Supabase Storage (mocked). Drag & drop anywhere on this card.</CardSubtitle>
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
          <CardTitle>Completion rate</CardTitle>
          <CardSubtitle>% of eligible users who passed each module</CardSubtitle>
          <div className="mt-3 h-56">
            <ResponsiveContainer>
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="2 4" stroke="#F0DCC2" vertical={false} />
                <XAxis dataKey="name" stroke="#6B4A35" fontSize={11} />
                <YAxis stroke="#6B4A35" fontSize={11} />
                <Tooltip formatter={(v: number) => v + "%"} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="completion" fill="#E8590C" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Title</th>
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
