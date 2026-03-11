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
          50: "#fdf6f0",
          100: "#fae8d8",
          200: "#f4ceaf",
          300: "#edae7e",
          400: "#e4884c",
          500: "#de6d2b",
          600: "#cf5421",
          700: "#ac3f1c",
          800: "#89341e",
          900: "#6f2d1b",
        },
        surface: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          800: "#292524",
          900: "#1c1917",
          950: "#0c0a09",
        },
      },
      animation: {
        "shimmer": "shimmer 2.5s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(222, 109, 43, 0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(222, 109, 43, 0.35)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
