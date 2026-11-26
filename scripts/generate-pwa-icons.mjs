/**
 * Gera public/pwa-icon-192.png e public/pwa-icon-512.png a partir do traçado do
 * favicon.svg (logo "L" em gradiente âmbar sobre fundo #0F1013), sem dependências:
 * rasterização manual do path + encoder PNG via zlib nativo do Node.
 *
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Gera os ícones PWA em public/ (idempotente: pula os que já existem).
 * Chamado pelo vite.config.ts no buildStart e disponível via CLI.
 */
export function generatePwaIcons() {
  if (
    existsSync(join(root, 'public', 'pwa-icon-192.png')) &&
    existsSync(join(root, 'public', 'pwa-icon-512.png')) &&
    existsSync(join(root, 'public', 'pwa-icon-192-maskable.png')) &&
    existsSync(join(root, 'public', 'pwa-icon-512-maskable.png'))
  ) {
    return
  }
  renderAll()
}

// Gradiente diagonal (#FBBF24 → #F59E0B → #C2410C) igual ao favicon.svg
function gradient(x, y) {
  const t = (x + y) / 2 // 0..1 no quadrado unitário (diagonal principal)
  if (t < 0.55) {
    const k = t / 0.55
    return [
      Math.round(0xfb + (0xf9 - 0xfb) * k),
      Math.round(0xbf + (0x9e - 0xbf) * k),
      Math.round(0x24 + (0x0b - 0x24) * k),
    ]
  }
  const k = (t - 0.55) / 0.45
  return [
    Math.round(0xf9 + (0xc2 - 0xf9) * k),
    Math.round(0x9e + (0x41 - 0x9e) * k),
    Math.round(0x0b + (0x0c - 0x0b) * k),
  ]
}

// Traçado do "L" em coordenadas do viewBox 100x100, com os dois recortes (even-odd):
//   contorno: (18,12) (46,12) (46,56) (86,56) (74,90) (18,90)
//   recorte1: (46,12) (58,32) (58,56) (46,56)
//   recorte2: (58,32) (86,56) (74,90)? — segue o desenho original: triângulo sup. direito
const OUTER = [
  [18, 12],
  [46, 12],
  [46, 56],
  [86, 56],
  [74, 90],
  [18, 90],
]
const CUT1 = [
  [46, 12],
  [58, 32],
  [58, 56],
  [46, 56],
]
const CUT2 = [
  [58, 32],
  [86, 56],
  [74, 90],
  [58, 56],
]
const POLYS = [OUTER, CUT1, CUT2]

function pointInPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function insideLogo(px, py) {
  // px, py em unidades do viewBox 100x100
  let winding = 0
  for (const poly of POLYS) if (pointInPoly(px, py, poly)) winding++
  return winding % 2 === 1 // even-odd
}

function renderIcon(size, { maskable = false } = {}) {
  const scale = size / 100
  const w = Buffer.alloc(4 * size * size)
  // Maskable: a arte inteira (incluindo o "L") encolhe para a safe zone central
  // (círculo de 80% do tamanho); o fundo ocupa o quadro inteiro, sem cantos
  // transparentes. Sem maskable: arte cheia com cantos arredondados.
  const artScale = maskable ? scale * 0.8 : scale
  const artOffset = maskable ? (size - 100 * artScale) / 2 : 0
  const cornerRadius = maskable ? 0 : 22 * scale
  const radiusSq = cornerRadius * cornerRadius
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4
      // fundo #0F1013 com cantos arredondados (fora do raio = transparente)
      const cx = Math.min(Math.max(px + 0.5, cornerRadius), size - cornerRadius)
      const cy = Math.min(Math.max(py + 0.5, cornerRadius), size - cornerRadius)
      const dx = px + 0.5 - cx
      const dy = py + 0.5 - cy
      // Dentro do retângulo central (entre os dois raios) é sempre interno; nos
      // cantos, decide pela distância ao centro do arco.
      const inCentralX = cx === px + 0.5
      const inCentralY = cy === py + 0.5
      const insideRounded = maskable || inCentralX || inCentralY || dx * dx + dy * dy <= radiusSq
      if (!insideRounded) {
        w[idx] = 0
        w[idx + 1] = 0
        w[idx + 2] = 0
        w[idx + 3] = 0
        continue
      }
      if (insideLogo((px + 0.5 - artOffset) / artScale, (py + 0.5 - artOffset) / artScale)) {
        const [r, g, b] = gradient((px + 0.5) / size, (py + 0.5) / size)
        w[idx] = r
        w[idx + 1] = g
        w[idx + 2] = b
        w[idx + 3] = 255
      } else {
        w[idx] = 0x0f
        w[idx + 1] = 0x10
        w[idx + 2] = 0x13
        w[idx + 3] = 255
      }
    }
  }

  // --- PNG encode (RGB8 + alpha via color type 6) ---
  const crcTable = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })()
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeBuf = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
    return Buffer.concat([len, typeBuf, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtro none
    w.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function renderAll() {
  mkdirSync(join(root, 'public'), { recursive: true })
  for (const size of [192, 512]) {
    const png = renderIcon(size)
    writeFileSync(join(root, 'public', `pwa-icon-${size}.png`), png)
    console.log(`gerado public/pwa-icon-${size}.png (${png.length} bytes)`)
  }
  // Variante maskable: arte com margem de segurança de 10% (safe zone) e fundo opaco.
  for (const size of [192, 512]) {
    const png = renderIcon(size, { maskable: true })
    writeFileSync(join(root, 'public', `pwa-icon-${size}-maskable.png`), png)
    console.log(`gerado public/pwa-icon-${size}-maskable.png (${png.length} bytes)`)
  }
}

// Execução direta via CLI: node scripts/generate-pwa-icons.mjs
const invokedAsCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedAsCli) {
  generatePwaIcons()
}
