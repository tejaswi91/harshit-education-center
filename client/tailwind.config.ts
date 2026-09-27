import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#081d3a',
        royal: '#1554d3',
        gold: '#ffc928',
        ink: '#10213b',
        mist: '#f5f8fc'
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], display: ['Manrope', 'Inter', 'sans-serif'] },
      boxShadow: { soft: '0 18px 50px rgba(8, 29, 58, .10)' }
    }
  },
  plugins: []
} satisfies Config;
