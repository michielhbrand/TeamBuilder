import { describe, expect, it } from 'vitest'
import {
  careerEntryError,
  createCareerEntry,
  employmentGaps,
  entryDuration,
  formatEntriesText,
  formatMonths,
  formatPeriod,
  hasCareerContent,
  isValidMonth,
  layoutStrip,
  normalizeEntries,
  serializeEntries,
  sortEntries,
  totalMonths,
} from '@/lib/career'
import { profileFingerprint, sha256Text } from '@/lib/fit-hash'
import { formatCareerEntries } from '../../supabase/functions/fit-analysis/career'
import type { CareerEntry } from '@/types/pipeline'

const NOW = '2026-11'

function entry(overrides: Partial<CareerEntry>): CareerEntry {
  return createCareerEntry({ title: 'Role', ...overrides })
}

describe('normalizeEntries', () => {
  it('drops non-objects, rejects invalid months and clears the end of a current entry', () => {
    const entries = normalizeEntries([
      'nope',
      null,
      { id: 'a', title: 'Engineer', start: '2020-13', end: '2021-02', current: false },
      { id: 'b', title: 'Lead', start: '2021-03', end: '2022-01', current: true },
    ])

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ id: 'a', start: '', end: '2021-02' })
    expect(entries[1]).toMatchObject({ id: 'b', start: '2021-03', end: '', current: true })
  })

  it('returns an empty list for anything that is not an array', () => {
    expect(normalizeEntries(null)).toEqual([])
    expect(normalizeEntries('text')).toEqual([])
  })
})

describe('serializeEntries', () => {
  it('trims text, clears the end of current entries and drops empty entries', () => {
    const saved = serializeEntries([
      entry({ title: '  Engineer ', organization: ' Acme ', current: true, end: '2024-01' }),
      createCareerEntry(),
    ])

    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ title: 'Engineer', organization: 'Acme', end: '' })
  })

  it('validates months, clears reversed spans and sorts newest first', () => {
    const saved = serializeEntries([
      entry({ id: 'old', start: '2010-01', end: '2011-01' }),
      entry({ id: 'invalid', start: '2020-13', end: '2021-01' }),
      entry({ id: 'reversed', start: '2022-05', end: '2021-01' }),
      entry({ id: 'new', start: '2020-01', current: true }),
    ])

    expect(saved.map((item) => item.id)).toEqual(['reversed', 'new', 'old', 'invalid'])
    expect(saved.find((item) => item.id === 'invalid')).toMatchObject({
      start: '',
      end: '2021-01',
    })
    expect(saved.find((item) => item.id === 'reversed')).toMatchObject({ end: '' })
  })

  it('detects whether any entry has content', () => {
    expect(hasCareerContent([], [createCareerEntry()])).toBe(false)
    expect(hasCareerContent([], [entry({})])).toBe(true)
  })
})

describe('careerEntryError', () => {
  it('requires a title and valid ordered month and year values', () => {
    expect(careerEntryError(entry({ title: '' }), 'experience')).toBe('Enter a job title.')
    expect(careerEntryError(entry({ title: '' }), 'education')).toBe('Enter a qualification.')
    expect(careerEntryError(entry({ start: '' }), 'experience')).toBe(
      'Choose a valid start month and year.',
    )
    expect(careerEntryError(entry({ start: '2020-01', end: '' }), 'experience')).toContain(
      'valid end month',
    )
    expect(careerEntryError(entry({ start: '2021-01', end: '2020-01' }), 'experience')).toBe(
      'The end month must not be before the start month.',
    )
    expect(careerEntryError(entry({ start: '2020-01', current: true }), 'experience')).toBe('')
    expect(careerEntryError(entry({ start: '2020-01', end: '2020-12' }), 'education')).toBe('')
  })
})

describe('dates and durations', () => {
  it('validates YYYY-MM month values', () => {
    expect(isValidMonth('2020-01')).toBe(true)
    expect(isValidMonth('2020-12')).toBe(true)
    expect(isValidMonth('2020-13')).toBe(false)
    expect(isValidMonth('2020-1')).toBe(false)
    expect(isValidMonth('2020-00')).toBe(false)
    expect(isValidMonth('')).toBe(false)
    expect(isValidMonth(null)).toBe(false)
  })

  it('formats periods and durations', () => {
    const current = entry({ start: '2022-03', current: true })

    expect(formatPeriod(current)).toBe('Mar 2022 – Present')
    expect(entryDuration(current, NOW)).toBe('4 yrs 9 mos')
    expect(formatPeriod(entry({ start: '2017-06', end: '2017-12' }))).toBe('Jun 2017 – Dec 2017')
    expect(entryDuration(entry({ start: '2017-06', end: '2017-12' }), NOW)).toBe('7 mos')
    expect(formatMonths(12)).toBe('1 yr')
  })

  it('shows nothing for an entry with a reversed span', () => {
    expect(entryDuration(entry({ start: '2022-05', end: '2021-01' }), NOW)).toBe('')
  })

  it('sorts newest first with undated entries last', () => {
    const sorted = sortEntries([
      entry({ id: 'undated' }),
      entry({ id: 'old', start: '2010-01', end: '2011-01' }),
      entry({ id: 'new', start: '2020-01', end: '2021-01' }),
    ])

    expect(sorted.map((item) => item.id)).toEqual(['new', 'old', 'undated'])
  })
})

