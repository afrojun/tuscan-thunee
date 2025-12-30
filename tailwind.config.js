/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a4d2e',
          dark: '#0f2d1a',
          light: '#2d6b44',
        },
        card: {
          DEFAULT: '#f5f0e6',
          border: '#2a2a2a',
        },
        retro: {
          red: '#c23a3a',
          black: '#1a1a1a',
          gold: '#d4a847',
          cream: '#f5f0e6',
        },
      },
      fontFamily: {
        retro: ['"Press Start 2P"', 'monospace'],
        mono: ['"VT323"', 'monospace'],
      },
      boxShadow: {
        'retro': '4px 4px 0px #000',
        'retro-sm': '2px 2px 0px #000',
      },
    },
  },
  plugins: [],
}
