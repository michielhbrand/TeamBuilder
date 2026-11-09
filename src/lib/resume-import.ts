import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export type ApplicantDraftField =
  'name' | 'email' | 'phone' | 'currentRole' | 'education' | 'experience'

export interface ApplicantDraft {
  name: string
  email: string
  phone: string
  currentRole: string
  education: string
  experience: string
}

export interface PdfPageText {
  pageNumber: number
  text: string
  scanned: boolean
}

export interface ApplicantImportProgress {
  message: string
  current?: number
  total?: number
}

export interface ApplicantImportOptions {
  onDraft?: (draft: ApplicantDraft, source: 'text' | 'ocr') => void
  onProgress?: (progress: ApplicantImportProgress) => void
  signal?: AbortSignal
}

export interface ApplicantImportResult {
  draft: ApplicantDraft
  pages: PdfPageText[]
  ocrUsed: boolean
}

export const OCR_MAX_PAGES = 3

const PDF_MAX_RENDER_WIDTH = 1700
const PDF_MAX_RENDER_SCALE = 2.5
const MIN_TEXT_LENGTH = 120
const OCR_CACHE_DB = 'teambuilder-ocr'
const OCR_CACHE_STORE = 'pages'
const OCR_CACHE_VERSION = 1

const SECTION_HEADING_RE =
  /^(education|academic background|academic qualifications|qualifications|work experience|professional experience|experience|employment history|employment|career history|work history|projects|personal projects|skills|technical skills|certifications|certificates|awards|achievements|accomplishments|honou?rs|publications|presentations|volunteer(?:ing)?|activities|leadership|memberships|licenses|training|languages|interests|references|summary|profile|about)\b/i

const ROLE_KEYWORDS =
  /\b(engineer|developer|designer|manager|analyst|consultant|director|specialist|officer|architect|scientist|recruiter|marketer|marketing|sales|operations|lead|head|founder|intern|student|professor|teacher|accountant|attorney|lawyer|nurse|doctor|technician|coordinator|administrator|associate|executive|producer|editor|writer|researcher)\b/i

const NAME_STOP_WORDS =
  /(curriculum vitae|resume|profile|contact|address|email|phone|mobile|linkedin|portfolio|summary|objective)/i

const MONTH_PATTERN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'

const DATE_POINT_PATTERN = `(?:${MONTH_PATTERN}\\s*,?\\s*)?(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[/.]\\d{2,4}|(?:present|current|ongoing|now|today)`

const DATE_RANGE_RE = new RegExp(
  `(${DATE_POINT_PATTERN})\\s*(?:-|–|—|\\bto\\b|\\buntil\\b)\\s*(${DATE_POINT_PATTERN})`,
  'i',
)

const EDUCATION_TITLE_RE =
  /\b(?:ph\.?\s?d|doctorate|doctoral|mba|m\.?\s?s\.?c?|m\.?\s?eng|master(?:'s)?|magister|b\.?\s?s\.?c?|b\.?\s?eng|bachelor(?:'s)?|undergraduate|honou?rs|diploma|postgraduate|graduate certificate|higher certificate|degree|matric|high school|secondary|a-level|abitur)\b/i

const INSTITUTION_RE =
  /\b(?:university|college|school|academy|institute|polytechnic|faculty|department)\b/i

