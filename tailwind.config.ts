import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", ...defaultTheme.fontFamily.sans],
      },
      // Nunito punya bobot 600/700/800 -> teks terasa "tebal & ramah" ala Duolingo tanpa ubah tiap komponen
      fontWeight: {
        medium: "600",
        semibold: "700",
        bold: "800",
      },
      colors: {
        primary: {
          DEFAULT: "#F46113",
          dark: "#D9530D",
          // sisi bawah tombol 3D (chunky)
          edge: "#C24A0A",
        },
      },
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
