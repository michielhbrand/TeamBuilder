/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'compress-pdf-lib' {
  export interface PdfCompressionOptions {
    quality?: number
    scale?: number
    minImageBytes?: number
    onlyIfSmaller?: boolean
    workers?: number
    useWorker?: boolean
    onProgress?: (update: { stage: string; progress: number }) => void
  }

  export interface PdfCompressionStats {
    pages: number
    imagesFound: number
    imagesCompressed: number
    imagesSkipped: number
    originalBytes: number
    compressedBytes: number
    savedBytes: number
    reduction: number
    elapsed: number
    workersUsed: number
  }

  export interface PdfCompressionResult {
    file: File | Blob
    stats: PdfCompressionStats
  }

  export function compressPDF(
    input: File | Blob | ArrayBuffer | Uint8Array,
    options?: PdfCompressionOptions,
  ): Promise<PdfCompressionResult>
}