const QUALIFICATION_LEVELS = [
  { re: /\b(?:ph\.?\s?d|doctorate|doctoral)\b/i, rank: 6, label: 'Doctorate' },
  { re: /\bmba\b/i, rank: 5, label: 'MBA' },
  {
    re: /\b(?:m\.?\s?s\.?c?|m\.?\s?eng|master(?:'s)?|magister)\b/i,
    rank: 4,
    label: "Master's degree",
  },
  {
    re: /\b(?:b\.?\s?s\.?c?|b\.?\s?eng|bachelor(?:'s)?|undergraduate|honou?rs)\b/i,
    rank: 3,
    label: "Bachelor's degree",
  },
  {
    re: /\b(?:diploma|advanced diploma|postgraduate|graduate certificate|higher certificate)\b/i,
    rank: 2,
    label: 'Diploma',
  },
  {
    re: /\b(?:high school|secondary|matric|a-level|abitur)\b/i,
    rank: 1,
    label: 'Secondary education',
  },
] as const

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

function normalizeText(value: string): string {
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

function pageLooksScanned(text: string): boolean {
  return normalizeText(text).replace(/\s/g, '').length < 24
}

function combinePages(pages: PdfPageText[]): string {
  return pages
    .map((page) => page.text)
    .filter(Boolean)
    .join('\n\n')
}

function cleanLine(line: string): string {
  return line
    .replace(/^[\s•·▪◦*-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isHeading(line: string): boolean {
  const value = cleanLine(line)

  return (
    SECTION_HEADING_RE.test(value) &&
    value.length <= 50 &&
    value.split(' ').length <= 6 &&
    !/[.!?]$/.test(value)
  )
}

function normalizedNameLine(line: string): string {
  return cleanLine(line)
    .replace(/^name\s*[:-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeName(line: string): boolean {
  const value = normalizedNameLine(line)

  if (value.length < 2 || value.length > 60) {
    return false
  }

  if (/[@\d|/\\]/.test(value) || /https?:|www\.|linkedin/i.test(value)) {
    return false
  }

  const words = value.split(' ')

  if (words.length < 2 || words.length > 5) {
    return false
  }

  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(value)) {
    return false
  }

  if (isHeading(value) || NAME_STOP_WORDS.test(value) || ROLE_KEYWORDS.test(value)) {
    return false
  }

  return true
}

function formatPersonName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .toLowerCase()
        .replace(
          /(^|[-'’])(\p{L})/gu,
          (_match: string, prefix: string, letter: string) => prefix + letter.toUpperCase(),
        ),
    )
    .join(' ')
}

function nameFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_+]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\b(cv|resume|curriculum|vitae|profile|final|copy|updated?)\b/gi, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = base.split(' ').filter(Boolean)

  if (words.length < 2 || words.length > 4 || /\d/.test(base)) {
    return ''
  }

  if (!/^[\p{L}\s.'’-]+$/u.test(base)) {
    return ''
  }

  return formatPersonName(base)
}

function extractEmail(text: string): string {
  const matches = text.match(/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}/gi) ?? []

  for (const raw of matches) {
    const candidate = raw.replace(/\s+/g, '').replace(/[),;:]+$/, '')

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      return candidate
    }
  }

  return ''
}

function extractPhone(text: string): string {
  const phoneLabel = /(?:phone|mobile|tel|telephone|cell|whatsapp)\b/i
  let best = ''
  let bestScore = -1

  const lines = text.split('\n')

  for (const line of lines) {
    const labeled = phoneLabel.test(line)
    const matches = line.match(/(?:\+?\d[\d\s().-]{5,}\d)/g) ?? []

    for (const raw of matches) {
      const digits = raw.replace(/\D/g, '')

      if (digits.length < 8 || digits.length > 15) {
        continue
      }

      if (!labeled && isDateRange(line)) {
        continue
      }

      const score = (labeled ? 100 : 0) + digits.length

      if (score > bestScore) {
        best = digits
        bestScore = score
      }
    }
  }

  return best
}

function isDateRange(line: string): boolean {
  const years = line.match(/\b(?:19|20)\d{2}\b/g) ?? []
  return years.length >= 2 && !/[+()]/.test(line)
}

function extractName(lines: string[], filename: string): string {
  for (const line of lines.slice(0, 24)) {
    if (/^\s*name\s*[:-]/i.test(line)) {
      const value = normalizedNameLine(line)

      if (looksLikeName(value)) {
        return value
      }
    }
  }

  for (const line of lines.slice(0, 24)) {
    const value = normalizedNameLine(line)

    if (looksLikeName(value)) {
      return value
    }
  }

  return nameFromFilename(filename)
}

function sectionBounds(lines: string[]): Array<{ start: number; end: number }> {
  const bounds: Array<{ start: number; end: number }> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (!line || !isHeading(line)) {
      continue
    }

    const start = index
    let end = lines.length

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor]

      if (next && isHeading(next)) {
        end = cursor
        break
      }
    }

    bounds.push({ start, end })
    index = end - 1
  }

  return bounds
}

function extractSectionLines(lines: string[], matcher: RegExp): string[] {
  const bounds = sectionBounds(lines)

  for (const bound of bounds) {
    const startLine = lines[bound.start]

    if (!startLine) {
      continue
    }

    const heading = cleanLine(startLine)

    if (!matcher.test(heading)) {
      continue
    }

    const inline = heading.includes(':') ? heading.slice(heading.indexOf(':') + 1).trim() : ''
    const body = lines.slice(bound.start + 1, bound.end).map(cleanLine)
    return [inline, ...body]
  }

  return []
}

interface ResumeDateRange {
  start: string
  end: string
  label: string
  startYear: number | null
  endYear: number | null
}

interface DatedResumeLine {
  index: number
  range: ResumeDateRange
  before: string
  after: string
}

interface ResumeEntry {
  title: string
  dates: string
  details: string[]
  startYear: number | null
  endYear: number | null
}

type ResumeSectionKind = 'education' | 'experience'

function formatDateToken(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim()

  if (/^(?:present|current|now|today)$/i.test(cleaned)) {
    return 'Present'
  }

  if (/^ongoing$/i.test(cleaned)) {
    return 'Ongoing'
  }

  return cleaned.replace(
    /\b[a-z][a-z]*\b/gi,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  )
}

function isCurrentDateToken(value: string): boolean {
  return /^(?:present|current|ongoing|now|today)$/i.test(value.trim())
}

function dateYear(value: string): number | null {
  const match = value.match(/\b(?:19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

function parseDateRange(line: string): ResumeDateRange | null {
  const match = line.match(DATE_RANGE_RE)

  if (!match || match.index === undefined) {
    return null
  }

  const start = formatDateToken(match[1] ?? '')
  const end = formatDateToken(match[2] ?? '')

  if (!start || !end) {
    return null
  }

  return {
    start,
    end,
    label: `${start} – ${end}`,
    startYear: dateYear(start),
    endYear: dateYear(end) ?? (isCurrentDateToken(end) ? new Date().getFullYear() : null),
  }
}

function findDatedResumeLines(lines: string[]): DatedResumeLine[] {
  const dated: DatedResumeLine[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (!line) {
      continue
    }

    const match = line.match(DATE_RANGE_RE)
    const range = parseDateRange(line)

    if (!match || match.index === undefined || !range) {
      continue
    }

    dated.push({
      index,
      range,
      before: line.slice(0, match.index).trim(),
      after: line.slice(match.index + match[0].length).trim(),
    })
  }

  return dated
}

function isNoiseText(value: string): boolean {
  const text = value.trim()
  return !text || /^[^\p{L}\p{N}]+$/u.test(text) || /^\p{L}$/u.test(text)
}

function looksLikeInstitution(value: string): boolean {
  return INSTITUTION_RE.test(cleanLine(value))
}

function looksLikeEducationTitle(value: string): boolean {
  const line = cleanLine(value)
  return line.length >= 3 && line.length <= 160 && EDUCATION_TITLE_RE.test(line) && !isHeading(line)
}

function cleanEntryTitle(value: string, kind: ResumeSectionKind): string {
  const line = cleanLine(value).replace(/[\s,;·|–—-]+$/, '')
  return kind === 'experience' ? cleanRole(line) : line
}

function findTitleIndex(
  lines: string[],
  dateIndex: number,
  minIndex: number,
  kind: ResumeSectionKind,
): number {
  const candidates: number[] = []

  for (let cursor = dateIndex - 1; cursor > minIndex && candidates.length < 4; cursor -= 1) {
    if (lines[cursor]) {
      candidates.push(cursor)
    }
  }

  if (!candidates.length) {
    return dateIndex
  }

  if (kind === 'education') {
    const degree = candidates.find((index) => looksLikeEducationTitle(lines[index] ?? ''))

    if (degree !== undefined) {
      return degree
    }

    const nonInstitution = candidates.find((index) => !looksLikeInstitution(lines[index] ?? ''))
    return nonInstitution ?? candidates[0] ?? dateIndex
  }

  const role = candidates.find((index) => looksLikeRole(lines[index] ?? ''))
  return role ?? candidates[0] ?? dateIndex
}

function parseDatedResumeEntries(
  lines: string[],
  dated: DatedResumeLine[],
  kind: ResumeSectionKind,
): ResumeEntry[] {
  const titleIndices = dated.map((item, index) => {
    if (!isNoiseText(item.before)) {
      return item.index
    }

    const previousDateIndex = index > 0 ? (dated[index - 1]?.index ?? -1) : -1
    return findTitleIndex(lines, item.index, previousDateIndex, kind)
  })

  const dateIndices = new Set(dated.map((item) => item.index))

  return dated.map((item, index) => {
    const titleIndex = titleIndices[index] ?? item.index
    const nextTitleIndex = titleIndices[index + 1] ?? lines.length
    const inlineTitle = !isNoiseText(item.before)
    const rawTitle = inlineTitle
      ? item.before
      : titleIndex === item.index
        ? ''
        : (lines[titleIndex] ?? '')
    const titleParts = [rawTitle]
    let detailStartIndex = titleIndex + 1
    const details: string[] = []

    if (inlineTitle && item.after) {
      details.push(cleanLine(item.after))
    }

    if (kind === 'education' && !inlineTitle) {
      for (let cursor = titleIndex + 1; cursor < item.index; cursor += 1) {
        const value = lines[cursor]

        if (!value || dateIndices.has(cursor)) {
          continue
        }

        if (/^\([^)]*\)$/.test(value)) {
          titleParts.push(value)
          detailStartIndex = cursor + 1
          continue
        }

        break
      }
    }

    for (let cursor = detailStartIndex; cursor < item.index; cursor += 1) {
      const value = lines[cursor]

      if (value && !dateIndices.has(cursor) && !isNoiseText(value)) {
        details.push(value)
      }
    }

    for (let cursor = item.index + 1; cursor < nextTitleIndex; cursor += 1) {
      const value = lines[cursor]

      if (value && !dateIndices.has(cursor) && !isNoiseText(value)) {
        details.push(value)
      }
    }

    return {
      title: cleanEntryTitle(titleParts.filter(Boolean).join(' '), kind),
      dates: item.range.label,
      details,
      startYear: item.range.startYear,
      endYear: item.range.endYear,
    }
  })
}

function findUndatedTitleIndex(lines: string[], kind: ResumeSectionKind): number {
  if (kind === 'education') {
    const degree = lines.findIndex((line) => looksLikeEducationTitle(line))

    if (degree >= 0) {
      return degree
    }

    const nonInstitution = lines.findIndex((line) => !looksLikeInstitution(line))
    return nonInstitution >= 0 ? nonInstitution : 0
  }

  const role = lines.findIndex((line) => looksLikeRole(line))
  return role >= 0 ? role : 0
}

function parseUndatedResumeEntries(lines: string[], kind: ResumeSectionKind): ResumeEntry[] {
  const chunks: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    if (!line) {
      if (current.length) {
        chunks.push(current)
        current = []
      }

      continue
    }

    if (!isNoiseText(line)) {
      current.push(line)
    }
  }

  if (current.length) {
    chunks.push(current)
  }

  return chunks.map((chunk) => {
    const titleIndex = findUndatedTitleIndex(chunk, kind)
    return {
      title: cleanEntryTitle(chunk[titleIndex] ?? '', kind),
      dates: '',
      details: chunk.filter((_line, index) => index !== titleIndex),
      startYear: null,
      endYear: null,
    }
  })
}

function parseResumeEntries(lines: string[], kind: ResumeSectionKind): ResumeEntry[] {
  const cleaned = lines.map(cleanLine)
  const dated = findDatedResumeLines(cleaned)

  if (dated.length) {
    return parseDatedResumeEntries(cleaned, dated, kind)
  }

  return parseUndatedResumeEntries(cleaned, kind)
}

function qualificationLevel(title: string): (typeof QUALIFICATION_LEVELS)[number] | null {
  return QUALIFICATION_LEVELS.find((level) => level.re.test(title)) ?? null
}

function qualificationRank(title: string): number {
  return qualificationLevel(title)?.rank ?? 0
}

function educationSummary(entries: ResumeEntry[]): string {
  const highest = [...entries].sort(
    (left, right) => qualificationRank(right.title) - qualificationRank(left.title),
  )[0]

  if (!highest) {
    return ''
  }

  const level = qualificationLevel(highest.title)
  const detail = [highest.title, highest.dates].filter(Boolean).join(', ')
  const count = `${entries.length} qualification${entries.length === 1 ? '' : 's'}`

  if (!detail) {
    return ''
  }

  return `Highest qualification: ${level ? `${level.label} (${detail})` : detail} · ${count}`
}

function totalExperienceYears(entries: ResumeEntry[]): number {
  const intervals: Array<[number, number]> = []

  for (const entry of entries) {
    if (entry.startYear === null || entry.endYear === null || entry.endYear < entry.startYear) {
      continue
    }

    intervals.push([entry.startYear, entry.endYear])
  }

  if (!intervals.length) {
    return 0
  }

  intervals.sort((left, right) => left[0] - right[0])
  let total = 0
  let [start, end] = intervals[0] ?? [0, 0]

  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (nextStart <= end) {
      end = Math.max(end, nextEnd)
    } else {
      total += end - start
      start = nextStart
      end = nextEnd
    }
  }

  return total + end - start
}

function experienceSummary(entries: ResumeEntry[]): string {
  if (!entries.length) {
    return ''
  }

  const years = totalExperienceYears(entries)
  const dated = entries.filter((entry) => entry.startYear !== null && entry.endYear !== null).length
  const roles = entries.length === 1 ? '1 role' : `${entries.length} roles`

  if (years > 0) {
    const suffix = dated < entries.length ? '+' : ''
    const placement = entries.length === 1 ? 'in 1 role' : `across ${roles}`
    return `Industry experience: ${years}${suffix} year${years === 1 ? '' : 's'} ${placement}`
  }

  return `Industry experience: ${roles}`
}

function formatResumeEntries(entries: ResumeEntry[], summary: string): string {
  const blocks = entries
    .map((entry) => [entry.title, entry.dates, ...entry.details].filter(Boolean).join('\n'))
    .filter(Boolean)

  return [summary, ...blocks].filter(Boolean).join('\n\n').slice(0, 5000).trim()
}

function formatEducationSection(lines: string[]): string {
  const entries = parseResumeEntries(lines, 'education')
  return entries.length ? formatResumeEntries(entries, educationSummary(entries)) : ''
}

function formatExperienceSection(lines: string[]): string {
  const entries = parseResumeEntries(lines, 'experience')
  return entries.length ? formatResumeEntries(entries, experienceSummary(entries)) : ''
}

function cleanRole(value: string): string {
  return cleanLine(value)
    .replace(/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\s*[·|,-]?\s*/g, '')
    .replace(/^(?:19|20)\d{2}\s*[·|,-]\s*/g, '')
    .replace(/\s*[·|]\s*(?:19|20)\d{2}.*$/g, '')
    .replace(/\s+(?:19|20)\d{2}\s*[-–—]\s*(?:present|current|(?:19|20)\d{2})\s*$/i, '')
    .replace(/\s+at\s+/i, ' at ')
    .replace(/[\s,;·|–—-]+$/, '')
    .trim()
}

function looksLikeRole(value: string): boolean {
  const line = cleanRole(value)

  if (line.length < 3 || line.length > 90) {
    return false
  }

  if (/[@]|https?:|www\.|linkedin/i.test(line) || isHeading(line)) {
    return false
  }

  if (/^[\d\s().+-]+$/.test(line)) {
    return false
  }

  return ROLE_KEYWORDS.test(line) || /\bat\b/i.test(line)
}

function extractCurrentRole(lines: string[], experience: string): string {
  for (const line of lines.slice(0, 20)) {
    const match = line.match(
      /^(?:current role|current position|job title|position|role|title)\s*[:-]\s*(.+)$/i,
    )

    if (match?.[1]) {
      return cleanRole(match[1])
    }
  }

  const experienceLines = experience.split('\n').map(cleanLine).filter(Boolean)

  for (const line of experienceLines.slice(0, 12)) {
    if (looksLikeRole(line)) {
      return cleanRole(line)
    }
  }

  for (const line of lines.slice(0, 14)) {
    if (looksLikeRole(line)) {
      return cleanRole(line)
    }
  }

  return ''
}

export function extractApplicantDraft(text: string, filename = ''): ApplicantDraft {
  const normalized = normalizeText(text)
  const lines = normalized.split('\n')
  const educationLines = extractSectionLines(lines, /^education|academic|qualification/i)
  const experienceLines = extractSectionLines(
    lines,
    /^(work experience|professional experience|experience|employment|career|work history)/i,
  )
  const education = formatEducationSection(educationLines)
  const experience = formatExperienceSection(experienceLines)
  const experienceSource = experienceLines.filter(Boolean).join('\n')

  return {
    name: formatPersonName(extractName(lines, filename)),
    email: extractEmail(normalized).toLowerCase(),
    phone: extractPhone(normalized),
    currentRole: extractCurrentRole(lines, experienceSource || experience),
    education,
    experience,
  }
}

export function missingKeyFields(draft: ApplicantDraft): boolean {
  return !draft.name || (!draft.email && !draft.phone)
}

export function mergeApplicantDraft(
  current: Record<ApplicantDraftField, string>,
  draft: ApplicantDraft,
  edited: ReadonlySet<ApplicantDraftField>,
  autoFilled: Set<ApplicantDraftField>,
): void {
  const fields: ApplicantDraftField[] = [
    'name',
    'email',
    'phone',
    'currentRole',
    'education',
    'experience',
  ]

  for (const field of fields) {
    const value = draft[field].trim()

    if (!value || edited.has(field)) {
      continue
    }

    if (current[field] && current[field] !== value && !autoFilled.has(field)) {
      continue
    }

    if (current[field] !== value) {
      current[field] = value
    }

    autoFilled.add(field)
  }
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

  return normalizeText(output)
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

async function fingerprint(buffer: Uint8Array): Promise<string | null> {
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
    return new DOMException('The CV import was cancelled.', 'AbortError')
  }

  const error = new Error('The CV import was cancelled.')
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
    throw new Error('This browser could not prepare the scanned CV.')
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

export async function importApplicantFromPdf(
  file: File,
  options: ApplicantImportOptions = {},
): Promise<ApplicantImportResult> {
  throwIfAborted(options.signal)

  const pdfjs = await loadPdfjs()
  const buffer = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data: buffer })
  const doc = await loadingTask.promise
  const cacheKey = await fingerprint(buffer)

  try {
    options.onProgress?.({ message: 'Reading the PDF…' })
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

    let draft = extractApplicantDraft(combinePages(pages), file.name)
    options.onDraft?.(draft, 'text')

    const scannedPages = pages.filter((page) => page.scanned)

    if (scannedPages.length) {
      const targets = scannedPages.slice(0, OCR_MAX_PAGES)
      const textLayer = combinePages(pages.filter((page) => !page.scanned))
      const needsOcr =
        !textLayer.trim() ||
        textLayer.replace(/\s/g, '').length < MIN_TEXT_LENGTH ||
        missingKeyFields(draft)

      if (needsOcr) {
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
                  message: 'Reading the scanned CV…',
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
                const text = normalizeText(result.data.text)

                if (text) {
                  target.text = text
                  target.scanned = false
                  ocrText[target.pageNumber] = text
                  ocrUsed = true
                  draft = extractApplicantDraft(combinePages(pages), file.name)
                  options.onDraft?.(draft, 'ocr')
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
    }

    options.onProgress?.({ message: 'PDF details ready.' })

    return { draft, pages, ocrUsed }
  } finally {
    await loadingTask.destroy()
  }
}
