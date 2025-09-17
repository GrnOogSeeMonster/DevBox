/**** Tailwind Config ****/
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6b8afd',
          muted: '#a1b4ff'
        }
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.06)'
      },
      borderRadius: {
        xl: '14px'
      }
    }
  },
  plugins: []
};
