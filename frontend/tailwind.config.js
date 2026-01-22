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
    },
  },
  plugins: [],
}