import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#E8590C",
          50: "#FFF2E6",
          100: "#FFE0C2",
          200: "#FFC08F",
          300: "#FF9147",
          500: "#E8590C",
          600: "#C94A05",
          700: "#A13B04",
        },
        ink: {
          DEFAULT: "#2D1A0E",
          soft: "#6B4A35",
        },
        canvas: "#FFF8F0",
        surface: "#FFFFFF",
        success: { DEFAULT: "#3B6D11", soft: "#E8F1D9" },
        warning: { DEFAULT: "#854F0B", soft: "#FAEBCE" },
        danger:  { DEFAULT: "#A32D2D", soft: "#F6D9D9" },
      },
      boxShadow: {
        lift: "0 12px 28px -14px rgba(45, 26, 14, 0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
