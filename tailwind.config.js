/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bgPrimary: "#0D0A06",
        bgCard: "#161009",
        bgCardHover: "#1E1610",
        borderTheme: "#2E1F0A",
        borderGlow: "#92400E",
        gold: "#F59E0B",
        goldLight: "#FCD34D",
        goldDark: "#B45309",
        textPrimary: "#FFF5E4",
        textSecondary: "#C4B89A",
        textMuted: "#7C6A4F",
        success: "#10B981",
        danger: "#EF4444",
        pending: "#F59E0B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
