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
        obsidian: {
          DEFAULT: '#09090b',
          surface: '#121215',
          elevated: '#18181b',
          card: '#1f1f23',
          border: '#27272a',
          'border-highlight': '#3f3f46',
        },
        forensic: {
          blue: '#3b82f6',
          'blue-light': '#60a5fa',
          amber: '#f59e0b',
          'amber-light': '#fbbf24',
          emerald: '#10b981',
          'emerald-light': '#34d399',
          red: '#ef4444',
          'red-light': '#f87171',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px -5px rgba(59, 130, 246, 0.4)',
        'glow-amber': '0 0 20px -5px rgba(245, 158, 11, 0.4)',
      }
    },
  },
  plugins: [],
}
