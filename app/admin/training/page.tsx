"use client";

import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { mockTrainingModules } from "@/lib/mock-data";
import type { TrainingModule } from "@/lib/types";
import { UploadCloud } from "lucide-react";

export default function AdminTrainingPage() {
  const [modules, setModules] = useState<TrainingModule[]>(mockTrainingModules);
  const [dragOver, setDragOver] = useState(false);

  // Synthetic completion stats
  const stats = modules.map((m) => ({ name: m.title.slice(0, 18), completion: 30 + Math.round(Math.random() * 60) }));

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
            const name = e.dataTransfer.files[0]?.name ?? "New Module";
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
          }}
        >
          <div className="flex flex-col items-center py-8 text-center">
            <UploadCloud size={40} className="mb-3 text-[color:var(--color-brand)]" />
            <CardTitle>Drop a video or PDF</CardTitle>
            <CardSubtitle>Uploads to Supabase Storage (mocked). Drag & drop anywhere on this card.</CardSubtitle>
            <Button variant="outline" className="mt-4">Browse files</Button>
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
