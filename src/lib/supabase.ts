import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

if (supabasePublishableKey.startsWith('sb_secret_')) {
  throw new Error(
    'A Supabase secret key must never be used in the browser. Use the publishable key instead.',
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Keep the JWT in the Pinia auth store only; never write it to browser storage.
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
