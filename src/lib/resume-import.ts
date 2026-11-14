import {
  combinePdfPages as combinePages,
  extractPdfText,
  MIN_PDF_TEXT_LENGTH,
  normalizePdfText as normalizeText,
  PDF_OCR_MAX_PAGES,
  type PdfPageText,
  type PdfTextProgress,
} from '@/lib/pdf-text'
import { createCareerEntry, entriesEqual, isEntryEmpty, isValidMonth } from '@/lib/career'
import type { CareerEntry } from '@/types/pipeline'

const MAX_IMPORTED_ENTRIES = 12

export type { PdfPageText }

export type ApplicantDraftField =
  'name' | 'email' | 'phone' | 'currentRole' | 'education' | 'experience'

export interface ApplicantDraft {
  name: string
  email: string
  phone: string
  currentRole: string
  education: CareerEntry[]
  experience: CareerEntry[]
}

export interface ApplicantFormValues {
  name: string
  email: string
  phone: string
  currentRole: string
  education: CareerEntry[]
  experience: CareerEntry[]
}

export type ApplicantImportProgress = PdfTextProgress

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

export const OCR_MAX_PAGES = PDF_OCR_MAX_PAGES

const SECTION_HEADING_RE =
  /^(education|academic background|academic qualifications|qualifications|work experience|professional experience|experience|employment history|employment|career history|work history|projects|personal projects|skills|technical skills|certifications|certificates|awards|achievements|accomplishments|honou?rs|publications|presentations|volunteer(?:ing)?|activities|leadership|memberships|licenses|training|languages|interests|references|summary|profile|about)\b/i

const ROLE_KEYWORDS =
  /\b(engineer|developer|designer|manager|analyst|consultant|director|specialist|officer|architect|scientist|recruiter|marketer|marketing|sales|operations|lead|head|founder|intern|student|professor|teacher|accountant|attorney|lawyer|nurse|doctor|technician|coordinator|administrator|associate|executive|producer|editor|writer|researcher)\b/i

const NAME_STOP_WORDS =
  /(curriculum vitae|resume|profile|contact|address|email|phone|mobile|linkedin|portfolio|summary|objective)/i

const MONTH_PATTERN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'

const YEAR_PATTERN = '(?:19|20)\\d{2}'

const DATE_POINT_PATTERN = [
  `${YEAR_PATTERN}[-/.](?:0?[1-9]|1[0-2])(?!\\d)`,
  `(?:${MONTH_PATTERN})\\s*,?\\s*${YEAR_PATTERN}`,
  `(?:${MONTH_PATTERN})\\s*,?\\s*['’]\\s*\\d{2}(?!\\d)`,
  YEAR_PATTERN,
  `(?:0?[1-9]|1[0-2])[/.]${YEAR_PATTERN}`,
  `(?:0?[1-9]|1[0-2])[/.]\\d{2}`,
  `(?:present|current|ongoing|now|today)`,
].join('|')

const DATE_RANGE_RE = new RegExp(
  `(${DATE_POINT_PATTERN})\\s*(?:-|–|—|\\bto\\b|\\buntil\\b)\\s*(${DATE_POINT_PATTERN})`,
  'i',
)

const SINCE_DATE_RE = new RegExp(`\\b(?:since|from)\\s+(${DATE_POINT_PATTERN})`, 'i')

const EDUCATION_TITLE_RE =
  /\b(?:ph\.?\s?d|doctorate|doctoral|mba|m\.?\s?s\.?c?|m\.?\s?eng|master(?:'s)?|magister|b\.?\s?s\.?c?|b\.?\s?eng|bachelor(?:'s)?|undergraduate|honou?rs|diploma|postgraduate|graduate certificate|higher certificate|degree|matric|high school|secondary|a-level|abitur)\b/i

const INSTITUTION_RE =
  /\b(?:university|college|school|academy|institute|polytechnic|faculty|department)\b/i

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
  startMonth: string
  endMonth: string
  current: boolean
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
  startMonth: string
  endMonth: string
  current: boolean
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

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]

function monthNameIndex(value: string): number {
  return MONTH_NAMES.findIndex((name) => new RegExp(`\\b${name}`, 'i').test(value))
}

function formatMonthValue(year: number, month: number): string {
  if (year < 1900 || year > 2099 || month < 1 || month > 12) {
    return ''
  }

  return `${year}-${String(month).padStart(2, '0')}`
}

