/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terracota: {
          50:  '#fdf4ee',
          100: '#fae4d0',
          200: '#f5c89e',
          300: '#eea66b',
          400: '#e88742',
          500: '#E07A3A',
          600: '#c5602b',
          700: '#a44826',
          800: '#853a25',
          900: '#6d3221',
        },
        concreto: {
          50:  '#f5f5f5',
          100: '#ebebeb',
          200: '#d6d6d6',
          300: '#b8b8b8',
          400: '#8f8f8f',
          500: '#6b6b6b',
          600: '#4A4A4A',
          700: '#3d3d3d',
          800: '#2e2e2e',
          900: '#1f1f1f',
        },
        sustenta: {
          600: '#2E7D32',
          500: '#388E3C',
          400: '#4CAF50',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

