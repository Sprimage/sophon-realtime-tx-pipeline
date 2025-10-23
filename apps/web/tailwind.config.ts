import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2D7EF7',
          dark: '#1E5FCC',
        },
      },
      boxShadow: {
        card: '0 2px 10px rgba(0,0,0,0.06)'
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 200ms ease-out both'
      },
    },
  },
  plugins: [],
} satisfies Config


