/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'coach-bg': '#FFFFFF',
        // "Premium Performance Lab" brand accent (athletic green).
        'coach-accent': {
          500: '#059669', // emerald-600
          300: '#10b981', // emerald-500
        },
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #10b981, #059669)',
      },
    },
  },
  plugins: [typography],
}

