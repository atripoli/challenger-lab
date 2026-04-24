/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef4ff',
          100: '#dbe8ff',
          500: '#3b62f6',
          600: '#2f4fd4',
          700: '#253fab',
        },
      },
    },
  },
  plugins: [],
};
