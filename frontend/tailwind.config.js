/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'rgba(255,255,255,0.06)',
        ring: 'rgba(124,58,237,0.5)',
        background: '#0D0D0D',
        foreground: '#fafafa',
        primary: { DEFAULT: '#7c3aed', foreground: '#ffffff' },
        secondary: { DEFAULT: '#1a1025', foreground: '#c4b5fd' },
        muted: { DEFAULT: '#1c1917', foreground: '#a8a29e' },
        accent: { DEFAULT: '#a855f7', foreground: '#faf5ff' },
        destructive: { DEFAULT: '#dc2626', foreground: '#fecaca' },
        card: { DEFAULT: 'rgba(255,255,255,0.03)', foreground: '#fafafa' },
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
