/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { primary: '#0F766E', secondary: '#F59E0B', error: '#F43F5E', success: '#65A30D' },
        surface: { light: '#FFFFFF', dark: '#0F172A' },
      },
      borderRadius: { card: '18px' },
      fontFamily: { cairo: ['Cairo', 'sans-serif'] },
    },
  },
  plugins: [],
};
