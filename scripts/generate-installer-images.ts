// Génère les images de l'installeur Windows (build/installer/logo-<case>.bmp) à partir du logo pixel-art partagé :
// le logo sur le fond sombre de l'application, avec un léger halo vert. Une image par taille de case (4 à 12 pixels),
// pour qu'il reste net à toutes les mises à l'échelle de Windows (100 % = cases de 4 pixels, logo de 64 pixels).
// Lancé par `npm run build:win` ; les fichiers produits ne sont pas versionnés.
// Usage : npx tsx scripts/generate-installer-images.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOGO_PALETTE, LOGO_PIXELS } from '../src/shared/logo'

/** Fond des fenêtres de l'installeur (ink-900 de l'application). */
const BACKGROUND = [0x0a, 0x0d, 0x12]
/** Couleur du halo (grass-500) et son opacité au centre. */
const GLOW = [0x5c, 0xb3, 0x38]
const GLOW_ALPHA = 0.32
/** Marge autour du logo, en cases : la place du halo. */
const MARGIN = 4

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** BMP 24 bits (lignes de bas en haut, complétées à un multiple de 4 octets). */
function bmp(width: number, height: number, pixel: (x: number, y: number) => number[]): Buffer {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const data = Buffer.alloc(rowSize * height)
  for (let y = 0; y < height; y++) {
    const row = (height - 1 - y) * rowSize
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y)
      data[row + x * 3] = b
      data[row + x * 3 + 1] = g
      data[row + x * 3 + 2] = r
    }
  }
  const header = Buffer.alloc(54)
  header.write('BM', 0, 'ascii')
  header.writeUInt32LE(54 + data.length, 2)
  header.writeUInt32LE(54, 10)
  header.writeUInt32LE(40, 14)
  header.writeInt32LE(width, 18)
  header.writeInt32LE(height, 22)
  header.writeUInt16LE(1, 26)
  header.writeUInt16LE(24, 28)
  header.writeUInt32LE(data.length, 34)
  header.writeInt32LE(2835, 38) // 72 ppp
  header.writeInt32LE(2835, 42)
  return Buffer.concat([header, data])
}

const outDir = join(import.meta.dirname, '..', 'build', 'installer')
mkdirSync(outDir, { recursive: true })

const grid = LOGO_PIXELS.length
for (let cell = 4; cell <= 12; cell++) {
  const size = (grid + 2 * MARGIN) * cell
  const center = size / 2
  const radius = size / 2
  const image = bmp(size, size, (x, y) => {
    const gx = Math.floor(x / cell) - MARGIN
    const gy = Math.floor(y / cell) - MARGIN
    const key = gx >= 0 && gy >= 0 && gx < grid && gy < grid ? LOGO_PIXELS[gy][gx] : '.'
    const hex = LOGO_PALETTE[key]
    if (hex) return rgb(hex)
    // Halo : dégradé radial adouci, qui rejoint exactement le fond au bord de l'image.
    const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center) / radius
    const alpha = GLOW_ALPHA * Math.max(0, 1 - distance) ** 2
    return BACKGROUND.map((channel, i) => Math.round(channel + (GLOW[i] - channel) * alpha))
  })
  writeFileSync(join(outDir, `logo-${cell}.bmp`), image)
}
console.log(`Images de l'installeur écrites dans ${outDir}`)
