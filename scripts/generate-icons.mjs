// Generuje ikony PWA z jednego motywu SVG (słońce + fale oceanu).
// Uruchomienie: npm run icons  (wynik trafia do public/)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
mkdirSync(pub, { recursive: true })

// scale < 1 zmniejsza motyw do strefy bezpiecznej ikon maskowalnych
const svg = ({ rounded, scale = 1 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#1e40af"/>
    </linearGradient>
    <clipPath id="clip"><rect width="512" height="512" rx="${rounded ? 100 : 0}"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="512" height="512" fill="url(#bg)"/>
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      <circle cx="352" cy="148" r="84" fill="#fbbf24"/>
      <g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-width="34">
        <path d="M-36 332 Q 28 288 92 332 T 220 332 T 348 332 T 476 332 T 604 332" opacity="0.95"/>
        <path d="M-100 416 Q -36 372 28 416 T 156 416 T 284 416 T 412 416 T 540 416" opacity="0.7"/>
      </g>
    </g>
  </g>
</svg>`

const render = (options, size, file) =>
  sharp(Buffer.from(svg(options))).resize(size, size).png().toFile(join(pub, file))

writeFileSync(join(pub, 'favicon.svg'), svg({ rounded: true }))
await Promise.all([
  render({ rounded: true }, 192, 'icon-192.png'),
  render({ rounded: true }, 512, 'icon-512.png'),
  render({ rounded: false, scale: 0.78 }, 512, 'icon-512-maskable.png'),
  render({ rounded: false, scale: 0.9 }, 180, 'apple-touch-icon.png'),
])
console.log('Ikony wygenerowane w public/')
