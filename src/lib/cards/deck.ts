import type { Card, Suit } from './types'
import { SUITS, SUIT_SYMBOLS } from './types'

/**
 * Fisher-Yates shuffle algorithm.
 * Returns a new shuffled array without mutating the original.
 */
export function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Create a deck from a list of ranks.
 * Each rank is paired with each suit.
 */
export function createDeck<R extends string>(ranks: R[]): Card<R>[] {
  const deck: Card<R>[] = []
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

/**
 * Check if two cards are equal (same suit and rank).
 */
export function cardEquals<R extends string>(a: Card<R>, b: Card<R>): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

/**
 * Convert a card to a display string (e.g., "A♠").
 */
export function cardToString<R extends string>(card: Card<R>): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`
}

// Re-export types for convenience
export { SUITS, SUIT_SYMBOLS, type Suit, type Card }
