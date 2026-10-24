import type { Config } from 'tailwindcss'

/**
 * Design tokens from docs/DESIGN.md. The palette replaces Tailwind's default one on purpose:
 * only the colours of the charter are available in class names.
 */
const colors = {
  transparent: 'transparent',
  current: 'currentColor',
  white: '#FFFFFF',
  navy: { 900: '#0A1433', 800: '#132A6B' },
  royal: { 700: '#17338F', 600: '#1F4FD8', 500: '#3B6CF6', 50: '#E6EEFF' },
  cyan: { 500: '#0EA5C6', 400: '#22C3D6' },
  aqua: { 300: '#5EEAD4', 50: '#E3FAF5', ink: '#0F4C45' },
  amber: { 500: '#E0922F', 50: '#FCF1E3', ink: '#8A4B08' },
  red: { 600: '#C2272D', 50: '#FDECEC', ink: '#A3161C', field: '#D92D20' },
  ink: { 900: '#141B2D', 600: '#3A4560', 500: '#586380' },
  line: {
    DEFAULT: '#E1E6EF',
    strong: '#D4DBE8',
    hover: '#9DAECB',
    faint: 'rgba(15,30,70,0.05)',
    soft: 'rgba(15,30,70,0.08)',
  },
  bg: { DEFAULT: '#EEF2F8', halo: '#D6E7FA' },
  // Neutral surfaces used throughout the mock-ups.
  surface: {
    field: '#F7F9FC',
    rail: '#EDF2F9',
    mist: '#F3F7FC',
    hover: '#EEF4FF',
    panel: '#F3F5F9',
  },
  // Light blues used on dark backgrounds (sidebar, splash).
  nav: { text: '#D3DEF7', soft: '#C7D6FB', muted: '#9DB4E8' },
} as const

const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    colors,
    fontFamily: {
      sans: ['"Figtree Variable"', 'Figtree', 'system-ui', 'sans-serif'],
      // System fonts only (offline): used for the recovery key.
      mono: ['"Cascadia Mono"', 'Consolas', 'ui-monospace', 'monospace'],
    },
    extend: {
      fontSize: {
        title: ['28px', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '800' }],
        section: ['17px', { lineHeight: '1.3', fontWeight: '800' }],
        body: ['15px', { lineHeight: '1.5' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '600' }],
        small: ['12px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        control: '12px',
        card: '20px',
        'card-lg': '22px',
        pill: '999px',
      },
      boxShadow: {
        card: 'inset 0 1px 0 #fff, 0 1px 2px rgba(15,30,70,.06), 0 16px 36px -18px rgba(15,30,70,.25)',
        primary: 'inset 0 1px 0 rgba(255,255,255,.25), 0 10px 22px -10px rgba(31,79,216,.8)',
        danger: 'inset 0 1px 0 rgba(255,255,255,.25), 0 10px 20px -10px rgba(194,39,45,.9)',
        'primary-hover':
          'inset 0 1px 0 rgba(255,255,255,.25), 0 16px 30px -10px rgba(31,79,216,.75)',
        secondary: 'inset 0 1px 0 #fff, 0 4px 10px -6px rgba(15,30,70,.3)',
        'secondary-hover': '0 12px 24px -12px rgba(15,30,70,.35), inset 0 1px 0 #fff',
        field: 'inset 0 1px 2px rgba(15,30,70,.06)',
        'focus-field': '0 0 0 4px rgba(31,79,216,.16)',
        'focus-error': '0 0 0 4px rgba(217,45,32,.12)',
        rail: 'inset 0 2px 4px rgba(15,30,70,.1)',
        toast: 'inset 0 1px 0 rgba(255,255,255,.15), 0 20px 40px -16px rgba(6,14,40,.7)',
        nav: '8px 0 30px -12px rgba(6,14,40,.5)',
        'nav-active': 'inset 0 1px 0 rgba(255,255,255,.22), 0 10px 20px -8px rgba(0,0,0,.55)',
      },
      backgroundImage: {
        primary: 'linear-gradient(180deg, #3B6CF6, #1F4FD8)',
        secondary: 'linear-gradient(180deg, #FFFFFF, #F0F4FA)',
        danger: 'linear-gradient(180deg, #E5484D, #C2272D)',
        sidebar: 'linear-gradient(180deg, #132A6B 0%, #0A1433 100%)',
        app: 'radial-gradient(1100px 520px at 25% -10%, #D6E7FA 0%, rgba(214,231,250,0) 62%)',
        hero: 'linear-gradient(135deg, #2B5BE8 0%, #17338F 100%)',
        toast: 'linear-gradient(180deg, #17338F, #132A6B)',
        logo: 'linear-gradient(145deg, #22C3D6, #1F4FD8)',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(.2,.8,.2,1)',
      },
      transitionDuration: {
        micro: '250ms',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(16px) scale(.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        pulse: {
          '0%': { boxShadow: '0 0 0 0 rgba(94,234,212,.65)' },
          '100%': { boxShadow: '0 0 0 9px rgba(94,234,212,0)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        rise: 'rise .6s cubic-bezier(.2,.8,.2,1) both',
        pulse: 'pulse 2.4s ease-out infinite',
        spin: 'spin .8s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
