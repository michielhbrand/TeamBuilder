import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const nodeModules = join(root, 'node_modules')
const target = join(root, 'public', 'ocr')

const assets = [
  ['tesseract.js', 'dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core', 'tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core', 'tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
  ['tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core', 'tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  [
    'tesseract.js-core',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ],
  [
    'tesseract.js-core',
    'tesseract-core-relaxedsimd-lstm.wasm',
    'tesseract-core-relaxedsimd-lstm.wasm',
  ],
  ['@tesseract.js-data/eng', '4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]

await mkdir(target, { recursive: true })

for (const [pkg, from, to] of assets) {
  await copyFile(join(nodeModules, pkg, from), join(target, to))
}

console.log(`Copied ${assets.length} OCR assets to public/ocr.`)
