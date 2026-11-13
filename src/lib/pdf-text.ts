import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface PdfPageText {
  pageNumber: number
  text: string
  scanned: boolean
}

export interface PdfTextProgress {
  message: string
  current?: number
  total?: number
}

export interface PdfTextOptions {
  signal?: AbortSignal
  onProgress?: (progress: PdfTextProgress) => void
  onPages?: (pages: PdfPageText[], ocrUsed: boolean) => void
  shouldOcr?: (pages: PdfPageText[], text: string) => boolean
  maxOcrPages?: number
  cacheKeyPrefix?: string
  readingMessage?: string
}

export interface PdfTextResult {
  pages: PdfPageText[]
  text: string
  ocrUsed: boolean
}

export const PDF_OCR_MAX_PAGES = 3
export const MIN_PDF_TEXT_LENGTH = 120

const PDF_MAX_RENDER_WIDTH = 1700
const PDF_MAX_RENDER_SCALE = 2.5
const OCR_CACHE_DB = 'teambuilder-ocr'
const OCR_CACHE_STORE = 'pages'
const OCR_CACHE_VERSION = 1

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return pdfjs
    })
  }

  return pdfjsPromise
}

export function normalizePdfText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function combinePdfPages(pages: PdfPageText[]): string {
  return pages
    .map((page) => page.text)
    .filter(Boolean)
    .join('\n\n')
}

export function pageLooksScanned(text: string): boolean {
  return normalizePdfText(text).replace(/\s/g, '').length < 24
}

interface TextItemLike {
  str?: string
  hasEOL?: boolean
  width?: number
  transform?: number[]
}

function textFromItems(items: TextItemLike[]): string {
  let output = ''
  let lastY: number | null = null
  let lastXEnd: number | null = null

  for (const item of items) {
    if (typeof item.str !== 'string') {
      continue
    }

    if (!item.str) {
      if (item.hasEOL) {
        output += '\n'
        lastY = null
        lastXEnd = null
      }
      continue
    }

    const x = item.transform?.[4] ?? null
    const y = item.transform?.[5] ?? null
    const width = item.width ?? 0

    if (lastY !== null && y !== null) {
      if (Math.abs(y - lastY) > 1.5) {
        output += '\n'
        lastXEnd = null
      } else if (lastXEnd !== null && x !== null && x - lastXEnd > 1.5) {
        output += ' '
      }
    }

    output += item.str
    lastY = y
    lastXEnd = x !== null ? x + width : null

    if (item.hasEOL) {
      output += '\n'
      lastY = null
      lastXEnd = null
    }
  }

  return normalizePdfText(output)
}

async function readPageTexts(doc: PDFDocumentProxy, signal?: AbortSignal): Promise<PdfPageText[]> {
  const pages: PdfPageText[] = []

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    throwIfAborted(signal)
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = textFromItems(content.items as TextItemLike[])

    pages.push({ pageNumber, text, scanned: pageLooksScanned(text) })
  }

  return pages
}

function ocrAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  const relative = `${base}ocr/${path}`

  if (typeof window === 'undefined') {
    return relative
  }

  return new URL(relative, window.location.origin).href
}

export async function fingerprintPdf(buffer: Uint8Array): Promise<string | null> {
  if (!globalThis.crypto?.subtle) {
    return null
  }

  try {
    const copy = new Uint8Array(buffer.byteLength)
    copy.set(buffer)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}

function openOcrCache(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(OCR_CACHE_DB, OCR_CACHE_VERSION)

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OCR_CACHE_STORE)) {
        request.result.createObjectStore(OCR_CACHE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function readOcrCache(key: string): Promise<Record<number, string> | null> {
  const db = await openOcrCache()

  if (!db) {
    return null
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(OCR_CACHE_STORE, 'readonly')
    const request = transaction.objectStore(OCR_CACHE_STORE).get(key)

    request.onsuccess = () => resolve((request.result as Record<number, string>) ?? null)
    request.onerror = () => resolve(null)
    transaction.oncomplete = () => db.close()
  })
}

async function writeOcrCache(key: string, pages: Record<number, string>): Promise<void> {
  const db = await openOcrCache()

  if (!db) {
    return
  }

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(OCR_CACHE_STORE, 'readwrite')
    transaction.objectStore(OCR_CACHE_STORE).put(pages, key)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      resolve()
    }
  })
}

function abortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The PDF import was cancelled.', 'AbortError')
  }

  const error = new Error('The PDF import was cancelled.')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortError()
  }
}

