/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: 'var(--primary-color, #22c55e)',
          600: 'var(--primary-accent, #16a34a)',
          700: 'var(--primary-dark, #15803d)',
        },
      },
    },
  },
  plugins: [],
};
