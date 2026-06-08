/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hhf: {
          blue:       '#1a5fa8',
          'blue-light':'#2171c7',
          'blue-pale': '#e8f1fb',
          'blue-mid':  '#b8d4f5',
          green:      '#2e7d32',
          'green-pale':'#e8f5e9',
          red:        '#e53935',
          gold:       '#f5a623',
        },
      },
      fontFamily: {
        sans:  ['DM Sans', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
      },
    },
  },
  plugins: [],
}
