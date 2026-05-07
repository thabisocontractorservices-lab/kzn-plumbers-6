import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#1A5FBE",
          dark: "#0D3A80",
          mid: "#3A7FDE",
          light: "#E8F0FB",
        },
        teal: {
          DEFAULT: "#0F6E56",
          light: "#DCF1E8",
        },
        amber: {
          DEFAULT: "#BA7517",
          light: "#FAEEDA",
        },
        whatsapp: {
          DEFAULT: "#25D366",
          dark: "#1FB755",
        },
        emergency: {
          DEFAULT: "#E76F2A",
          light: "#FCE8DA",
        },
      },
      borderRadius: {
        DEFAULT: "12px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
        "card-hover": "0 6px 18px rgba(0,0,0,0.08)",
        floating: "0 12px 32px rgba(15,40,90,0.12)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
