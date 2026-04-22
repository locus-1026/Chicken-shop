"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { ProgressRing } from "@/components/charts/ProgressRing";
import { fireConfetti } from "@/components/ui/Confetti";
import { useToast } from "@/components/ui/Toast";
import type { TrainingModule, TrainingProgress } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { PlayCircle, FileText, ArrowLeft } from "lucide-react";

// Module-specific quizzes. Each ties to the module id so staff get relevant
// questions — same inputs always give the same questions.
type Question = { q: string; options: string[]; correct: number };
const quizzesByModule: Record<string, Question[]> = {
  "t-1": [
    { q: "What's the target core temperature for poached chicken before serving?", options: ["55°C", "72°C", "85°C"], correct: 1 },
    { q: "How long should the chicken rest in the ice bath after poaching?", options: ["30 seconds", "5–7 minutes", "30 minutes"], correct: 1 },
    { q: "Which rice-to-stock ratio do we use for the signature rice?", options: ["1:1", "1:1.2", "1:2"], correct: 1 },
    { q: "The signature chilli sauce is finished with which ingredient?", options: ["Calamansi juice", "Tomato ketchup", "Soy sauce"], correct: 0 },
    { q: "Ginger-scallion oil should be made fresh every:", options: ["Shift", "3 days", "Week"], correct: 0 },
  ],
  "t-2": [
    { q: "Danger zone for food temperature is:", options: ["0–4°C", "5–60°C", "65–90°C"], correct: 1 },
    { q: "How often must the chopping board used for raw chicken be sanitised?", options: ["Between each protein switch", "Once per shift", "End of day only"], correct: 0 },
    { q: "Minimum hand-wash duration under MOH guidelines?", options: ["5 seconds", "20 seconds", "60 seconds"], correct: 1 },
    { q: "Cooked food left at room temperature must be discarded after:", options: ["1 hour", "4 hours", "8 hours"], correct: 1 },
    { q: "Who needs a valid typhoid vaccination record?", options: ["Only the manager", "Every food handler", "Only new hires"], correct: 1 },
  ],
  "t-3": [
    { q: "Which shortcut opens the daily Z-report on the POS?", options: ["F2", "Ctrl + Z", "Shift + R"], correct: 2 },
    { q: "A discount above 15% requires:", options: ["No approval", "Manager PIN override", "A written note"], correct: 1 },
    { q: "If the payment terminal is offline, the correct fallback is:", options: ["Refuse the order", "Manual tap-and-go on phone", "Record the sale and take cash"], correct: 2 },
    { q: "Where do you void a transaction after it's been closed?", options: ["You can't — process a refund instead", "Settings → Transactions", "By deleting the receipt"], correct: 0 },
    { q: "End-of-day sales are auto-synced to HQ at:", options: ["Every hour", "11:59 PM daily", "Only when you tap Sync"], correct: 1 },
  ],
  "t-4": [
    { q: "First step of the LAST recovery framework is:", options: ["Listen", "Apologise", "Solve"], correct: 0 },
    { q: "A customer finds hair in their rice. You should:", options: ["Offer a discount on the next visit", "Replace the meal + comp a drink + log an incident", "Ask them to finish the meal first"], correct: 1 },
    { q: "Refunds above RM 50 require:", options: ["No approval", "Shift manager approval", "HQ approval via ticket"], correct: 1 },
    { q: "What do we NEVER say to an angry customer?", options: ["\"I understand\"", "\"That's our policy\"", "\"Let me find out for you\""], correct: 1 },
    { q: "After any serious complaint, you must log it in:", options: ["The cashier notebook", "The Support tab of the portal", "WhatsApp group only"], correct: 1 },
  ],
  "t-5": [
    { q: "The approved brand orange is:", options: ["#FF6B00", "#E8590C", "#C94A05"], correct: 1 },
    { q: "Staff uniforms must be worn with:", options: ["Any closed-toe shoes", "Black non-slip shoes only", "Whatever is comfortable"], correct: 1 },
    { q: "The outdoor A-frame must be displayed:", options: ["Within 1m of the entrance", "Wherever there's space", "Only on weekends"], correct: 0 },
    { q: "Menu boards must be refreshed when a price changes, within:", options: ["24 hours", "7 days", "End of the month"], correct: 0 },
    { q: "Customer-facing counters must be wiped every:", options: ["15 minutes during peak", "Once per shift", "End of day"], correct: 0 },
  ],
};
// DB module UUIDs end in 01..05, matching the t-1..t-5 quiz keys.
function quizFor(moduleId: string): Question[] {
  const legacy = quizzesByModule[moduleId];
  if (legacy) return legacy;
  const suffix = moduleId.slice(-2);
  const key = `t-${parseInt(suffix, 10) || 1}`;
  return quizzesByModule[key] ?? quizzesByModule["t-1"];
}

