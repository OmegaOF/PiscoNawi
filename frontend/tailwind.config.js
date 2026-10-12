/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary / CTA (Rojo tinto)
        'rojo-tinto': '#7A1E2B',
        // Secondary / Sidebar BG (Caki)
        'caki': '#C6B38E',
        // Neutral colors
        'neutral-bg': '#F6F5F2',
        'neutral-border': '#E7E2D8',
        'text-dark': '#1E1E1E',
        'text-muted': '#6B6B6B',
        vino: '#6B1F2B',
        beige: '#F5F0E6',
        // Niveles de smog (estado)
        'smog-alto': '#C0392B',
        'smog-moderado': '#D98E04',
        'smog-bajo': '#1E8F6E',
        'smog-sin': '#9AA0A6',
        // Modo presentación
        pres: {
          bg: '#1C1517',
          card: '#241B1E',
          border: '#3A2A2E',
          text: '#F3EDE7',
          muted: '#A89EA0',
        },
        // Legacy colors (for backward compatibility)
        primary: {
          beige: '#F5F0E6',
          vino: '#6B1F2B',
        },
      },
      backgroundColor: {
        'beige': '#F5F0E6',
        'vino': '#6B1F2B',
        'rojo-tinto': '#7A1E2B',
        'caki': '#C6B38E',
        'neutral-bg': '#F6F5F2',
      },
      textColor: {
        'vino': '#6B1F2B',
        'rojo-tinto': '#7A1E2B',
        'caki': '#C6B38E',
        'text-dark': '#1E1E1E',
        'text-muted': '#6B6B6B',
      },
      borderColor: {
        'neutral-border': '#E7E2D8',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite linear',
      },
    },
  },
  plugins: [],
}