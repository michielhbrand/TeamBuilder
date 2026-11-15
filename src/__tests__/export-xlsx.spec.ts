import { unzipSync, strFromU8 } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildXlsxBlob, downloadBlob, exportWorkbook } from '@/lib/export-xlsx'
import type { SheetModel } from '@/lib/export-sheets'

const longText = 'A very long current role description that keeps going and going '.repeat(2)

const sheets: SheetModel[] = [
  {
    name: 'Summary',
    layout: 'summary',
    landscape: false,
    columns: [
      { header: 'Label', kind: 'text', key: 'label' },
      { header: 'Value', kind: 'text', key: 'value' },
      { header: 'Live roles', kind: 'text', key: 'live-roles' },
    ],
    rows: [
      ['TeamBuilder hiring overview', null, null],
      ['As at', new Date(Date.UTC(2026, 10, 15)), null],
      ['Hire rate', 0.25, null],
      [null, null, null],
      ['By department', 'Live roles', 'Open positions'],
      ['Engineering', 3, 5],
      ['Hiring history starts on March 2025; roles deleted earlier are not included.', null, null],
    ],
    kinds: [
      ['text', null, null],
      ['text', 'date', null],
      ['text', 'percent', null],
      [null, null, null],
      ['text', 'text', 'text'],
      ['text', 'integer', 'integer'],
      ['text', null, null],
    ],
  },
  {
    name: 'Applicants',
    layout: 'table',
    landscape: true,
    columns: [
      { header: 'Applicant', kind: 'text', key: 'applicant' },
      { header: 'Phone', kind: 'text', key: 'phone' },
      { header: 'Current role', kind: 'text', key: 'current-role' },
      { header: 'Applied', kind: 'date', key: 'applied' },
      { header: 'Days to deadline', kind: 'days', key: 'days-to-deadline' },
      { header: 'Salary expectation (rand)', kind: 'rand', key: 'salary' },
      { header: 'Hire rate', kind: 'percent', key: 'rate' },
    ],
    rows: [
      ['=SUM(1,2)', '0821234567', longText, new Date(Date.UTC(2026, 0, 31)), -4, 45000, 0.5],
      ['Ada', null, null, null, 12, null, null],
    ],
  },
  {
    name: 'Pipeline',
    layout: 'table',
    landscape: false,
    columns: [{ header: 'Stage', kind: 'text', key: 'stage' }],
    rows: [['Applied']],
  },
]

async function readParts(blob: Blob): Promise<Record<string, string>> {
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
  const files = unzipSync(bytes)

  return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, strFromU8(data)]))
}

function columnWidths(sheetXml: string): number[] {
  return [...sheetXml.matchAll(/<col [^>]*width="([\d.]+)"/g)].map((match) => Number(match[1]))
}

interface CellStyle {
  bold: boolean
  italic: boolean
  size: number
  fontColor: string | null
  fill: string | null
  bottomBorder: string | null
}

function styleOf(parts: Record<string, string>, sheetFile: string, ref: string): CellStyle {
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml')
  const styles = parse(parts['xl/styles.xml']!)
  const sheet = parse(parts[sheetFile]!)
  const cell = [...sheet.getElementsByTagName('c')].find((entry) => entry.getAttribute('r') === ref)
  const index = Number(cell?.getAttribute('s'))
  const xf = styles.getElementsByTagName('cellXfs')[0]!.children[index]!
  const at = (tag: string, attribute: string) =>
    styles.getElementsByTagName(tag)[0]!.children[Number(xf.getAttribute(attribute))]!
  const font = at('fonts', 'fontId')
  const fill = at('fills', 'fillId').getElementsByTagName('fgColor')[0]
  const bottom = at('borders', 'borderId').getElementsByTagName('bottom')[0]

  return {
    bold: font.getElementsByTagName('b').length > 0,
    italic: font.getElementsByTagName('i').length > 0,
    size: Number(font.getElementsByTagName('sz')[0]!.getAttribute('val')),
    fontColor: font.getElementsByTagName('color')[0]?.getAttribute('rgb') ?? null,
    fill: fill?.getAttribute('rgb') ?? null,
    bottomBorder: bottom?.getElementsByTagName('color')[0]?.getAttribute('rgb') ?? null,
  }
}

