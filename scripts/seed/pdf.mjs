import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = 54
const INK = rgb(0.06, 0.1, 0.17)
const MUTED = rgb(0.35, 0.4, 0.47)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function safe(text) {
  return String(text)
    .replaceAll('–', '-')
    .replaceAll('—', '-')
    .replaceAll('’', "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '')
}

function formatMonth(value) {
  const [year, month] = value.split('-')
  return `${MONTHS[Number(month) - 1]} ${year}`
}

function formatRange(entry) {
  return `${formatMonth(entry.start)} - ${entry.current ? 'Present' : formatMonth(entry.end)}`
}

class Writer {
  constructor(doc, regular, bold, meta) {
    this.doc = doc
    this.regular = regular
    this.bold = bold
    this.page = null
    this.y = 0
    doc.setTitle(meta.title)
    doc.setAuthor('TeamBuilder demo data')
    doc.setSubject('Fictional sample document generated for demonstration purposes')
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height])
    this.y = PAGE.height - MARGIN
  }

  ensure(height) {
    if (this.y - height < MARGIN) {
      this.newPage()
    }
  }

  wrap(text, font, size, width) {
    const lines = []
    let line = ''
    for (const word of safe(text).split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate
      } else {
        if (line) {
          lines.push(line)
        }
        line = word
      }
    }
    if (line) {
      lines.push(line)
    }
    return lines
  }

  text(text, { size = 10.5, bold = false, color = INK, indent = 0, gap = 3, lead = 1.35 } = {}) {
    const font = bold ? this.bold : this.regular
    const lines = this.wrap(text, font, size, PAGE.width - MARGIN * 2 - indent)
    for (const line of lines) {
      this.ensure(size * lead)
      this.y -= size * lead
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font, color })
    }
    this.y -= gap
  }

  heading(text) {
    this.ensure(40)
    this.y -= 10
    this.text(text, { size: 13, bold: true, gap: 4 })
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 2 },
      end: { x: PAGE.width - MARGIN, y: this.y + 2 },
      thickness: 0.6,
      color: rgb(0.82, 0.86, 0.9),
    })
    this.y -= 4
  }

  bullet(text) {
    const font = this.regular
    const size = 10.5
    const lines = this.wrap(text, font, size, PAGE.width - MARGIN * 2 - 14)
    lines.forEach((line, index) => {
      this.ensure(size * 1.35)
      this.y -= size * 1.35
      if (index === 0) {
        this.page.drawText('-', { x: MARGIN + 2, y: this.y, size, font, color: INK })
      }
      this.page.drawText(line, { x: MARGIN + 14, y: this.y, size, font, color: INK })
    })
    this.y -= 2
  }
}

async function create(title) {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  return new Writer(doc, regular, bold, { title })
}

export async function buildCv(applicant, board, now) {
  const writer = await create(`${applicant.full_name} - CV`)
  const years = totalYears(applicant.experience, now)

  writer.text(applicant.full_name, { size: 22, bold: true, gap: 2 })
  writer.text(applicant.job_title, { size: 12, color: MUTED, gap: 2 })
  writer.text(`${applicant.email}  |  ${applicant.phone}  |  South Africa`, {
    size: 9.5,
    color: MUTED,
    gap: 6,
  })

  writer.heading('Summary')
  writer.text(
    `${applicant.job_title} with ${years} ${years === 1 ? 'year' : 'years'} of experience. ` +
      `Interested in the ${board.def.name} role and keen to contribute to a collaborative team.`,
  )

  writer.heading('Work experience')
  for (const entry of applicant.experience) {
    writer.text(`${entry.title} at ${entry.organization}`, { bold: true, gap: 1 })
    writer.text(formatRange(entry), { size: 9.5, color: MUTED, gap: 2 })
    writer.text(entry.description, { gap: 8 })
  }

  writer.heading('Education')
  for (const entry of applicant.education) {
    writer.text(`${entry.title} at ${entry.organization}`, { bold: true, gap: 1 })
    writer.text(formatRange(entry), { size: 9.5, color: MUTED, gap: 8 })
  }

  writer.heading('Skills')
  writer.text(applicant.skills.join(', '))

  return writer.doc.save()
}

export async function buildJobSpec(board) {
  const { def } = board
  const writer = await create(`${def.name} - Job specification`)

  writer.text('Job specification', { size: 10, color: MUTED, gap: 2 })
  writer.text(def.name, { size: 22, bold: true, gap: 4 })
  writer.text(
    `${def.department}  |  ${def.location}  |  ${def.positions} open ${def.positions === 1 ? 'position' : 'positions'}`,
    { size: 10, color: MUTED, gap: 6 },
  )

  writer.heading('About the role')
  writer.text(def.summary)

  writer.heading('Responsibilities')
  def.responsibilities.forEach((item) => writer.bullet(item))

  writer.heading('Minimum requirements')
  def.minimum.forEach((item) => writer.bullet(item))

  writer.heading('Recommended')
  def.recommended.forEach((item) => writer.bullet(item))

  writer.heading('Skills')
  writer.text(def.skills.join(', '))

  writer.heading('How we hire')
  writer.text(`Stages: ${def.stages.join(', ')}.`)

  return writer.doc.save()
}

function totalYears(experience, now) {
  const months = experience.reduce((sum, entry) => {
    const [startYear, startMonth] = entry.start.split('-').map(Number)
    const [endYear, endMonth] = entry.current
      ? [now.getUTCFullYear(), now.getUTCMonth() + 1]
      : entry.end.split('-').map(Number)
    return sum + Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth))
  }, 0)
  return Math.max(1, Math.round(months / 12))
}
