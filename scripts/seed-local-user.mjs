import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

function loadLocalEnv() {
  if (!existsSync('.env.local')) {
    return
  }

  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

function authHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }
}

loadLocalEnv()

const email = process.env.LOCAL_USER_EMAIL?.trim() || 'dev@example.com'
const password = process.env.LOCAL_USER_PASSWORD?.trim() || 'LocalDev123!'
const fullName = process.env.LOCAL_USER_NAME?.trim() || 'Local Dev'

if (!email.includes('@')) {
  console.error('LOCAL_USER_EMAIL must be a valid email address.')
  process.exit(1)
}

if (password.length < 8) {
  console.error('LOCAL_USER_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

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

if (!status.API_URL || !status.SERVICE_ROLE_KEY) {
  console.error('Local Supabase status did not return the API URL and service role key.')
  process.exit(1)
}

const headers = authHeaders(status.SERVICE_ROLE_KEY)

try {
  const listResponse = await fetch(`${status.API_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers,
  })

  if (!listResponse.ok) {
    throw new Error(`could not list users (${listResponse.status})`)
  }

  const listPayload = await listResponse.json()
  const users = Array.isArray(listPayload) ? listPayload : (listPayload.users ?? [])
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  const userPayload = JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  const response = existing
    ? await fetch(`${status.API_URL}/auth/v1/admin/users/${existing.id}`, {
        method: 'PUT',
        headers,
        body: userPayload,
      })
    : await fetch(`${status.API_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: userPayload,
      })

  if (!response.ok) {
    throw new Error(`could not ${existing ? 'update' : 'create'} the user (${response.status})`)
  }

  console.log(`Local user ready: ${email}`)
} catch (caught) {
  console.error(caught instanceof Error ? caught.message : 'The local user could not be seeded.')
  process.exit(1)
}
