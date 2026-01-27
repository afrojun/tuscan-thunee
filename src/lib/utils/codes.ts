/**
 * Generate a human-readable game code.
 * Excludes confusing characters: I, O, 0, 1
 */
export function generateGameCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Generate a unique player ID using crypto.randomUUID.
 */
export function generatePlayerId(): string {
  return crypto.randomUUID()
}
