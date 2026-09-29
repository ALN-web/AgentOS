/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        surface: {
          DEFAULT: "#0e0c12",
          card: "#121017",
          subtle: "#181520",
          border: "rgba(255, 255, 255, 0.08)",
          borderHover: "rgba(235, 105, 32, 0.4)",
        },
        brand: {
          orange: "#eb6920",
          orangeLight: "#ff8c42",
          orangeDark: "#c44e0b",
          orangeGlow: "rgba(235, 105, 32, 0.35)",
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'orange-glow': '0 0 25px rgba(235, 105, 32, 0.45)',
        'orange-glow-sm': '0 0 15px rgba(235, 105, 32, 0.3)',
        'orange-glow-lg': '0 0 50px rgba(235, 105, 32, 0.55)',
        'card': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}