describe('totals and gaps', () => {
  const roles = [
    entry({ start: '2017-06', end: '2017-12' }),
    entry({ start: '2018-06', end: '2022-02' }),
    entry({ start: '2021-01', end: '2022-12' }),
    entry({ start: '2023-01', current: true }),
  ]

  it('counts overlapping months once', () => {
    expect(totalMonths([roles[1]!, roles[2]!], NOW)).toBe(55)
    expect(totalMonths(roles, NOW)).toBe(7 + 55 + 47)
  })

  it('reports gaps longer than three months', () => {
    expect(employmentGaps(roles, NOW)).toEqual([{ from: '2017-12', to: '2018-06', months: 5 }])
  })

  it('ignores short breaks', () => {
    expect(
      employmentGaps(
        [entry({ start: '2020-01', end: '2020-06' }), entry({ start: '2020-08', end: '2021-01' })],
        NOW,
      ),
    ).toEqual([])
  })
})

describe('layoutStrip', () => {
  it('returns null when no entry has a valid span', () => {
    expect(layoutStrip([entry({})], [], ['experience', 'education'], NOW)).toBeNull()
  })

  it('packs non-overlapping bars on one row and overlapping bars on another', () => {
    const layout = layoutStrip(
      [entry({ start: '2018-01', end: '2019-12' }), entry({ start: '2020-01', end: '2021-12' })],
      [entry({ start: '2018-06', end: '2019-06' }), entry({ start: '2019-01', end: '2020-06' })],
      ['experience', 'education'],
      NOW,
    )

    expect(layout?.lanes[0]?.rows).toHaveLength(1)
    expect(layout?.lanes[1]?.rows).toHaveLength(2)
    layout?.lanes.forEach((lane) =>
      lane.rows.flat().forEach((bar) => {
        expect(bar.left).toBeGreaterThanOrEqual(0)
        expect(bar.left + bar.width).toBeLessThanOrEqual(100.0001)
      }),
    )
  })

  it('places a gap box between work bars and none for education only', () => {
    const work = [
      entry({ start: '2017-06', end: '2017-12' }),
      entry({ start: '2018-06', end: '2019-12' }),
    ]

    expect(layoutStrip(work, [], ['experience'], NOW)?.gaps).toHaveLength(1)
    expect(layoutStrip([], work, ['education'], NOW)?.gaps).toEqual([])
  })
})

describe('text formatting for fit analysis', () => {
  it('formats an entry with a heading, period and description', () => {
    expect(
      formatEntriesText([
        entry({
          title: 'Engineer',
          organization: 'Acme',
          start: '2020-01',
          end: '2021-02',
          description: 'Built things.',
        }),
      ]),
    ).toBe('Engineer — Acme\nJan 2020 – Feb 2021\nBuilt things.')
  })

  it('keeps a description-only entry identical to the old free text', () => {
    const text = 'BSc Computer Science\nUniversity of Cape Town'

    expect(formatEntriesText([createCareerEntry({ description: `  ${text}  ` })])).toBe(text)
  })

  it('matches the edge function formatter exactly', () => {
    const entries: CareerEntry[] = [
      entry({
        title: ' Engineer ',
        organization: 'Acme',
        start: '2020-01',
        current: true,
        description: 'Built things.\nLed a team.',
      }),
      entry({ title: 'Intern', start: '2018-06', end: '2018-12' }),
      entry({ title: '', description: 'Free text only' }),
      entry({ title: 'No dates', organization: 'Org' }),
      createCareerEntry(),
    ]

    expect(formatCareerEntries(entries)).toBe(formatEntriesText(entries))
    expect(formatCareerEntries(null)).toBe('')
  })

  it('fingerprints the same way the server does', async () => {
    const education = [entry({ title: 'BSc', start: '2014-02', end: '2017-11' })]
    const experience = [entry({ title: 'Engineer', start: '2022-03', current: true })]

    expect(await profileFingerprint(education, experience)).toBe(
      await sha256Text(`${formatCareerEntries(education)}\n\n${formatCareerEntries(experience)}`),
    )
  })
})
