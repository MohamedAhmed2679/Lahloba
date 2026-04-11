import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { teal: { 700: '#0F766E' }, amber: { 500: '#F59E0B' }, coral: { 500: '#F43F5E' }, lime: { 500: '#65A30D' } },
      borderRadius: { '2xl': '18px' },
      fontFamily: { cairo: ['Cairo', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
