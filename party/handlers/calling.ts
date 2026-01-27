/**
 * Calling phase handlers - setting trump or calling Thunee.
 */

import type { GameState, Suit } from '../../src/game/types'

/**
 * Handle setting the trump suit.
 * Returns true if successful, false if invalid.
 */
export function handleSetTrump(
  state: GameState,
  playerId: string,
  suit: Suit,
  lastCard?: boolean
): boolean {
  if (state.phase !== 'calling') return false
  if (state.trumpCallerId !== playerId) return false

  state.trump = suit
  state.isLastCardTrump = lastCard ?? false

  // Player after trumper (in play order) leads first trick
  const trumperIndex = state.players.findIndex(p => p.id === playerId)
  const leaderIndex = (trumperIndex + 1) % state.playerCount
  state.currentPlayerId = state.players[leaderIndex].id
  state.phase = 'playing'

  return true
}

/**
 * Handle calling Thunee (no trump, must win all tricks).
 * Returns true if successful, false if invalid.
 */
export function handleCallThunee(
  state: GameState,
  playerId: string
): boolean {
  if (state.phase !== 'calling') return false
  if (state.trumpCallerId !== playerId) return false

  state.thuneeCallerId = playerId
  state.trump = null // No trump in Thunee

  // Player after thunee caller (in play order) leads first trick
  const callerIndex = state.players.findIndex(p => p.id === playerId)
  const leaderIndex = (callerIndex + 1) % state.playerCount
  state.currentPlayerId = state.players[leaderIndex].id
  state.phase = 'playing'

  return true
}
