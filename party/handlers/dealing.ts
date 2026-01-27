/**
 * Dealing phase handlers - deck setup, card distribution, trumper determination.
 */

import type { GameState } from '../../src/game/types'
import { createDeck, shuffleDeck } from '../../src/game/deck'
import { createEmptyTrick, createEmptyBidState } from '../../src/game/state'

/**
 * Determine which team should get default trump rights.
 * Priority: 1) Team ahead in balls, 2) Last round winner, 3) null (fallback to RHO)
 */
export function determineTrumpingTeam(state: GameState): 0 | 1 | null {
  const team0Balls = state.teams[0].balls
  const team1Balls = state.teams[1].balls

  // Team ahead gets to trump
  if (team0Balls > team1Balls) return 0
  if (team1Balls > team0Balls) return 1

  // If tied, last round winner gets to trump
  const lastRoundEnd = [...state.eventLog]
    .reverse()
    .find((e): e is Extract<typeof e, { type: 'round-end' }> => e.type === 'round-end')

  if (lastRoundEnd) {
    return lastRoundEnd.data.winningTeam
  }

  return null
}

/**
 * Determine the default trumper based on game state.
 */
export function determineDefaultTrumper(state: GameState): string {
  const trumpingTeam = determineTrumpingTeam(state)

  if (trumpingTeam !== null) {
    // Find a player from the trumping team
    const trumpingPlayer = state.players.find(p => p.team === trumpingTeam)
    return trumpingPlayer?.id ?? state.players[0].id
  }

  // Fallback: RHO (right-hand opponent) of dealer
  const dealerIndex = state.players.findIndex(p => p.id === state.dealerId)
  const rhoIndex = (dealerIndex + state.playerCount - 1) % state.playerCount
  return state.players[rhoIndex].id
}

/**
 * Deal initial cards to players (4 cards each).
 */
export function dealInitialCards(state: GameState): void {
  if (state.playerCount === 4) {
    // 4-player: 4 cards each from first 16 cards
    for (let i = 0; i < 4; i++) {
      const start = i * 4
      state.players[i].hand = state.deck.slice(start, start + 4)
    }
  } else {
    // 2-player: 4 cards each from first 8 cards
    for (let i = 0; i < 2; i++) {
      const start = i * 4
      state.players[i].hand = state.deck.slice(start, start + 4)
    }
  }
}

/**
 * Reset state for a new deal/round.
 */
export function resetForNewDeal(state: GameState): void {
  state.deck = shuffleDeck(createDeck())
  state.phase = 'dealing-first'
  state.bidState = createEmptyBidState()
  state.trump = null
  state.trumpCallerId = null
  state.trumpRevealed = false
  state.thuneeCallerId = null
  state.jodhiCalls = []
  state.jodhiWindow = false
  state.lastTrickWinningTeam = null
  state.currentTrick = createEmptyTrick()
  state.tricksPlayed = 0
  state.challengeResult = null
  state.lastBallAward = null

  // Reset hands
  for (const player of state.players) {
    player.hand = []
  }
}

/**
 * Prepare state for the bidding phase.
 */
export function setupBiddingPhase(state: GameState): void {
  resetForNewDeal(state)
  dealInitialCards(state)
  state.bidState.defaultTrumperId = determineDefaultTrumper(state)
  state.phase = 'bidding'
  state.currentPlayerId = null // Anyone can call
}
