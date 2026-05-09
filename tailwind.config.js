/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'coach-bg': '#FFFFFF',
        obsidian: '#050505',
        amethyst: '#9333ea',
        champagne: '#fde047',
        platinum: '#e5e7eb',
        // "Premium Performance Lab" brand accent (athletic green).
        'coach-accent': {
          500: '#059669', // emerald-600
          300: '#10b981', // emerald-500
        },
      },
      fontFamily: {
        sans: ['Urbanist', 'Pretendard', 'Noto Sans KR', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #10b981, #059669)',
      },
    },
  },
  plugins: [typography],
}

