import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { generateDataset } from './seed/data.mjs'
import { buildCv, buildJobSpec } from './seed/pdf.mjs'
import { buildSql } from './seed/sql.mjs'

const STAGING_PROJECT_REF = 'pmowsjyhabzhmaeivomf'

const USAGE = `Fill the staging Supabase project with fictional demo data.

Usage:
  npm run seed:staging -- --confirm <staging-project-ref> [--rehearse] [--replace]
  npm run seed:staging -- --generate-only --out <dir>

Options:
  --confirm <ref>   Required. Must equal the project ref of the staging URL.
  --rehearse        Run every SQL statement in a transaction that is rolled back,
                    and skip the PDF uploads. Use it to check the seed first.
  --replace         Delete ALL existing boards, applicants and hiring history first.
  --generate-only   Write the PDFs and seed.sql to --out and exit. Needs no credentials.
  --out <dir>       Output directory for --generate-only.

Reads .env.staging.local (gitignored) or the shell:
  STAGING_VITE_SUPABASE_URL, STAGING_VITE_SUPABASE_PUBLISHABLE_KEY,
  STAGING_SUPABASE_DB_URL, STAGING_SEED_EMAIL, STAGING_SEED_PASSWORD
`

function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { rehearse: false, replace: false, generateOnly: false, confirm: '', out: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--rehearse') args.rehearse = true
    else if (arg === '--replace') args.replace = true
    else if (arg === '--generate-only') args.generateOnly = true
    else if (arg === '--confirm') args.confirm = argv[(index += 1)] ?? ''
    else if (arg === '--out') args.out = argv[(index += 1)] ?? ''
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else fail(`Unknown option ${arg}\n\n${USAGE}`)
  }
  return args
}

function readEnvFile(path) {
  const values = {}
  if (!existsSync(path)) {
    return values
  }
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) {
      values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return values
}

function projectRef(supabaseUrl) {
  return new URL(supabaseUrl).hostname.split('.')[0]
}

function dbRef(dbUrl) {
  const url = new URL(dbUrl)
  const pooled = /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(url.username))
  if (pooled) {
    return pooled[1]
  }
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)
  return direct ? direct[1] : ''
}

function protectedHosts() {
  const hosts = new Set()
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const value = readEnvFile(file).VITE_SUPABASE_URL
    if (value) {
      try {
        hosts.add(new URL(value).hostname)
      } catch {
        continue
      }
    }
  }
  return hosts
}

function psql(dbUrl, args) {
  try {
    return execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  } catch (error) {
    if (error.code === 'ENOENT') {
      fail(
        'psql is not installed. Install it (for example `brew install libpq`) and add it to PATH.',
      )
    }
    fail('The database step failed (see the message above). Nothing was partially saved.')
  }
}

async function buildFiles(dataset) {
  const files = []
  for (const board of dataset.boards) {
    files.push({
      bucket: 'job-specs',
      path: board.job_spec_path,
      bytes: await buildJobSpec(board),
    })
  }
  const boardsById = new Map(dataset.boards.map((board) => [board.id, board]))
  for (const applicant of dataset.applicants) {
    files.push({
      bucket: 'cvs',
      path: applicant.cv_path,
      bytes: await buildCv(applicant, boardsById.get(applicant.board_id), dataset.now),
    })
  }
  return files
}

async function upload(env, files) {
  const supabase = createClient(
    env.STAGING_VITE_SUPABASE_URL,
    env.STAGING_VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: env.STAGING_SEED_EMAIL,
    password: env.STAGING_SEED_PASSWORD,
  })
  if (signInError) {
    fail(`Could not sign in to staging as ${env.STAGING_SEED_EMAIL}: ${signInError.message}`)
  }

  let done = 0
  for (let index = 0; index < files.length; index += 8) {
    await Promise.all(
      files.slice(index, index + 8).map(async (file) => {
        const { error } = await supabase.storage.from(file.bucket).upload(file.path, file.bytes, {
          contentType: 'application/pdf',
          upsert: true,
        })
        if (error) {
          throw new Error(`Upload of ${file.bucket}/${file.path} failed: ${error.message}`)
        }
        done += 1
      }),
    )
    process.stdout.write(`\r  uploaded ${done}/${files.length} PDFs`)
  }
  process.stdout.write('\n')
  await supabase.auth.signOut()
}