function toMonthValue(token: string, edge: 'start' | 'end'): string {
  const cleaned = token.trim()

  if (!cleaned || isCurrentDateToken(cleaned)) {
    return ''
  }

  const iso = cleaned.match(/^((?:19|20)\d{2})[-/.](\d{1,2})$/)

  if (iso?.[1] && iso[2]) {
    return formatMonthValue(Number(iso[1]), Number(iso[2]))
  }

  const numeric = cleaned.match(/^(0?[1-9]|1[0-2])[/.]((?:19|20)\d{2}|\d{2})$/)

  if (numeric?.[1] && numeric[2]) {
    const raw = Number(numeric[2])
    const year = numeric[2].length === 2 ? (raw > 50 ? 1900 : 2000) + raw : raw
    return formatMonthValue(year, Number(numeric[1]))
  }

  const named = monthNameIndex(cleaned)
  let year = dateYear(cleaned)

  if (year === null && named >= 0) {
    const short = cleaned.match(/['’]\s*(\d{2})(?!\d)/)

    if (short?.[1]) {
      const raw = Number(short[1])
      year = raw > 50 ? 1900 + raw : 2000 + raw
    }
  }

  if (year === null) {
    return ''
  }

  const month = named >= 0 ? named + 1 : edge === 'start' ? 1 : 12
  return formatMonthValue(year, month)
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

  const current = isCurrentDateToken(match[2] ?? '')
  const startMonth = toMonthValue(match[1] ?? '', 'start')
  const parsedEnd = current ? '' : toMonthValue(match[2] ?? '', 'end')

  if (!startMonth && !parsedEnd && !current) {
    return null
  }

  return {
    start,
    end,
    label: `${start} – ${end}`,
    startYear: dateYear(start),
    endYear: dateYear(end) ?? (current ? new Date().getFullYear() : null),
    startMonth,
    endMonth: parsedEnd && startMonth && parsedEnd < startMonth ? '' : parsedEnd,
    current,
  }
}

function parseSinceDate(line: string): ResumeDateRange | null {
  const match = line.match(SINCE_DATE_RE)

  if (!match?.[1]) {
    return null
  }

  const startMonth = toMonthValue(match[1], 'start')

  if (!startMonth) {
    return null
  }

  const start = formatDateToken(match[1])

  return {
    start,
    end: 'Present',
    label: `${start} – Present`,
    startYear: dateYear(start) ?? Number(startMonth.slice(0, 4)),
    endYear: new Date().getFullYear(),
    startMonth,
    endMonth: '',
    current: true,
  }
}

function findDatedResumeLines(lines: string[]): DatedResumeLine[] {
  const dated: DatedResumeLine[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (!line) {
      continue
    }

    const parsedRange = parseDateRange(line)
    const range = parsedRange ?? parseSinceDate(line)
    const match = line.match(parsedRange ? DATE_RANGE_RE : SINCE_DATE_RE)

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
      startMonth: item.range.startMonth,
      endMonth: item.range.endMonth,
      current: item.range.current,
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
      startMonth: '',
      endMonth: '',
      current: false,
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

function splitOrganization(
  title: string,
  kind: ResumeSectionKind,
): { title: string; organization: string } {
  if (kind === 'experience') {
    const at = title.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i)

    if (at?.[1] && at[2]) {
      return { title: at[1].trim(), organization: at[2].trim() }
    }
  }

  const comma = title.indexOf(',')

  if (comma > 0) {
    const left = title.slice(0, comma).trim()
    const right = title.slice(comma + 1).trim()
    const rightIsOrganization =
      kind === 'education' ? looksLikeInstitution(right) : looksLikeRole(left) && right.length <= 60

    if (left && right && rightIsOrganization) {
      return { title: left, organization: right }
    }
  }

  if (kind === 'education') {
    const institutionIndex = title.search(INSTITUTION_RE)

    if (institutionIndex > 0) {
      const left = title
        .slice(0, institutionIndex)
        .trim()
        .replace(/\s+(?:at|from)$/i, '')
      const right = title.slice(institutionIndex).trim()

      if (left && right.length <= 120 && looksLikeEducationTitle(left)) {
        return { title: left, organization: right }
      }
    }
  }

  return { title, organization: '' }
}

function entryEndMonth(entry: ResumeEntry): string {
  if (entry.current || !isValidMonth(entry.endMonth)) {
    return ''
  }

  if (isValidMonth(entry.startMonth) && entry.endMonth < entry.startMonth) {
    return ''
  }

  return entry.endMonth
}

function toCareerEntries(entries: ResumeEntry[], kind: ResumeSectionKind): CareerEntry[] {
  const seen = new Set<string>()

  return entries
    .map((entry) => {
      const split = splitOrganization(entry.title, kind)
      const details = [...entry.details]
      let organization = split.organization

      if (!organization && kind === 'education') {
        const index = details.findIndex(
          (line) =>
            looksLikeInstitution(line) && line.length <= 120 && !looksLikeEducationTitle(line),
        )

        if (index >= 0) {
          organization = details.splice(index, 1)[0] ?? ''
        }
      }

      return createCareerEntry({
        title: split.title,
        organization,
        start: isValidMonth(entry.startMonth) ? entry.startMonth : '',
        end: entryEndMonth(entry),
        current: entry.current,
        description: details.join('\n').trim().slice(0, 2000),
      })
    })
    .filter((entry) => {
      if (isEntryEmpty(entry)) {
        return false
      }

      const key = [
        entry.title.toLowerCase(),
        entry.organization.toLowerCase(),
        entry.start,
        entry.current ? 'present' : entry.end,
        entry.description.toLowerCase(),
      ].join('|')

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .slice(0, MAX_IMPORTED_ENTRIES)
}

function formatEducationSection(lines: string[]): CareerEntry[] {
  return toCareerEntries(parseResumeEntries(lines, 'education'), 'education')
}

function formatExperienceSection(lines: string[]): CareerEntry[] {
  return toCareerEntries(parseResumeEntries(lines, 'experience'), 'experience')
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

function currentRoleFromExperience(entries: CareerEntry[]): string {
  const titled = entries.filter((entry) => entry.title.trim())

  if (!titled.length) {
    return ''
  }

  const current = titled.filter((entry) => entry.current)
  const pool = current.length ? current : titled

  return (
    [...pool]
      .sort((left, right) => (right.start || '').localeCompare(left.start || ''))
      .find((entry) => entry.title.trim())
      ?.title.trim() ?? ''
  )
}

function extractCurrentRole(
  lines: string[],
  experience: CareerEntry[],
  experienceSource: string,
): string {
  for (const line of lines.slice(0, 20)) {
    const match = line.match(
      /^(?:current role|current position|job title|position|role|title)\s*[:-]\s*(.+)$/i,
    )

    if (match?.[1]) {
      return cleanRole(match[1])
    }
  }

  const fromExperience = currentRoleFromExperience(experience)

  if (fromExperience) {
    return fromExperience
  }

  const experienceLines = experienceSource.split('\n').map(cleanLine).filter(Boolean)

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
    currentRole: extractCurrentRole(lines, experience, experienceSource),
    education,
    experience,
  }
}

export function missingKeyFields(draft: ApplicantDraft): boolean {
  return !draft.name || (!draft.email && !draft.phone)
}

export function mergeApplicantDraft(
  current: ApplicantFormValues,
  draft: ApplicantDraft,
  edited: ReadonlySet<ApplicantDraftField>,
  autoFilled: Set<ApplicantDraftField>,
): void {
  const textFields: Array<'name' | 'email' | 'phone' | 'currentRole'> = [
    'name',
    'email',
    'phone',
    'currentRole',
  ]

  for (const field of textFields) {
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

  for (const field of ['education', 'experience'] as const) {
    const entries = draft[field]

    if (!entries.length || edited.has(field)) {
      continue
    }

    if (current[field].length && !autoFilled.has(field)) {
      continue
    }

    if (!entriesEqual(current[field], entries)) {
      current[field] = entries.map((entry) => ({ ...entry }))
    }

    autoFilled.add(field)
  }
}

export async function importApplicantFromPdf(
  file: File,
  options: ApplicantImportOptions = {},
): Promise<ApplicantImportResult> {
  let draft = extractApplicantDraft('', file.name)

  const result = await extractPdfText(file, {
    signal: options.signal,
    readingMessage: 'Reading the PDF…',
    maxOcrPages: OCR_MAX_PAGES,
    shouldOcr: (pages, text) => {
      if (!pages.some((page) => page.scanned)) {
        return false
      }

      const currentDraft = extractApplicantDraft(text, file.name)
      const textLayer = text.replace(/\s/g, '')
      return !textLayer || textLayer.length < MIN_PDF_TEXT_LENGTH || missingKeyFields(currentDraft)
    },
    onProgress: options.onProgress,
    onPages: (pages, ocrUsed) => {
      draft = extractApplicantDraft(combinePages(pages), file.name)
      options.onDraft?.(draft, ocrUsed ? 'ocr' : 'text')
    },
  })

  options.onProgress?.({ message: 'PDF details ready.' })

  return { draft, pages: result.pages, ocrUsed: result.ocrUsed }
}
