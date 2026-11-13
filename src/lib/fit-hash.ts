function fallbackHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5

  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

async function digestBytes(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    return fallbackHash(bytes)
  }

  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function sha256Text(value: string): Promise<string> {
  return digestBytes(new TextEncoder().encode(value))
}

export function sha256Bytes(value: Uint8Array): Promise<string> {
  return digestBytes(value)
}

export function profileFingerprint(education: string, experience: string): Promise<string> {
  return sha256Text(`${education.trim()}\n\n${experience.trim()}`)
}
