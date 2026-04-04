/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'rgba(255,255,255,0.06)',
        ring: 'rgba(232,149,109,0.5)',
        background: '#0D0D0D',
        foreground: '#fafafa',
        primary: { DEFAULT: '#E8956D', foreground: '#ffffff' },
        secondary: { DEFAULT: '#1C1510', foreground: '#E8C5A8' },
        muted: { DEFAULT: '#1c1917', foreground: '#a8a29e' },
        accent: { DEFAULT: '#D07A54', foreground: '#FDE8D8' },
        destructive: { DEFAULT: '#dc2626', foreground: '#fecaca' },
        card: { DEFAULT: 'rgba(255,255,255,0.03)', foreground: '#fafafa' },
        // Initia warm coral palette — overrides Tailwind's violet
        violet: {
          100: '#FDE8D8',
          200: '#F5CDB0',
          300: '#F0B994',
          400: '#E8A37C',
          500: '#E8956D',
          600: '#D07A54',
          700: '#B5653F',
          800: '#8C4E30',
          900: '#5C3521',
          950: '#1A110C',
        },
        // Initia deeper warm — overrides Tailwind's indigo
        indigo: {
          100: '#FADDC8',
          200: '#E8C5A8',
          300: '#D4A882',
          400: '#C09068',
          500: '#A87A56',
          600: '#8C6544',
          700: '#6E4F34',
          800: '#523A26',
          900: '#38271A',
          950: '#140E09',
        },
        // Warm complement for fuchsia
        fuchsia: {
          600: '#C06040',
        },
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulse_glow: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'fade-up': 'fade-up 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        pulse_glow: 'pulse_glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