const args = parseArgs(process.argv.slice(2))
const dataset = generateDataset(new Date())

console.log(
  `Generated ${dataset.boards.length} roles, ${dataset.applicants.length} applicants, ` +
    `${dataset.events.length} audit events, ${dataset.notes.length} notes, ` +
    `${dataset.hiringMonthly.length} history months and ${dataset.hireHistory.length} hire records.`,
)

if (args.generateOnly) {
  if (!args.out) {
    fail('--generate-only needs --out <dir>.')
  }
  const files = await buildFiles(dataset)
  for (const file of files) {
    const target = join(args.out, file.bucket, file.path)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, file.bytes)
  }
  writeFileSync(join(args.out, 'seed.sql'), buildSql(dataset, { replace: true, rehearse: true }))
  console.log(`Wrote ${files.length} PDFs and seed.sql to ${args.out}`)
  process.exit(0)
}

const env = { ...readEnvFile('.env.staging.local'), ...process.env }
const required = [
  'STAGING_VITE_SUPABASE_URL',
  'STAGING_VITE_SUPABASE_PUBLISHABLE_KEY',
  'STAGING_SUPABASE_DB_URL',
  'STAGING_SEED_EMAIL',
  'STAGING_SEED_PASSWORD',
]
const missing = required.filter((name) => !env[name]?.trim())
if (missing.length) {
  fail(`Missing: ${missing.join(', ')}\nAdd them to .env.staging.local (gitignored).\n\n${USAGE}`)
}

if (env.STAGING_VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_')) {
  fail('STAGING_VITE_SUPABASE_PUBLISHABLE_KEY must be the publishable key, never a secret key.')
}

const ref = projectRef(env.STAGING_VITE_SUPABASE_URL)
const databaseRef = dbRef(env.STAGING_SUPABASE_DB_URL)

if (ref !== STAGING_PROJECT_REF) {
  fail(
    `This script only runs against the staging project (${STAGING_PROJECT_REF}), but the API URL ` +
      `points at "${ref}". Nothing was changed.`,
  )
}

if (!args.confirm) {
  fail(`Refusing to run without --confirm. The target project ref is "${ref}".`)
}
if (args.confirm !== ref) {
  fail(`--confirm "${args.confirm}" does not match the target project ref "${ref}".`)
}
if (databaseRef !== ref) {
  fail(
    `STAGING_SUPABASE_DB_URL points at project "${databaseRef || 'unknown'}" but the API URL ` +
      `points at "${ref}". Both must be the staging project.`,
  )
}
if (protectedHosts().has(new URL(env.STAGING_VITE_SUPABASE_URL).hostname)) {
  fail('The target matches a production URL in your local .env files. Refusing to continue.')
}

console.log(`Target project: ${ref}${args.rehearse ? ' (rehearsal, nothing is saved)' : ''}`)

const existing = psql(env.STAGING_SUPABASE_DB_URL, [
  '-At',
  '-c',
  'select (select count(*) from public.boards), (select count(*) from public.hiring_monthly), (select count(*) from public.hire_history)',
])
  .trim()
  .split('|')
  .map(Number)
if (existing.some((count) => count > 0) && !args.replace) {
  fail(
    `Staging already has data (boards ${existing[0]}, history months ${existing[1]}, hire records ${existing[2]}).\n` +
      'Re-run with --replace to delete it all and load the demo data.',
  )
}
if (args.replace && existing.some((count) => count > 0)) {
  console.log(
    `--replace will delete ${existing[0]} boards (with their applicants, events and notes) and all hiring history.`,
  )
}

const files = await buildFiles(dataset)
if (!args.rehearse) {
  console.log('Uploading PDFs...')
  await upload(env, files)
}

const sqlPath = join(process.env.TMPDIR || '/tmp', `teambuilder-seed-${process.pid}.sql`)
writeFileSync(sqlPath, buildSql(dataset, { replace: args.replace, rehearse: args.rehearse }), {
  mode: 0o600,
})
console.log('Writing database rows...')
psql(env.STAGING_SUPABASE_DB_URL, ['-q', '-f', sqlPath])

console.log(
  args.rehearse
    ? 'Rehearsal passed: the SQL ran cleanly and was rolled back.'
    : 'Done. Sign in to staging to see the demo data.',
)
