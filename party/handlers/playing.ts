/**
 * Playing phase handlers - playing cards, calling Jodhi, completing tricks.
 */

import type { GameState, Card, Suit, TrickResult } from '../../src/game/types'
import { cardEquals } from '../../src/game/deck'
import { getTrickWinner, getTrickPoints } from '../../src/game/rules'
import { getNextPlayerIndex } from '../../src/game/utils'
import { createEmptyTrick } from '../../src/game/state'

/**
 * Handle a Jodhi call (K+Q in a suit).
 * Returns true if the call was valid and recorded.
 */
export function handleCallJodhi(
  state: GameState,
  playerId: string,
  suit: Suit,
  withJack: boolean
): boolean {
  if (state.phase !== 'playing' && state.phase !== 'trick-complete') return false
  if (!state.jodhiWindow) return false

  // Caller must be on the winning team
  const caller = state.players.find(p => p.id === playerId)
  if (!caller) return false
  if (caller.team !== state.lastTrickWinningTeam) return false

  // Check if already called Jodhi for this suit by this player
  const alreadyCalled = state.jodhiCalls.some(j =>
    j.playerId === playerId && j.suit === suit
  )
  if (alreadyCalled) return false

  // Calculate points based on claim (not validation - that happens on challenge)
  const isTrump = suit === state.trump
  const points = withJack 
    ? (isTrump ? 50 : 30) 
    : (isTrump ? 40 : 20)

  state.jodhiCalls.push({
    playerId,
    points,
    suit,
    hasJack: withJack
  })

  // Log the jodhi call
  state.eventLog.push({
    type: 'jodhi-call',
    data: { playerId, suit, points, hasJack: withJack },
    roundNumber: state.gameRound,
    timestamp: Date.now()
  })

  return true
}

/**
 * Result of playing a card.
 */
export type PlayCardResult =
  | { success: false }
  | { success: true; trickComplete: false; nextPlayerId: string }
  | { success: true; trickComplete: true; trickResult: TrickResult }

/**
 * Handle playing a card.
 */
export function handlePlayCard(
  state: GameState,
  playerId: string,
  card: Card
): PlayCardResult {
  if (state.phase !== 'playing') return { success: false }
  if (state.currentPlayerId !== playerId) return { success: false }

  // Close jodhi window and clear last trick result when a card is played
  state.jodhiWindow = false
  state.lastTrickResult = null

  const player = state.players.find(p => p.id === playerId)
  if (!player) return { success: false }

  const cardIndex = player.hand.findIndex(c => cardEquals(c, card))
  if (cardIndex === -1) return { success: false }

  // Remove card from hand
  player.hand.splice(cardIndex, 1)

  // Add to trick
  if (state.currentTrick.cards.length === 0) {
    state.currentTrick.leadSuit = card.suit
    // Reveal trump when first card of first trick is played
    if (state.tricksPlayed === 0 && !state.trumpRevealed) {
      state.trumpRevealed = true
    }
  }
  state.currentTrick.cards.push({ playerId, card })

  // Check if trick is complete
  if (state.currentTrick.cards.length === state.players.length) {
    const trickResult = completeTrick(state)
    return { success: true, trickComplete: true, trickResult }
  } else {
    // Next player
    const currentIndex = state.players.findIndex(p => p.id === playerId)
    const nextIndex = getNextPlayerIndex(currentIndex, state.playerCount)
    const nextPlayerId = state.players[nextIndex].id
    state.currentPlayerId = nextPlayerId
    return { success: true, trickComplete: false, nextPlayerId }
  }
}

/**
 * Complete the current trick, determine winner, and update state.
 */
export function completeTrick(state: GameState): TrickResult {
  const winnerId = getTrickWinner(state.currentTrick, state.trump)
  state.currentTrick.winnerId = winnerId

  // Add points to winning team
  const winner = state.players.find(p => p.id === winnerId)!
  const points = getTrickPoints(state.currentTrick)
  state.teams[winner.team].cardPoints += points

  // Find winning card and determine reason
  const winningPlay = state.currentTrick.cards.find(c => c.playerId === winnerId)!
  const wonByTrump = state.trump && winningPlay.card.suit === state.trump

  // Store trick result for UI display
  const trickResult: TrickResult = {
    winnerId,
    winnerName: winner.name,
    winningCard: winningPlay.card,
    points,
    reason: wonByTrump ? 'trump' : 'highest'
  }
  state.lastTrickResult = trickResult

  // Save trick to event log
  state.eventLog.push({
    type: 'trick',
    data: { ...state.currentTrick, winnerId },
    roundNumber: state.gameRound,
    timestamp: Date.now()
  })

  state.tricksPlayed++

  // Open jodhi window for winning team
  state.jodhiWindow = true
  state.lastTrickWinningTeam = winner.team

  // Enter trick-complete phase
  state.phase = 'trick-complete'

  return trickResult
}

/**
 * Result of trick display completing.
 */
export type TrickDisplayResult =
  | { roundOver: false; nextLeaderId: string }
  | { roundOver: true }

/**
 * Handle the trick display timer completing.
 */
export function handleTrickDisplayComplete(state: GameState): TrickDisplayResult {
  if (state.tricksPlayed === 6) {
    return { roundOver: true }
  }

  // Winner leads next trick
  const winnerId = state.currentTrick.winnerId!
  state.currentTrick = createEmptyTrick()
  state.currentPlayerId = winnerId
  state.phase = 'playing'

  return { roundOver: false, nextLeaderId: winnerId }
}
