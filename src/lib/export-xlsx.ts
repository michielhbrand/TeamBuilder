import { columnWidth } from '@/lib/export-sheets'
import type { CellKind, ExportValue, SheetModel } from '@/lib/export-sheets'

type SheetCell = Record<string, unknown> | null

const REVOKE_DELAY_MS = 30_000
const INK = '#0a1b2e'
const BORDER = '#d9e1ea'
const DANGER = '#b42318'
const MUTED = '#58687a'
const SUMMARY_LABEL_WIDTH = 34
const SUMMARY_HEADER_LABEL = 'By department'

export function guardSharedString(value: string): string {
  return value === '__proto__' || Object.prototype.hasOwnProperty.call(Object.prototype, value)
    ? `${value} `
    : value
}

const bodyStyle = { bottomBorderColor: BORDER, bottomBorderStyle: 'thin' }
const headerStyle = {
  fontWeight: 'bold',
  textColor: '#ffffff',
  backgroundColor: INK,
  alignVertical: 'center',
}

function typedCell(
  value: ExportValue,
  kind: CellKind,
  header: string,
  extra: Record<string, unknown>,
): SheetCell {
  if (value === null) {
    return { type: String, ...extra }
  }

  if (kind === 'text') {
    return { type: String, value: guardSharedString(String(value)), format: '@', ...extra }
  }

  if (kind === 'date') {
    return { type: Date, value: value as Date, format: 'dd/mm/yyyy', align: 'left', ...extra }
  }

  const format = {
    integer: '#,##0',
    decimal: '0.#',
    rand: '"R" #,##0',
    percent: '0%',
    days: '#,##0',
  }[kind]
  const overdue = kind === 'days' && header === 'Days to deadline' && Number(value) < 0

  return {
    type: Number,
    value: Number(value),
    format,
    ...(overdue ? { textColor: DANGER } : {}),
    ...extra,
  }
}

function headerCell(text: string): SheetCell {
  return { type: String, value: guardSharedString(text), format: '@', ...headerStyle }
}

function tableData(model: SheetModel): SheetCell[][] {
  const header = model.columns.map((column) => headerCell(column.header))
  const body = model.rows.map((row) =>
    model.columns.map((column, index) =>
      typedCell(row[index] ?? null, column.kind, column.header, {
        ...bodyStyle,
        ...(column.kind === 'text' ? { wrap: true, alignVertical: 'top' } : {}),
      }),
    ),
  )

  return [header, ...body]
}

function summaryData(model: SheetModel): SheetCell[][] {
  const kinds = model.kinds ?? []
  const headerRow = model.rows.findIndex((row) => row[0] === SUMMARY_HEADER_LABEL)
  const last = model.rows.length - 1

  return model.rows.map((row, rowIndex) => {
    const isNote =
      rowIndex === last &&
      rowIndex > headerRow &&
      row.filter((value) => value !== null).length === 1 &&
      headerRow !== -1

    return row.map((value, columnIndex) => {
      const kind = kinds[rowIndex]?.[columnIndex] ?? null

      if (value === null || kind === null) {
        return null
      }

      if (rowIndex === 0) {
        return {
          type: String,
          value: guardSharedString(String(value)),
          fontWeight: 'bold',
          fontSize: 16,
          alignVertical: 'center',
        }
      }

      if (rowIndex === headerRow) {
        return headerCell(String(value))
      }

      if (isNote) {
        return {
          type: String,
          value: guardSharedString(String(value)),
          format: '@',
          fontStyle: 'italic',
          textColor: MUTED,
        }
      }

      return typedCell(value, kind, '', {
        ...bodyStyle,
        alignVertical: 'top',
        ...(columnIndex === 0 ? { fontWeight: 'bold' } : {}),
        ...(kind === 'text' ? { wrap: true } : {}),
      })
    })
  })
}

function tableWidths(model: SheetModel): { width: number }[] {
  return model.columns.map((column, index) => ({
    width: columnWidth(
      column.header,
      model.rows.map((row) => row[index] ?? null),
      column.kind,
    ),
  }))
}

function summaryWidths(model: SheetModel): { width: number }[] {
  const kinds = model.kinds ?? []

  return model.columns.map((_, index) => {
    if (index === 0) {
      return { width: SUMMARY_LABEL_WIDTH }
    }

    const width = model.rows.reduce((max, row, rowIndex) => {
      const kind = kinds[rowIndex]?.[index] ?? null

      return kind === null || rowIndex === 0
        ? max
        : Math.max(max, columnWidth('', [row[index] ?? null], kind))
    }, 8)

    return { width }
  })
}

export async function buildXlsxBlob(sheets: SheetModel[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal')

  const workbook = sheets.map((model) => {
    const summary = model.layout === 'summary'

    return {
      sheet: model.name,
      data: summary ? summaryData(model) : tableData(model),
      columns: summary ? summaryWidths(model) : tableWidths(model),
      stickyRowsCount: summary ? 0 : 1,
      ...(model.landscape ? { orientation: 'landscape' as const } : {}),
      ...(summary ? { showGridLines: false } : {}),
    }
  })

  return writeXlsxFile(workbook, {
    fontFamily: 'Calibri',
    fontSize: 11,
  }).toBlob()
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

export async function exportWorkbook(sheets: SheetModel[], fileName: string): Promise<void> {
  downloadBlob(await buildXlsxBlob(sheets), fileName)
}
