import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        heart: {
          rose: "#E11D48",
          "rose-light": "#FFE4E6",
          wine: "#881337",
          blush: "#FDA4AF",
          cream: "#FFF7F7",
          ink: "#1C1917",
          gold: "#D97706",
        },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
