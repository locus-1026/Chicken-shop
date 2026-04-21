"use client";

import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { ProgressRing } from "@/components/charts/ProgressRing";
import { fireConfetti } from "@/components/ui/Confetti";
import { useToast } from "@/components/ui/Toast";
import { mockTrainingModules, mockTrainingProgress } from "@/lib/mock-data";
import type { TrainingModule } from "@/lib/types";
import { PlayCircle, FileText } from "lucide-react";

export default function TrainingPage() {
  const [progress, setProgress] = useState(mockTrainingProgress);
  const [active, setActive] = useState<TrainingModule | null>(null);

  const progressFor = (id: string) => progress.find((p) => p.module_id === id);

  return (
    <div className="space-y-6">
      <Card className="bg-[color:var(--color-brand-50)] !border-[color:var(--color-brand-200)]">
        <CardTitle>Keep your team sharp</CardTitle>
        <CardSubtitle>Five modules. Each one makes your outlet stronger.</CardSubtitle>
        <div className="mt-3 text-[13px] text-[color:var(--color-brand-700)] font-medium">
          {progress.filter((p) => p.completed_at).length} / {mockTrainingModules.length} completed
        </div>
      </Card>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mockTrainingModules.map((m) => {
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
          onPass={(score) => {
            setProgress((prev) => {
              const existing = prev.find((x) => x.module_id === active.id);
              if (existing) {
                return prev.map((x) =>
                  x.module_id === active.id
                    ? { ...x, completed_at: new Date().toISOString(), score, attempts: x.attempts + 1 }
                    : x
                );
              }
              return [
                ...prev,
                {
                  id: "tp-new-" + Date.now(),
                  user_id: "u-1",
                  module_id: active.id,
                  completed_at: new Date().toISOString(),
                  score,
                  attempts: 1,
                },
              ];
            });
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
  const quiz = [
    { q: "What is the correct holding temperature for the chicken?", options: ["60°C", "75°C", "90°C"], correct: 1 },
    { q: "How often should the chopping board be sanitised?", options: ["Every shift", "Once a week", "Only when dirty"], correct: 0 },
    { q: `The passing score for this module is ${module.passing_score}%. True?`, options: ["True", "False"], correct: 0 },
  ];

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
          <div>
            <Pill tone="brand">{module.category}</Pill>
            <h2 className="mt-2 text-xl font-semibold">{module.title}</h2>
            <p className="text-[13px] text-[color:var(--color-ink-soft)]">{module.description}</p>
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
