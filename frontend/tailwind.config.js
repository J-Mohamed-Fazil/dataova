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
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0b193d',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#334155',
          800: '#1e293b',
          850: '#131f37',
          900: '#0b1528',
          950: '#060d1f',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-brand': '0 0 30px -4px rgba(37, 99, 235, 0.55), 0 0 15px -2px rgba(37, 99, 235, 0.4)',
        'glow-blue': '0 0 30px -4px rgba(59, 130, 246, 0.55), 0 0 15px -2px rgba(59, 130, 246, 0.4)',
        'glow-emerald': '0 0 30px -4px rgba(16, 185, 129, 0.55)',
        'glow-cyan': '0 0 30px -4px rgba(6, 182, 212, 0.55), 0 0 15px -2px rgba(6, 182, 212, 0.4)',
        'glass-card': '0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)',
        'glass-panel': '0 12px 40px 0 rgba(0, 0, 0, 0.7), inset 0 1px 2px 0 rgba(255, 255, 255, 0.1)',
        'premium-hover': '0 15px 35px -5px rgba(37, 99, 235, 0.4), 0 0 20px -2px rgba(6, 182, 212, 0.3)',
      },
      lineHeight: {
        'relaxed-reading': '1.68',
      },
      spacing: {
        '0.2': '2px',
        '4.5': '1.125rem',
      },
      animation: {
        'pulse-slow': 'pulse-gentle 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow 3s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-gentle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 20px -5px rgba(6, 182, 212, 0.4)' },
          '100%': { boxShadow: '0 0 35px 5px rgba(6, 182, 212, 0.6)' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-premium': 'linear-gradient(to right, #0ea5e9, #2563eb, #4f46e5)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
      }
    },
  },
  plugins: [],
}