async function renderPage(doc: PDFDocumentProxy, pageNumber: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(PDF_MAX_RENDER_SCALE, PDF_MAX_RENDER_WIDTH / baseViewport.width)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))

  const context = canvas.getContext('2d')

  if (!context) {
    page.cleanup()
    throw new Error('This browser could not prepare the scanned PDF.')
  }

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    background: '#ffffff',
  }).promise

  page.cleanup()
  return canvas
}

export async function extractPdfText(
  file: Blob,
  options: PdfTextOptions = {},
): Promise<PdfTextResult> {
  throwIfAborted(options.signal)

  const pdfjs = await loadPdfjs()
  const buffer = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data: buffer })
  const doc = await loadingTask.promise
  const fingerprint = await fingerprintPdf(buffer)
  const cacheKey = fingerprint ? `${options.cacheKeyPrefix ?? ''}${fingerprint}` : null
  const maxOcrPages = options.maxOcrPages ?? PDF_OCR_MAX_PAGES

  try {
    options.onProgress?.({ message: options.readingMessage ?? 'Reading the PDF…' })
    const pages = await readPageTexts(doc, options.signal)
    throwIfAborted(options.signal)

    let ocrUsed = false
    const cachedOcr: Record<number, string> = {}

    if (cacheKey) {
      const cached = await readOcrCache(cacheKey)

      if (cached) {
        for (const page of pages) {
          const text = cached[page.pageNumber]

          if (text) {
            page.text = text
            page.scanned = false
            ocrUsed = true
            cachedOcr[page.pageNumber] = text
          }
        }
      }
    }

    options.onPages?.(
      pages.map((page) => ({ ...page })),
      ocrUsed,
    )
    let combined = combinePdfPages(pages)

    const scannedPages = pages.filter((page) => page.scanned)
    const shouldOcr = options.shouldOcr
      ? options.shouldOcr(pages, combined)
      : scannedPages.length > 0

    if (shouldOcr && scannedPages.length) {
      const targets = scannedPages.slice(0, maxOcrPages)
      options.onProgress?.({ message: 'Preparing text recognition…' })
      const { createWorker } = await import('tesseract.js')
      let worker: Awaited<ReturnType<typeof createWorker>> | null = null
      let cancelled = false
      let currentTarget = 1

      const cancel = (): void => {
        cancelled = true
        void worker?.terminate()
        worker = null
      }

      options.signal?.addEventListener('abort', cancel, { once: true })

      try {
        worker = await createWorker('eng', 1, {
          workerPath: ocrAssetUrl('worker.min.js'),
          langPath: ocrAssetUrl(''),
          corePath: ocrAssetUrl(''),
          workerBlobURL: false,
          logger: (message) => {
            if (cancelled) {
              return
            }

            if (message.status === 'recognizing text') {
              options.onProgress?.({
                message: 'Reading scanned text…',
                current: currentTarget,
                total: targets.length,
              })
            } else if (message.status.includes('language')) {
              options.onProgress?.({ message: 'Loading language data…' })
            } else if (message.status.includes('core') || message.status.includes('initializ')) {
              options.onProgress?.({ message: 'Starting text recognition…' })
            }
          },
        })

        const ocrText: Record<number, string> = { ...cachedOcr }

        try {
          for (const [index, target] of targets.entries()) {
            throwIfAborted(options.signal)

            if (cancelled || !worker) {
              throw abortError()
            }

            currentTarget = index + 1
            options.onProgress?.({
              message: `Reading page ${index + 1} of ${targets.length}…`,
              current: index + 1,
              total: targets.length,
            })

            const canvas = await renderPage(doc, target.pageNumber)

            try {
              const result = await worker.recognize(canvas)
              throwIfAborted(options.signal)
              const text = normalizePdfText(result.data.text)

              if (text) {
                target.text = text
                target.scanned = false
                ocrText[target.pageNumber] = text
                ocrUsed = true
                combined = combinePdfPages(pages)
                options.onPages?.(
                  pages.map((page) => ({ ...page })),
                  true,
                )
              }
            } finally {
              canvas.width = 0
              canvas.height = 0
            }
          }
        } finally {
          if (cacheKey && Object.keys(ocrText).length) {
            await writeOcrCache(cacheKey, ocrText)
          }
        }

        throwIfAborted(options.signal)
      } finally {
        options.signal?.removeEventListener('abort', cancel)

        if (worker) {
          await worker.terminate()
        }
      }
    }

    return { pages, text: combinePdfPages(pages), ocrUsed }
  } finally {
    await loadingTask.destroy()
  }
}
