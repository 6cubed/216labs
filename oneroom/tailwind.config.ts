import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
      },
      colors: {
        brand: {
          50: "#f3f7f4",
          100: "#e0ecdf",
          200: "#bed8be",
          300: "#93bc93",
          400: "#659b66",
          500: "#477f48",
          600: "#366438",
          700: "#2b502c",
          800: "#234026",
          900: "#1c3420",
        },
        surface: {
          50: "#fafaf8",
          100: "#f5f5f0",
          200: "#e8e7e0",
          300: "#d5d3c8",
          800: "#2a2820",
          900: "#1c1a14",
          950: "#0d0c08",
        },
      },
      animation: {
        shimmer: "shimmer 2.5s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(71, 127, 72, 0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(71, 127, 72, 0.35)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
