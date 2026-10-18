import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        saraya: {
          bg: "#F5F5F7",
          surface: "#FFFFFF",
          primary: "#147A4B",
          text: "#1D1D1F",
          secondary: "#6E6E73",
          border: "#E5E5E7",
          error: "#DC2626"
        }
      }
    }
  },
  plugins: []
};

export default config;
