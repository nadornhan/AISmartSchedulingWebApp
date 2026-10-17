import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-geist)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      fontSize: {
        sm: ['15px', { lineHeight: '1.4rem' }],
      },
      colors: {
        dashboard: {
          bg: 'rgb(var(--dashboard-bg-rgb) / <alpha-value>)',
          surface: 'rgb(var(--dashboard-surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--dashboard-surface-raised-rgb) / <alpha-value>)',
          border: 'var(--dashboard-border)',
          'border-strong': 'var(--dashboard-border-strong)',
          text: 'rgb(var(--dashboard-text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--dashboard-muted-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--dashboard-subtle-rgb) / <alpha-value>)',
          accent: 'rgb(var(--dashboard-accent-rgb) / <alpha-value>)',
          'accent-strong': 'rgb(var(--dashboard-accent-strong-rgb) / <alpha-value>)',
          'accent-soft': 'var(--dashboard-accent-soft)',
          'on-accent': 'var(--text-on-accent)',
          'on-accent-inverse': 'var(--text-on-accent-inverse)',
          overlay: 'var(--overlay)',
          'overlay-soft': 'var(--overlay-soft)',
          danger: 'rgb(var(--dashboard-danger-rgb) / <alpha-value>)',
          warning: 'rgb(var(--dashboard-warning-rgb) / <alpha-value>)',
          info: 'rgb(var(--dashboard-info-rgb) / <alpha-value>)',
        },
      },
      // Text/borders use accessible accent ink; fills retain the vivid brand green.
      backgroundColor: {
        'dashboard-accent': 'rgb(var(--accent-fill-rgb) / <alpha-value>)',
        'dashboard-accent-strong': 'rgb(var(--accent-fill-strong-rgb) / <alpha-value>)',
      },
      gradientColorStops: {
        'dashboard-accent': 'rgb(var(--accent-fill-rgb) / <alpha-value>)',
        'dashboard-accent-strong': 'rgb(var(--accent-fill-strong-rgb) / <alpha-value>)',
      },
      boxShadow: {
        glow: 'var(--shadow-glow)',
        panel: 'var(--shadow-panel)',
        modal: 'var(--shadow-modal)',
        popover: 'var(--shadow-popover)',
      },
    },
  },
  plugins: [],
};

export default config;
