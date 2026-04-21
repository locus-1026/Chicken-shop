"use client";
import confetti from "canvas-confetti";

export function fireConfetti() {
  const colors = ["#E8590C", "#FFC08F", "#3B6D11", "#FFE0C2"];
  confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors });
  setTimeout(() => confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors }), 120);
  setTimeout(() => confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors }), 200);
}
