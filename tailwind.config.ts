import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D1D1D1',
          300: '#ABABAB',
          400: '#858585',
          500: '#5F5F5F',
          600: '#3D3D3D',
          700: '#2B2B2B',
          800: '#1A1A1A',
          900: '#111111',
        },
      },
    },
  },
  plugins: [],
}
export default config
