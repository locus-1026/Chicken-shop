"use client";

import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { mockMarketingAssets } from "@/lib/mock-data";
import { Download, FileType2 } from "lucide-react";

const categories = ["All", "Seasonal Promotions", "Social Media", "Menu Boards", "In-Store POS"];

export default function MarketingPage() {
  const [cat, setCat] = useState("All");
  const assets = cat === "All" ? mockMarketingAssets : mockMarketingAssets.filter((a) => a.category === cat);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
              (cat === c
                ? "bg-[color:var(--color-brand)] text-white"
                : "border border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-brand)]")
            }
          >
            {c}
          </button>
        ))}
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => (
          <StaggerItem key={a.id}>
            <Card interactive className="flex h-full flex-col">
              <div className="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--color-brand-50)] to-[color:var(--color-brand-100)]">
                <FileType2 size={44} className="text-[color:var(--color-brand)]" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Pill tone="brand">{a.category}</Pill>
                <Pill tone="neutral">{a.file_type.toUpperCase()}</Pill>
              </div>
              <CardTitle className="mt-2">{a.title}</CardTitle>
              <CardSubtitle>High-res, production-ready.</CardSubtitle>
              <div className="mt-4">
                <Button variant="outline" className="w-full">
                  <Download size={16} /> Download
                </Button>
              </div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
