import { execFileSync, spawn } from 'node:child_process'

let status

try {
  status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
    }),
  )
} catch {
  console.error('Start the local Supabase stack with `npm run supabase:start` first.')
  process.exit(1)
}

if (!status.API_URL || !status.PUBLISHABLE_KEY) {
  console.error('Local Supabase status did not return the API URL and publishable key.')
  process.exit(1)
}

const child = spawn('npm', ['run', 'dev'], {
  env: {
    ...process.env,
    VITE_SUPABASE_URL: status.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
