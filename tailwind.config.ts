import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0A0B",
          900: "#101013",
          800: "#16161B",
          700: "#1E1E25",
          600: "#2A2A33",
          500: "#3A3A45",
          400: "#6B6B78",
          300: "#9A9AA8",
          200: "#C5C5D0",
          100: "#E7E7EC",
          50: "#F5F5F7",
        },
        accent: {
          DEFAULT: "#F2EBDC",
          warm: "#E8D9B8",
          gold: "#C9A45C",
          coral: "#FF6B4A",
          teal: "#1F4A47",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-2xl": ["clamp(56px, 8vw, 96px)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "display-xl": ["clamp(40px, 6vw, 64px)", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(28px, 4vw, 40px)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
      boxShadow: {
        soft: "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.06)",
        "soft-lg": "0 24px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};

export default config;
