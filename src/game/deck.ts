import type { Card, Rank } from './types'
import { 
  createDeck as createGenericDeck, 
  shuffle, 
  cardEquals as genericCardEquals,
  cardToString as genericCardToString
} from '@/lib/cards'

// Thunee uses a 24-card deck (6 ranks × 4 suits)
const THUNEE_RANKS: Rank[] = ['J', '9', 'A', '10', 'K', 'Q']

/**
 * Create a standard 24-card Thunee deck.
 */
export function createDeck(): Card[] {
  return createGenericDeck(THUNEE_RANKS)
}

/**
 * Shuffle a deck using Fisher-Yates algorithm.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  return shuffle(deck)
}

/**
 * Deal cards to players in Thunee format.
 * - 4 players: 4 cards first phase, 2 cards second phase
 * - 2 players: 4 cards first phase, 2 cards second phase (per round)
 */
export function dealCards(
  deck: Card[],
  playerCount: 2 | 4,
  phase: 'first' | 'second'
): Card[][] {
  const cardsPerPlayer = phase === 'first' ? 4 : 2
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let p = 0; p < playerCount; p++) {
      const cardIndex = i * playerCount + p
      if (deck[cardIndex]) {
        hands[p].push(deck[cardIndex])
      }
    }
  }
  return hands
}

/**
 * Check if two cards are equal.
 */
export function cardEquals(a: Card, b: Card): boolean {
  return genericCardEquals(a, b)
}

/**
 * Convert a card to display string (e.g., "J♠").
 */
export function cardToString(card: Card): string {
  return genericCardToString(card)
}
