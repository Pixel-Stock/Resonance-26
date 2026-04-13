import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#020d0a',
        bg2: '#041510',
        bg3: '#071e15',
        green: {
          DEFAULT: '#00ff88',
          dim: '#00994d',
          dark: '#004d26',
        },
        red: {
          sentinel: '#ff3355',
          dark: '#4d0010',
        },
        amber: {
          sentinel: '#ffaa00',
          dark: '#4d3300',
        },
        cyan: {
          sentinel: '#00d4ff',
          dark: '#003d4d',
        },
        text: {
          DEFAULT: '#c8ffe0',
          dim: '#5a9970',
          muted: '#2d5540',
        },
      },
      fontFamily: {
        mono: ["'Share Tech Mono'", 'Courier New', 'monospace'],
        display: ["'Orbitron'", 'monospace'],
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'scan-line': 'scan-line 3s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'typewriter': 'typewriter 0.1s steps(1) forwards',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 5px #00ff88, 0 0 10px #00ff88' },
          '50%': { boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff88, 0 0 50px #00ff8850' },
        },
        'scan-line': {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.95' },
        },
      },
      boxShadow: {
        'green-glow': '0 0 20px rgba(0, 255, 136, 0.3)',
        'red-glow': '0 0 20px rgba(255, 51, 85, 0.3)',
        'amber-glow': '0 0 20px rgba(255, 170, 0, 0.3)',
      },
    },
  },
  plugins: [],
}

export default config
