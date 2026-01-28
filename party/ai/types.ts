/**
 * AI decision types and interfaces.
 */

import type { Card, Suit } from '../../src/game/types'

// All possible AI decisions
export type AIDecision =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'set-trump'; suit: Suit; lastCard?: boolean }
  | { type: 'play-card'; card: Card }
  | { type: 'call-thunee' }
  | { type: 'call-jodhi'; suit: Suit; withJack: boolean }
  | { type: 'skip' }  // No action needed

// Hand evaluation for bidding decisions
export interface HandStrength {
  jacks: number
  nines: number
  aces: number
  trumpPotential: { suit: Suit; strength: number }[]
  totalHighCards: number
}

// Suit analysis for trump selection
export interface SuitAnalysis {
  suit: Suit
  count: number
  hasJack: boolean
  hasNine: boolean
  hasAce: boolean
  strength: number  // Combined strength score
}
