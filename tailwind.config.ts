import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#8b1a1a",
          dark: "#5a0f0f",
          light: "#c9424d",
          muted: "#4a2020",
        },
        surface: {
          DEFAULT: "#1a1410",
          sidebar: "#110e0a",
          card: "#231c16",
          border: "#3a2e26",
        },
        ink: {
          DEFAULT: "#e8ddd0",
          muted: "#9c8a78",
          faint: "#5c4f42",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
