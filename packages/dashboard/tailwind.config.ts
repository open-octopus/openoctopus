import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ocean: "#1E3A5F",
        purple: "#6C3FA0",
        cyan: "#00D4AA",
        abyss: "#0D1117",
        surface: "#F6F8FA",
      },
      borderRadius: {
        card: "16px",
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
