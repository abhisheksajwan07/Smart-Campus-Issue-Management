/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#232323", soft: "#3A3A3A", mute: "#86857F", line: "#E4E2DC" },
        sun: { DEFAULT: "#F5CF4E", soft: "#FBEFB8", deep: "#D9A916" },
        paper: { DEFAULT: "#F4F3EF", warm: "#FBF5DC" },
        alarm: { DEFAULT: "#E0563F", soft: "#FBE3DE" },
        leaf: { DEFAULT: "#3E8E5E", soft: "#DDEFE3" },
      },
      borderRadius: { "4xl": "2rem", "5xl": "2.5rem" },
      boxShadow: { card: "0 1px 2px rgba(35,35,35,.04), 0 8px 24px -12px rgba(35,35,35,.12)" },
    },
  },
  plugins: [],
};