export default function TrainingPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [active, setActive] = useState<TrainingModule | null>(null);

  const load = useCallback(async () => {
    const [{ data: mods }, { data: prog }] = await Promise.all([
      supabase.from("training_modules").select("*").order("passing_score"),
      profile?.id
        ? supabase.from("training_progress").select("*").eq("user_id", profile.id)
        : Promise.resolve({ data: [] as TrainingProgress[] }),
    ]);
    setModules((mods ?? []) as TrainingModule[]);
    setProgress((prog ?? []) as TrainingProgress[]);
  }, [supabase, profile?.id]);

  useEffect(() => {
    load();
    if (!profile?.id) return;
    const channel = supabase
      .channel("portal-training-" + profile.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "training_progress", filter: `user_id=eq.${profile.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase, profile?.id]);

  const progressFor = (id: string) => progress.find((p) => p.module_id === id);

  return (
    <div className="space-y-6">
      <Card className="bg-[color:var(--color-brand-50)] !border-[color:var(--color-brand-200)]">
        <CardTitle>Keep your team sharp</CardTitle>
        <CardSubtitle>Five modules. Each one makes your outlet stronger.</CardSubtitle>
        <div className="mt-3 text-[13px] text-[color:var(--color-brand-700)] font-medium">
          {progress.filter((p) => p.completed_at).length} / {modules.length} completed
        </div>
      </Card>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          const p = progressFor(m.id);
          const done = !!p?.completed_at;
          const pct = done ? 100 : p?.attempts ? 40 : 0;
          return (
            <StaggerItem key={m.id}>
              <Card interactive className="flex h-full flex-col">
                <div className="flex items-start gap-4">
                  <ProgressRing value={pct} />
                  <div className="flex-1">
                    <Pill tone="brand">{m.category}</Pill>
                    <CardTitle className="mt-2">{m.title}</CardTitle>
                    <CardSubtitle>{m.description}</CardSubtitle>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[12px] text-[color:var(--color-ink-soft)]">
                  {m.video_url && <><PlayCircle size={14} /> Video</>}
                  {m.materials_url && <><FileText size={14} /> PDF</>}
                  <span className="ml-auto">Pass ≥ {m.passing_score}%</span>
                </div>
                <div className="mt-4">
                  <Button
                    variant={done ? "outline" : "primary"}
                    className="w-full"
                    onClick={() => setActive(m)}
                  >
                    {done ? `Retake (${p!.score}%)` : p?.attempts ? "Resume" : "Start module"}
                  </Button>
                </div>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>

      {active && (
        <LearningModal
          module={active}
          onClose={() => setActive(null)}
          onPass={async (score) => {
            if (!profile?.id) { toast("error", "Sign in required."); return; }
            const existing = progress.find((x) => x.module_id === active.id);
            const payload = {
              user_id: profile.id,
              module_id: active.id,
              completed_at: new Date().toISOString(),
              score,
              attempts: (existing?.attempts ?? 0) + 1,
            };
            const { error } = existing
              ? await supabase.from("training_progress").update(payload).eq("id", existing.id)
              : await supabase.from("training_progress").insert(payload);
            if (error) { toast("error", `Save failed: ${error.message}`); return; }
            await load();
            fireConfetti();
            setActive(null);
          }}
        />
      )}
    </div>
  );
}

function LearningModal({
  module,
  onClose,
  onPass,
}: {
  module: TrainingModule;
  onClose: () => void;
  onPass: (score: number) => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<"content" | "quiz" | "result">("content");
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const quiz = quizFor(module.id);

  const allAnswered = quiz.every((_, i) => typeof answers[i] === "number");

  const submit = () => {
    if (!allAnswered) {
      toast("error", "Please answer every question before submitting.");
      return;
    }
    const correct = quiz.filter((q, i) => answers[i] === q.correct).length;
    const score = Math.round((correct / quiz.length) * 100);
    setStep("result");
    if (score >= module.passing_score) {
      setTimeout(() => onPass(score), 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-ink)]/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[color:var(--color-border)] p-5">
          <div className="flex items-start gap-3">
            <button
              onClick={() => (step === "content" ? onClose() : setStep(step === "result" ? "quiz" : "content"))}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand-700)]"
              aria-label={step === "content" ? "Back to modules" : "Back a step"}
              title={step === "content" ? "Back to modules" : "Back"}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <Pill tone="brand">{module.category}</Pill>
              <h2 className="mt-2 text-xl font-semibold">{module.title}</h2>
              <p className="text-[13px] text-[color:var(--color-ink-soft)]">{module.description}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "content" && (
            <div className="space-y-5">
              <div className="aspect-video w-full rounded-xl bg-[color:var(--color-ink)] flex items-center justify-center text-white">
                <PlayCircle size={56} />
                <span className="ml-3 text-sm opacity-70">Video player (demo)</span>
              </div>
              {module.materials_url && (
                <a
                  href={module.materials_url}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-4 py-2 text-sm font-medium hover:border-[color:var(--color-brand)]"
                >
                  <FileText size={16} /> Download PDF materials
                </a>
              )}
            </div>
          )}

          {step === "quiz" && (
            <div className="space-y-5">
              {quiz.map((q, i) => (
                <div key={i}>
                  <div className="mb-2 text-sm font-medium">{i + 1}. {q.q}</div>
                  <div className="grid gap-2">
                    {q.options.map((o, j) => (
                      <label
                        key={j}
                        className={
                          "flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition-colors " +
                          (answers[i] === j
                            ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)]"
                            : "border-[color:var(--color-border)] hover:border-[color:var(--color-brand-200)]")
                        }
                      >
                        <input
                          type="radio"
                          className="accent-[color:var(--color-brand)]"
                          checked={answers[i] === j}
                          onChange={() => {
                            const next = [...answers];
                            next[i] = j;
                            setAnswers(next);
                          }}
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "result" && (
            <Result quiz={quiz} answers={answers} passing={module.passing_score} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--color-border)] p-4">
          {step === "content" && <Button onClick={() => setStep("quiz")}>Start quiz →</Button>}
          {step === "quiz" && (
            <Button onClick={submit} disabled={!allAnswered} className={allAnswered ? "" : "opacity-50 cursor-not-allowed"}>
              Submit answers
            </Button>
          )}
          {step === "result" && <Button variant="outline" onClick={onClose}>Close</Button>}
        </div>
      </div>
    </div>
  );
}

function Result({
  quiz,
  answers,
  passing,
}: {
  quiz: { q: string; options: string[]; correct: number }[];
  answers: (number | undefined)[];
  passing: number;
}) {
  const correct = quiz.filter((q, i) => answers[i] === q.correct).length;
  const score = Math.round((correct / quiz.length) * 100);
  const passed = score >= passing;
  return (
    <div className="py-8 text-center">
      <div
        className={
          "mx-auto flex h-28 w-28 items-center justify-center rounded-full text-3xl font-semibold " +
          (passed
            ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
            : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]")
        }
      >
        {score}%
      </div>
      <h3 className="mt-4 text-xl font-semibold">{passed ? "Passed! 🎉" : "Not quite there"}</h3>
      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
        {passed ? "Module marked as complete." : `You need ${passing}% to pass. Try again.`}
      </p>
    </div>
  );
}