describe('buildXlsxBlob', () => {
  it('lists the sheets in order', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))
    const names = [...parts['xl/workbook.xml']!.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(
      (match) => match[1],
    )

    expect(names).toEqual(['Summary', 'Applicants', 'Pipeline'])
  })

  it('sets column widths within bounds and wider for long text', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))
    const widths = columnWidths(parts['xl/worksheets/sheet2.xml']!)

    expect(widths).toHaveLength(7)
    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(8)
      expect(width).toBeLessThanOrEqual(48)
    }
    expect(widths[2]).toBeGreaterThan(widths[1]!)
    expect(widths[2]).toBe(48)
  })

  it('freezes the header row on table sheets only', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))

    expect(parts['xl/worksheets/sheet2.xml']).toContain('ySplit="1"')
    expect(parts['xl/worksheets/sheet2.xml']).toContain('state="frozen"')
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<pane')
  })

  it('hides gridlines on the summary and sets landscape orientation', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))

    expect(parts['xl/worksheets/sheet1.xml']).toMatch(/showGridLines="(0|false)"/)
    expect(parts['xl/worksheets/sheet2.xml']).not.toContain('showGridLines')
    expect(parts['xl/worksheets/sheet2.xml']).toContain('orientation="landscape"')
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('orientation="landscape"')
    expect(parts['xl/worksheets/sheet3.xml']).not.toContain('orientation="landscape"')
  })

  it('styles table headers and body cells', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))
    const sheet = 'xl/worksheets/sheet2.xml'
    const header = styleOf(parts, sheet, 'A1')
    const overdue = styleOf(parts, sheet, 'E2')
    const upcoming = styleOf(parts, sheet, 'E3')
    const body = styleOf(parts, sheet, 'A2')

    expect(header).toMatchObject({ bold: true, fill: 'FF0A1B2E', fontColor: 'FFFFFFFF' })
    expect(overdue.fontColor).toBe('FFB42318')
    expect(upcoming.fontColor).not.toBe('FFB42318')
    expect(body.bottomBorder).toBe('FFD9E1EA')
    expect(body.fill).toBeNull()
  })

  it('styles the summary title, table header and note', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))
    const sheet = 'xl/worksheets/sheet1.xml'
    const title = styleOf(parts, sheet, 'A1')
    const label = styleOf(parts, sheet, 'A2')
    const tableHeader = styleOf(parts, sheet, 'B5')
    const note = styleOf(parts, sheet, 'A7')

    expect(title).toMatchObject({ bold: true, size: 16, fill: null })
    expect(label.bold).toBe(true)
    expect(tableHeader).toMatchObject({ bold: true, fill: 'FF0A1B2E', fontColor: 'FFFFFFFF' })
    expect(note).toMatchObject({ italic: true, fontColor: 'FF58687A' })
    expect(parts[sheet]).not.toContain('state="frozen"')
  })

  it('defines bold header, ink fill, number and date formats', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))
    const styles = parts['xl/styles.xml']!

    expect(styles).toMatch(/<b\s*\/>|<b>/)
    expect(styles).toContain('0A1B2E')
    expect(styles).toContain('B42318')
    expect(styles).toContain('FFFFFF')
    expect(styles).toContain('dd/mm/yyyy')
    expect(styles).toMatch(/&quot;R&quot; #,##0|"R" #,##0/)
    expect(styles).toContain('0%')
    expect(styles).toContain('D9E1EA')
  })

  it('stores dates as numbers and text as strings with no formulas', async () => {
    const parts = await readParts(await buildXlsxBlob(sheets))
    const sheet = parts['xl/worksheets/sheet2.xml']!
    const shared = parts['xl/sharedStrings.xml'] ?? ''
    const row2 = sheet.match(/<row [^>]*r="2"[\s\S]*?<\/row>/)![0]
    const cells = [...row2.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
    const byRef = (ref: string) => cells.find((cell) => cell[1]!.includes(`r="${ref}"`))!

    expect(byRef('A2')[1]).toMatch(/t="(s|inlineStr)"/)
    expect(byRef('B2')[1]).toMatch(/t="(s|inlineStr)"/)
    expect(byRef('D2')[1]).not.toMatch(/t="/)
    expect(byRef('D2')[2]).toMatch(/<v>\d+(\.\d+)?<\/v>/)
    expect(byRef('E2')[2]).toContain('<v>-4</v>')
    expect(byRef('F2')[2]).toContain('<v>45000</v>')
    expect(byRef('G2')[2]).toContain('<v>0.5</v>')
    expect(`${sheet}${shared}`).toContain('=SUM(1,2)')
    expect(`${sheet}${shared}`).toContain('0821234567')

    const sheetXml = Object.entries(parts)
      .filter(([name]) => name.startsWith('xl/worksheets/'))
      .map(([, content]) => content)
      .join('')

    expect(sheetXml).not.toMatch(/<f[ >]/)
  })
})

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('clicks a temporary anchor with the file name and revokes the URL', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:test')
    const revokeObjectURL = vi.fn<(url: string) => void>()

    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })

    const clicks: { download: string; href: string; attached: boolean }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({
        download: this.download,
        href: this.href,
        attached: document.body.contains(this),
      })
    })

    const blob = new Blob(['x'])
    downloadBlob(blob, 'report.xlsx')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicks).toEqual([{ download: 'report.xlsx', href: 'blob:test', attached: true }])
    expect(document.body.querySelector('a')).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('exportWorkbook builds then downloads', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:x', configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn<(url: string) => void>(),
      configurable: true,
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await exportWorkbook(sheets, 'a.xlsx')

    expect(click).toHaveBeenCalledOnce()
  })
})
