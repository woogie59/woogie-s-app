/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'coach-bg': '#0f1115',
        'coach-gold': {
          500: '#d4af37',
          300: '#f9e5af',
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #d4af37, #f9e5af)',
      },
    },
  },
  plugins: [typography],
}

