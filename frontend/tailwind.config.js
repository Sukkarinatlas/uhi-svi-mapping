/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './map.html', './src/**/*.{js,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans Thai', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef7ff', 100: '#d9edff', 200: '#bce0ff', 300: '#8ecdff',
          400: '#59b0ff', 500: '#328fff', 600: '#1b6ff5', 700: '#1458e1',
          800: '#1748b6', 900: '#193f8f', 950: '#142857',
        },
        heat: {
          cool: '#2b83ba', mild: '#abdda4', warm: '#fdae61', hot: '#d7191c',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.28)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
