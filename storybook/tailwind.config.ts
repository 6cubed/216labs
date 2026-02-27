import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        story: {
          purple: "#7C3AED",
          "purple-light": "#EDE9FE",
          pink: "#EC4899",
          "pink-light": "#FCE7F3",
          yellow: "#F59E0B",
          "yellow-light": "#FEF3C7",
          teal: "#0D9488",
          "teal-light": "#CCFBF1",
          cream: "#FFFBF5",
          "dark": "#1E1B4B",
        },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["system-ui", "sans-serif"],
      },
      animation: {
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "bounce-slow": "bounce 2s infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-story": "linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)",
        "gradient-page": "linear-gradient(180deg, #FFFBF5 0%, #FDF4FF 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
