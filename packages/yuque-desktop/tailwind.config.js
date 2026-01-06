/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // macOS System Font Stack
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Helvetica Neue',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          'SF Mono',
          'Monaco',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      },
      // Colors using CSS variables for theme support
      colors: {
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          active: 'var(--color-accent-active)'
        },
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          sidebar: 'var(--color-bg-sidebar)'
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)'
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
          focus: 'var(--color-border-focus)'
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)'
      },
      // macOS Spacing Scale
      spacing: {
        'sidebar': '240px',
        'titlebar': '52px'
      },
      // macOS Border Radius
      borderRadius: {
        'mac-sm': '4px',
        'mac-md': '6px',
        'mac-lg': '8px',
        'mac-xl': '10px'
      },
      // macOS Shadows
      boxShadow: {
        'mac-sm': 'var(--shadow-sm)',
        'mac-md': 'var(--shadow-md)',
        'mac-lg': 'var(--shadow-lg)',
        'mac-focus': 'var(--shadow-focus)'
      },
      // macOS Animations
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        }
      },
      // macOS Transitions
      transitionTimingFunction: {
        'mac': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms'
      }
    }
  },
  plugins: []
}
