/**
 * AI bidding strategy.
 * 
 * Evaluates hand strength and decides whether to bid/pass.
 */

import type { Card, Suit } from '../../src/game/types'
import type { HandStrength, SuitAnalysis } from './types'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

/**
 * Analyze a suit in the hand for trump potential.
 */
export function analyzeSuit(hand: Card[], suit: Suit): SuitAnalysis {
  const suitCards = hand.filter(c => c.suit === suit)
  const hasJack = suitCards.some(c => c.rank === 'J')
  const hasNine = suitCards.some(c => c.rank === '9')
  const hasAce = suitCards.some(c => c.rank === 'A')
  
  // Calculate strength: J=5, 9=4, A=3, 10=2, K=1, Q=1
  let strength = suitCards.length // Base: 1 point per card
  if (hasJack) strength += 5
  if (hasNine) strength += 4
  if (hasAce) strength += 3
  suitCards.forEach(c => {
    if (c.rank === '10') strength += 2
    if (c.rank === 'K' || c.rank === 'Q') strength += 1
  })
  
  return {
    suit,
    count: suitCards.length,
    hasJack,
    hasNine,
    hasAce,
    strength
  }
}

/**
 * Evaluate overall hand strength.
 */
export function evaluateHand(hand: Card[]): HandStrength {
  const jacks = hand.filter(c => c.rank === 'J').length
  const nines = hand.filter(c => c.rank === '9').length
  const aces = hand.filter(c => c.rank === 'A').length
  
  const trumpPotential = SUITS
    .map(suit => {
      const analysis = analyzeSuit(hand, suit)
      return { suit, strength: analysis.strength }
    })
    .sort((a, b) => b.strength - a.strength)
  
  return {
    jacks,
    nines,
    aces,
    trumpPotential,
    totalHighCards: jacks + nines + aces
  }
}

/**
 * Decide whether to bid and how much.
 * Returns null if AI should pass.
 */
export function decideBid(
  hand: Card[],
  currentBid: number,
  hasAlreadyBid: boolean
): number | null {
  const strength = evaluateHand(hand)
  const bestTrump = strength.trumpPotential[0]
  
  // Calculate max bid based on hand strength
  // Base threshold: need at least 2 high cards to bid
  if (strength.totalHighCards < 2) {
    return null // Pass with weak hand
  }
  
  // Calculate max bid we're willing to make
  // Strong hand: 2+ jacks or jack+nine in same suit
  let maxBid = 0
  
  if (strength.jacks >= 2) {
    maxBid = 40 // Very strong
  } else if (strength.jacks === 1 && bestTrump.strength >= 10) {
    maxBid = 30 // Strong
  } else if (strength.totalHighCards >= 3) {
    maxBid = 25 // Decent
  } else if (strength.totalHighCards >= 2) {
    maxBid = 20 // Minimum
  }
  
  // Don't bid if current bid is already at or above our max
  if (currentBid >= maxBid) {
    return null
  }
  
  // Bid just above current bid (minimum increment is 5)
  const minBid = currentBid === 0 ? 0 : currentBid + 5
  
  // If we haven't bid yet and no one else has, sometimes pass to see what others do
  // But always bid with very strong hands (2+ jacks)
  if (!hasAlreadyBid && currentBid === 0 && strength.jacks < 2 && Math.random() < 0.3) {
    return null // Sometimes pass on first round with weaker hands
  }
  
  return Math.min(minBid, maxBid)
}

/**
 * Choose the best trump suit from the hand.
 */
export function chooseTrumpSuit(hand: Card[]): Suit {
  const analyses = SUITS.map(suit => analyzeSuit(hand, suit))
  analyses.sort((a, b) => b.strength - a.strength)
  return analyses[0].suit
}

/**
 * Decide whether to call "last card" trump (weaker position).
 */
export function shouldCallLastCard(hand: Card[]): boolean {
  const strength = evaluateHand(hand)
  // Only call last card if hand is weak (no jacks, few high cards)
  return strength.jacks === 0 && strength.totalHighCards <= 1
}
