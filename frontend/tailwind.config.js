/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0B5ED7',
        accent: '#22C55E',
        backgroundDark: '#1F2937',
        surfaceDark: '#374151',
        textDark: '#F3F4F6',
      },
    },
  },
  plugins: [],
}
