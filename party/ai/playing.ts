/**
 * AI card play strategy.
 * 
 * Decides which card to play based on game state.
 */

import type { Card, Suit, Trick, Player, GameState } from '../../src/game/types'
import { RANK_ORDER, CARD_VALUES } from '../../src/game/types'
import { compareCards } from '../../src/game/rules'

/**
 * Get valid cards that can be played.
 */
export function getValidCards(hand: Card[], trick: Trick): Card[] {
  if (trick.cards.length === 0) {
    return hand // Can play any card when leading
  }
  
  const leadSuit = trick.leadSuit!
  const suitCards = hand.filter(c => c.suit === leadSuit)
  
  // Must follow suit if possible
  if (suitCards.length > 0) {
    return suitCards
  }
  
  // Can play any card if void in lead suit
  return hand
}

/**
 * Find the current winning card in a trick.
 */
function getCurrentWinner(trick: Trick, trump: Suit | null): { playerId: string; card: Card } | null {
  if (trick.cards.length === 0) return null
  
  let winner = trick.cards[0]
  const leadSuit = trick.leadSuit!
  
  for (let i = 1; i < trick.cards.length; i++) {
    const play = trick.cards[i]
    const winnerIsTrump = winner.card.suit === trump
    const currentIsTrump = play.card.suit === trump
    
    if (currentIsTrump && !winnerIsTrump) {
      winner = play
    } else if (currentIsTrump && winnerIsTrump) {
      if (compareCards(play.card, winner.card) > 0) {
        winner = play
      }
    } else if (!currentIsTrump && !winnerIsTrump) {
      if (play.card.suit === leadSuit && winner.card.suit === leadSuit) {
        if (compareCards(play.card, winner.card) > 0) {
          winner = play
        }
      }
    }
  }
  
  return winner
}

/**
 * Check if a card can beat the current winner.
 */
function canBeat(card: Card, winner: Card, leadSuit: Suit, trump: Suit | null): boolean {
  const winnerIsTrump = winner.suit === trump
  const cardIsTrump = card.suit === trump
  
  if (cardIsTrump && !winnerIsTrump) return true
  if (cardIsTrump && winnerIsTrump) return compareCards(card, winner) > 0
  if (!cardIsTrump && !winnerIsTrump) {
    if (card.suit === leadSuit && winner.suit === leadSuit) {
      return compareCards(card, winner) > 0
    }
  }
  return false
}

/**
 * Get the lowest value card from a list.
 */
function getLowestCard(cards: Card[]): Card {
  return cards.reduce((lowest, card) => 
    CARD_VALUES[card.rank] < CARD_VALUES[lowest.rank] ? card : lowest
  )
}

/**
 * Get the highest value card from a list.
 */
function getHighestCard(cards: Card[]): Card {
  return cards.reduce((highest, card) => 
    CARD_VALUES[card.rank] > CARD_VALUES[highest.rank] ? card : highest
  )
}

/**
 * Get the lowest card that can beat the current winner.
 */
function getLowestWinningCard(cards: Card[], winner: Card, leadSuit: Suit, trump: Suit | null): Card | null {
  const winners = cards.filter(c => canBeat(c, winner, leadSuit, trump))
  if (winners.length === 0) return null
  return getLowestCard(winners)
}

/**
 * Decide which card to play.
 */
export function decidePlay(
  state: GameState,
  playerId: string
): Card {
  const player = state.players.find(p => p.id === playerId)
  if (!player) throw new Error('Player not found')
  
  const hand = player.hand
  const trick = state.currentTrick
  const trump = state.trump
  const validCards = getValidCards(hand, trick)
  
  // Only one valid card - play it
  if (validCards.length === 1) {
    return validCards[0]
  }
  
  // Leading the trick
  if (trick.cards.length === 0) {
    return decideLeadCard(hand, trump, state)
  }
  
  // Following in trick
  const currentWinner = getCurrentWinner(trick, trump)
  if (!currentWinner) {
    return getLowestCard(validCards)
  }
  
  const leadSuit = trick.leadSuit!
  const partnerIsWinning = isPartnerWinning(state, playerId, currentWinner.playerId)
  
  // Partner is winning - play low
  if (partnerIsWinning) {
    return getLowestCard(validCards)
  }
  
  // Try to win the trick
  const winningCard = getLowestWinningCard(validCards, currentWinner.card, leadSuit, trump)
  if (winningCard) {
    // Consider if the trick is worth winning (high points)
    const trickPoints = trick.cards.reduce((sum, p) => sum + CARD_VALUES[p.card.rank], 0)
    if (trickPoints >= 20 || state.tricksPlayed >= 4) {
      return winningCard
    }
    // Early trick with low points - might still win to control
    if (CARD_VALUES[winningCard.rank] <= 10) {
      return winningCard
    }
  }
  
  // Can't win or not worth it - play lowest
  return getLowestCard(validCards)
}

/**
 * Decide which card to lead with.
 */
function decideLeadCard(hand: Card[], trump: Suit | null, state: GameState): Card {
  // Avoid leading with trump early unless we have strong trump
  const nonTrumpCards = trump ? hand.filter(c => c.suit !== trump) : hand
  
  if (nonTrumpCards.length > 0) {
    // Lead from longest non-trump suit
    const suitCounts = new Map<Suit, Card[]>()
    for (const card of nonTrumpCards) {
      const existing = suitCounts.get(card.suit) || []
      existing.push(card)
      suitCounts.set(card.suit, existing)
    }
    
    // Find longest suit
    let longestSuit: Suit | null = null
    let maxLength = 0
    for (const [suit, cards] of suitCounts) {
      if (cards.length > maxLength) {
        maxLength = cards.length
        longestSuit = suit
      }
    }
    
    if (longestSuit) {
      const suitCards = suitCounts.get(longestSuit)!
      // Lead high from long suit if we have J or 9
      const hasJack = suitCards.some(c => c.rank === 'J')
      if (hasJack) {
        return suitCards.find(c => c.rank === 'J')!
      }
      // Otherwise lead low to probe
      return getLowestCard(suitCards)
    }
  }
  
  // Only have trump - lead lowest trump
  return getLowestCard(hand)
}

/**
 * Check if partner is currently winning the trick.
 */
function isPartnerWinning(state: GameState, playerId: string, winnerId: string): boolean {
  const player = state.players.find(p => p.id === playerId)
  const winner = state.players.find(p => p.id === winnerId)
  
  if (!player || !winner) return false
  
  // In 4-player game, partners are on same team
  return player.team === winner.team && player.id !== winner.id
}
