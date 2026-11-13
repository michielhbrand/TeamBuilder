import {
  extractPdfText,
  MIN_PDF_TEXT_LENGTH,
  normalizePdfText,
  type PdfPageText,
  type PdfTextProgress,
} from '@/lib/pdf-text'

export const JOB_SPEC_OCR_MAX_PAGES = 8
export const JOB_SPEC_MAX_CHARS = 20_000

export interface JobSpecTextOptions {
  signal?: AbortSignal
  onProgress?: (progress: PdfTextProgress) => void
}

export interface JobSpecTextResult {
  text: string
  pages: PdfPageText[]
  ocrUsed: boolean
}

export function cleanJobSpecText(text: string): string {
  const lines = normalizePdfText(text).split('\n')
  const lineCounts = new Map<string, number>()

  for (const line of lines) {
    const value = line.trim()

    if (value.length > 3) {
      lineCounts.set(value, (lineCounts.get(value) ?? 0) + 1)
    }
  }

  const cleaned = lines.filter((line) => {
    const value = line.trim()

    if (!value) {
      return true
    }

    if (/^(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(value)) {
      return false
    }

    return !((lineCounts.get(value) ?? 0) >= 3 && value.length < 120)
  })

  return normalizePdfText(cleaned.join('\n')).slice(0, JOB_SPEC_MAX_CHARS).trim()
}

export async function extractJobSpecText(
  file: Blob,
  options: JobSpecTextOptions = {},
): Promise<JobSpecTextResult> {
  const result = await extractPdfText(file, {
    signal: options.signal,
    readingMessage: 'Reading the job spec…',
    cacheKeyPrefix: 'job-spec:',
    maxOcrPages: JOB_SPEC_OCR_MAX_PAGES,
    shouldOcr: (pages, text) =>
      pages.some((page) => page.scanned) || text.replace(/\s/g, '').length < MIN_PDF_TEXT_LENGTH,
    onProgress: options.onProgress,
  })

  return {
    text: cleanJobSpecText(result.text),
    pages: result.pages,
    ocrUsed: result.ocrUsed,
  }
}
