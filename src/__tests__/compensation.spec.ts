import { describe, expect, it } from 'vitest'
import {
  formatNoticePeriod,
  formatSalaryCents,
  parseNoticePeriod,
  parseSalaryToCents,
} from '@/lib/compensation'

describe('notice period', () => {
  it('parses whole and decimal months', () => {
    expect(parseNoticePeriod('1')).toBe(1)
    expect(parseNoticePeriod('1.5')).toBe(1.5)
    expect(parseNoticePeriod('1,5')).toBe(1.5)
    expect(parseNoticePeriod(' 2 ')).toBe(2)
    expect(parseNoticePeriod('')).toBe(0)
  })

  it('rejects negative, malformed, and over-precise values', () => {
    expect(parseNoticePeriod('-1')).toBeNull()
    expect(parseNoticePeriod('1.25')).toBeNull()
    expect(parseNoticePeriod('one')).toBeNull()
    expect(parseNoticePeriod('1.')).toBeNull()
  })

  it('formats without trailing zeros', () => {
    expect(formatNoticePeriod(0)).toBe('0')
    expect(formatNoticePeriod(1)).toBe('1')
    expect(formatNoticePeriod(1.5)).toBe('1.5')
  })
})

describe('salary expectation', () => {
  it('parses rand values into cents', () => {
    expect(parseSalaryToCents('0')).toBe(0)
    expect(parseSalaryToCents('25000')).toBe(2500000)
    expect(parseSalaryToCents('25000.50')).toBe(2500050)
    expect(parseSalaryToCents('25000,50')).toBe(2500050)
    expect(parseSalaryToCents('R 25 000,50')).toBe(2500050)
    expect(parseSalaryToCents('')).toBe(0)
  })

  it('rejects negative, malformed, and over-precise values', () => {
    expect(parseSalaryToCents('-1')).toBeNull()
    expect(parseSalaryToCents('25000.505')).toBeNull()
    expect(parseSalaryToCents('abc')).toBeNull()
    expect(parseSalaryToCents('25.000.00')).toBeNull()
  })

  it('formats cents with two decimal places', () => {
    expect(formatSalaryCents(0)).toBe('0.00')
    expect(formatSalaryCents(2500000)).toBe('25000.00')
    expect(formatSalaryCents(2500050)).toBe('25000.50')
  })
})
