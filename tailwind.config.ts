import type { Config } from 'tailwindcss'
export default { content: ['./src/**/*.{ts,tsx}'], darkMode: 'class', theme: { extend: { fontFamily: { sans: ['var(--font-sans)', 'sans-serif'], display: ['var(--font-display)', 'serif'] }, colors: { ink: '#171a18', cream: '#f6f7f2', lime: '#d8fb72', forest: '#14382d' } } }, plugins: [] } satisfies Config
