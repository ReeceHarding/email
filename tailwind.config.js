/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    // If you installed shadcn UI components
    "./node_modules/@shadcn/ui/dist/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {}
  },
  plugins: []
} 