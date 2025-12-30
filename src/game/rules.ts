import type { Card, Suit, Trick } from './types'
import { CARD_VALUES, RANK_ORDER } from './types'

export function isValidPlay(
  card: Card,
  hand: Card[],
  trick: Trick,
  _trump: Suit | null
): { valid: boolean; reason?: string } {
  if (trick.cards.length === 0) {
    return { valid: true }
  }

  const leadSuit = trick.leadSuit!
  const hasSuit = hand.some((c) => c.suit === leadSuit)

  if (hasSuit && card.suit !== leadSuit) {
    return {
      valid: false,
      reason: `Must follow suit (${leadSuit})`,
    }
  }

  return { valid: true }
}

export function getTrickWinner(trick: Trick, trump: Suit | null): string {
  if (trick.cards.length === 0) {
    throw new Error('Cannot determine winner of empty trick')
  }

  const leadSuit = trick.leadSuit!
  let winningPlay = trick.cards[0]

  for (let i = 1; i < trick.cards.length; i++) {
    const play = trick.cards[i]
    const isWinningTrump = winningPlay.card.suit === trump
    const isCurrentTrump = play.card.suit === trump

    if (isCurrentTrump && !isWinningTrump) {
      winningPlay = play
    } else if (isCurrentTrump && isWinningTrump) {
      if (compareCards(play.card, winningPlay.card) > 0) {
        winningPlay = play
      }
    } else if (!isCurrentTrump && !isWinningTrump) {
      if (play.card.suit === leadSuit && winningPlay.card.suit === leadSuit) {
        if (compareCards(play.card, winningPlay.card) > 0) {
          winningPlay = play
        }
      }
    }
  }

  return winningPlay.playerId
}

export function compareCards(a: Card, b: Card): number {
  const aIndex = RANK_ORDER.indexOf(a.rank)
  const bIndex = RANK_ORDER.indexOf(b.rank)
  return bIndex - aIndex // Lower index = higher rank
}

export function getTrickPoints(trick: Trick): number {
  return trick.cards.reduce((sum, play) => sum + CARD_VALUES[play.card.rank], 0)
}

export function calculateJodhi(
  hand: Card[],
  trump: Suit | null
): { points: number; suit: Suit } | null {
  const suitCounts: Partial<Record<Suit, { hasQ: boolean; hasK: boolean; hasJ: boolean }>> = {}

  for (const card of hand) {
    if (!suitCounts[card.suit]) {
      suitCounts[card.suit] = { hasQ: false, hasK: false, hasJ: false }
    }
    if (card.rank === 'Q') suitCounts[card.suit]!.hasQ = true
    if (card.rank === 'K') suitCounts[card.suit]!.hasK = true
    if (card.rank === 'J') suitCounts[card.suit]!.hasJ = true
  }

  for (const [suit, counts] of Object.entries(suitCounts)) {
    if (counts.hasQ && counts.hasK) {
      const isTrump = suit === trump
      const hasJack = counts.hasJ
      
      let points: number
      if (hasJack) {
        points = isTrump ? 50 : 30
      } else {
        points = isTrump ? 40 : 20
      }
      
      return { points, suit: suit as Suit }
    }
  }

  return null
}

export function canCallThunee(hand: Card[]): boolean {
  return hand.length === 6
}

export function hasTrump(hand: Card[], trump: Suit): boolean {
  return hand.some((c) => c.suit === trump)
}

export function getTargetScore(
  bidAmount: number,
  jodhiDiff: number
): number {
  return 105 - bidAmount + jodhiDiff
}

export function checkWinCondition(teams: [{ balls: number }, { balls: number }]): 0 | 1 | null {
  if (teams[0].balls >= 13) return 0
  if (teams[1].balls >= 13) return 1
  return null
}
