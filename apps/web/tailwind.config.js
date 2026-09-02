/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--primary-color)',
          accent: 'var(--primary-accent)',
          dark: 'var(--primary-dark)',
        },
      },
    },
  },
  plugins: [],
};
