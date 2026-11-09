import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApplicantDraft } from '@/lib/resume-import'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn<(...args: unknown[]) => unknown>(),
  createWorker: vi.fn<(...args: unknown[]) => unknown>(),
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: mocks.getDocument,
}))

vi.mock('tesseract.js', () => ({
  createWorker: mocks.createWorker,
}))

import { importApplicantFromPdf } from '@/lib/resume-import'

function makePage(text: string) {
  return {
    getTextContent: vi.fn<(...args: unknown[]) => unknown>(async () => ({
      items: text ? text.split('\n').map((line) => ({ str: line, hasEOL: true })) : [],
    })),
    cleanup: vi.fn<(...args: unknown[]) => unknown>(),
    getViewport: vi.fn<(args: { scale: number }) => { width: number; height: number }>(
      ({ scale }: { scale: number }) => ({
        width: 612 * scale,
        height: 792 * scale,
      }),
    ),
    render: vi.fn<(...args: unknown[]) => unknown>(() => ({ promise: Promise.resolve() })),
  }
}

function makeDocument(textByPage: string[]) {
  const pages = textByPage.map(makePage)

  return {
    numPages: pages.length,
    getPage: vi.fn<(pageNumber: number) => Promise<unknown>>(
      async (pageNumber: number) => pages[pageNumber - 1],
    ),
  }
}

function makeLoadingTask(textByPage: string[]) {
  return {
    promise: Promise.resolve(makeDocument(textByPage)),
    destroy: vi.fn<(...args: unknown[]) => unknown>(async () => undefined),
  }
}

function pdfFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'jane-doe-cv.pdf', {
    type: 'application/pdf',
  })
}

describe('resume import PDF orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D,
    )
  })

  it('uses a text layer without starting OCR', async () => {
    mocks.getDocument.mockReturnValue(
      makeLoadingTask(['Jane Doe\njane@example.com\nExperience\nSenior Engineer at Acme']),
    )
    const drafts: ApplicantDraft[] = []

    const result = await importApplicantFromPdf(pdfFile(), {
      onDraft: (draft) => drafts.push(draft),
    })

    expect(result.ocrUsed).toBe(false)
    expect(result.draft.name).toBe('Jane Doe')
    expect(result.draft.email).toBe('jane@example.com')
    expect(drafts[0]?.name).toBe('Jane Doe')
    expect(mocks.createWorker).not.toHaveBeenCalled()
  })

  it('does not read the PDF when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      importApplicantFromPdf(pdfFile(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.getDocument).not.toHaveBeenCalled()
  })

  it('stops OCR when the import is cancelled', async () => {
    const controller = new AbortController()
    let resolveRecognize: (value: unknown) => void = () => undefined
    const recognize = vi.fn<(...args: unknown[]) => unknown>(
      () =>
        new Promise((resolve) => {
          resolveRecognize = resolve
        }),
    )
    const terminate = vi.fn<(...args: unknown[]) => unknown>().mockResolvedValue(undefined)

    mocks.getDocument.mockReturnValue(makeLoadingTask(['']))
    mocks.createWorker.mockResolvedValue({ recognize, terminate })

    const promise = importApplicantFromPdf(pdfFile(), { signal: controller.signal })
    await vi.waitFor(() => expect(recognize).toHaveBeenCalledOnce())
    controller.abort()
    resolveRecognize({
      data: { text: 'Jane Doe\njane@example.com' },
    })

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('runs background OCR for scanned pages and reports progress', async () => {
    const recognize = vi.fn<(...args: unknown[]) => unknown>().mockResolvedValue({
      data: {
        text: 'Jane Doe\njane@example.com\nExperience\nSenior Engineer at Acme',
      },
    })
    const terminate = vi.fn<(...args: unknown[]) => unknown>().mockResolvedValue(undefined)

    mocks.getDocument.mockReturnValue(makeLoadingTask(['']))
    mocks.createWorker.mockResolvedValue({ recognize, terminate })

    const drafts: ApplicantDraft[] = []
    const messages: string[] = []

    const result = await importApplicantFromPdf(pdfFile(), {
      onDraft: (draft) => drafts.push(draft),
      onProgress: (progress) => messages.push(progress.message),
    })

    expect(result.ocrUsed).toBe(true)
    expect(result.draft.email).toBe('jane@example.com')
    expect(drafts.some((draft) => draft.email === 'jane@example.com')).toBe(true)
    expect(recognize).toHaveBeenCalledOnce()
    expect(terminate).toHaveBeenCalledOnce()
    expect(messages.some((message) => message.includes('Reading page 1 of 1'))).toBe(true)
  })
})
