/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFBF7',
          100: '#FDF6F0',
          200: '#FAEDE3',
          300: '#F5E0D0',
        },
        mocha: {
          50: '#F9F6F3',
          100: '#EDE6DE',
          200: '#D9CABD',
          300: '#BFA691',
          400: '#A68B74',
          500: '#8B7355',
          600: '#6B5742',
          700: '#4A3D2E',
          800: '#2E251C',
          900: '#1A1510',
        },
        blush: {
          50: '#FEF5F5',
          100: '#FCE8E8',
          200: '#F9D5D5',
          300: '#F2A8A8',
          400: '#E87E7E',
          500: '#D85A5A',
        },
        sage: {
          50: '#F4F7F4',
          100: '#E3EBE3',
          200: '#C7D8C7',
          300: '#9EBF9E',
          400: '#76A376',
          500: '#5A855A',
        },
        ocean: {
          50: '#F0F6FA',
          100: '#D9EBF5',
          200: '#B0D7EB',
          300: '#7FBFDF',
          400: '#4BA3D0',
          500: '#2E8BC0',
        },
        gold: {
          100: '#FFF8E1',
          200: '#FFEDB0',
          300: '#FFE07A',
          400: '#FFD54F',
          500: '#FFC928',
        }
      },
      fontFamily: {
        sans: ['"SF Pro Display"', '"Inter"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', '"Noto Serif SC"', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 4px 20px -4px rgba(107, 87, 66, 0.08)',
        'soft-lg': '0 12px 40px -8px rgba(107, 87, 66, 0.12)',
        'inner-soft': 'inset 0 2px 8px rgba(107, 87, 66, 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
