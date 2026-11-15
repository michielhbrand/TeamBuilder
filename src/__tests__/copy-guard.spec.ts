import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = resolve(__dirname, '..')

const excluded = new Set<string>()

const banned = [
  'Analize',
  'favourite',
  'Favourite',
  'organisation',
  'Organisation',
  'Starting column',
  'Manage columns',
  'Current step',
  'Last step',
  'Pinia',
  'JWT',
  'Orbital system',
  'Orbital System',
  'Vue 3 + Supabase',
  '[Beta]',
  'Hiring pipelines.',
  'Hiring & Recruitment',
  'Identity console',
  'Add column',
  'New column name',
  'Move column',
  'Delete column',
  'Column names',
  'candidate pipelines',
  'active candidates',
  'Closed candidates',
  'days in step',
  'Entered this step',
  '>Events<',
  '>Details<',
  'Changes save automatically',
  'Use the refresh button',
]

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : vueFiles(full)
    return name.endsWith('.vue') && !excluded.has(name) ? [full] : []
  })
}

describe('copy guard', () => {
  it('no banned user-facing copy', () => {
    const hits: string[] = []
    for (const file of vueFiles(srcDir)) {
      const rel = relative(srcDir, file)
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const phrase of banned) {
            if (line.includes(phrase)) {
              hits.push(`${rel}:${index + 1} "${phrase}"`)
            }
          }
        })
    }
    expect(hits.join('\n')).toBe('')
  })
})
