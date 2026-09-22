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
          subtle: 'var(--brand-subtle)',
          light: 'var(--brand-light)',
          border: 'var(--brand-border)',
          text: 'var(--brand-text)',
        },
      },
    },
  },
  plugins: [],
};
