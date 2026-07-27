import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
          danger: 'rgb(var(--dashboard-danger-rgb) / <alpha-value>)',
          warning: 'rgb(var(--dashboard-warning-rgb) / <alpha-value>)',
          info: 'rgb(var(--dashboard-info-rgb) / <alpha-value>)',
        },
      },
      boxShadow: {
        glow: '0 0 32px rgba(34, 240, 177, 0.18)',
        panel: '0 24px 80px rgba(0, 0, 0, 0.34)',
      },
    },
  },
  plugins: [],
};

export default config;
