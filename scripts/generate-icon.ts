// Génère build/icon.png (512×512) à partir du logo pixel-art partagé.
// Usage : npx tsx scripts/generate-icon.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { LOGO_PALETTE, LOGO_PIXELS } from '../src/shared/logo'

const SIZE = 512
const CELL = SIZE / LOGO_PIXELS.length

function crc32(buf: Buffer): number {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return ~crc >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1)
  raw[row] = 0 // filtre PNG « None »
  for (let x = 0; x < SIZE; x++) {
    const key = LOGO_PIXELS[Math.floor(y / CELL)][Math.floor(x / CELL)]
    const hex = LOGO_PALETTE[key]
    const offset = row + 1 + x * 4
    if (!hex) continue
    raw[offset] = parseInt(hex.slice(1, 3), 16)
    raw[offset + 1] = parseInt(hex.slice(3, 5), 16)
    raw[offset + 2] = parseInt(hex.slice(5, 7), 16)
    raw[offset + 3] = 255
  }
}

const header = Buffer.alloc(13)
header.writeUInt32BE(SIZE, 0)
header.writeUInt32BE(SIZE, 4)
header[8] = 8 // 8 bits par canal
header[9] = 6 // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = join(import.meta.dirname, '..', 'build', 'icon.png')
mkdirSync(join(out, '..'), { recursive: true })
writeFileSync(out, png)
console.log(`Icône écrite : ${out}`)
