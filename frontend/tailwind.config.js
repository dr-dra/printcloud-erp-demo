import flowbite from 'flowbite/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/flowbite/**/*.js',
    './node_modules/flowbite-react/lib/**/*.js',
  ],
  theme: {
    extend: {
      spacing: {
        53: '212px', // Panel width (extra compact)
        65: '260px', // Rail (48px) + Panel (212px) = 260px
      },
      width: {
        53: '212px',
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#236bb4',
          600: '#1e5a96',
          700: '#1a4c7a',
          800: '#163d5e',
          900: '#123042',
          950: '#0c1e26',
        },
      },
      fontFamily: {
        body: [
          'var(--font-montserrat)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
        ],
        sans: [
          'var(--font-montserrat)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
        ],
        inter: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [flowbite],
  darkMode: 'class',
};
