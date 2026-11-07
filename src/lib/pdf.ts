export const PDF_MAX_BYTES = 10 * 1024 * 1024

const MIN_COMPRESSION_BYTES = 64 * 1024

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export async function compressPdfForUpload(file: File): Promise<File> {
  if (!isPdfFile(file) || file.size < MIN_COMPRESSION_BYTES) {
    return file
  }

  try {
    const { compressPDF } = await import('compress-pdf-lib')
    const { file: output } = await compressPDF(file, {
      quality: 75,
      scale: 0.85,
      minImageBytes: 4096,
      onlyIfSmaller: true,
    })
    const compressed =
      output instanceof File
        ? output
        : new File([output], file.name, {
            type: 'application/pdf',
            lastModified: file.lastModified,
          })

    return compressed.size < file.size ? compressed : file
  } catch {
    return file
  }
}

export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;'
  frame.src = url
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
  document.body.appendChild(frame)
}
