/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        theme: {
          tan: "#C4714A",
          cream: "#FAF7F2",
          green: "#4F7B55",
          dark: "#2D231E",
          muted: "#6B5E55",
          border: "#E8DFD5",
          card: "#FFFFFF",
          peach: "#F4ECE2",
        },
        primary: {
          50: "#FBF6F2",
          100: "#F6ECE4",
          200: "#ECCDBE",
          300: "#DFAC93",
          400: "#D28B68",
          500: "#C4714A", // User TAN
          600: "#B05E38",
          700: "#944C2B",
          800: "#753B21",
          900: "#5A2D19",
        },
        sage: {
          50: "#F2F6F3",
          100: "#E4EDE5",
          200: "#CADBCB",
          300: "#A4C0A7",
          400: "#789F7D",
          500: "#4F7B55", // User GREEN
          600: "#3F6444",
          700: "#324F36",
          800: "#273E2B",
          900: "#1D2F20",
        },
        cream: {
          50: "#FFFFFF",
          100: "#FAF7F2", // User WHITE
          200: "#F5EFE6",
          300: "#EFE6D9",
          400: "#E3D5C1",
          500: "#D2BEA3",
        },
      },
      minHeight: {
        "tap": "56px",
      },
      minWidth: {
        "tap": "56px",
      },
    },
  },
  plugins: [],
}
