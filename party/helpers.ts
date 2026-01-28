/**
 * Shared helper functions for party handlers.
 */

import type { GameState, GameEvent, Trick, Card } from '../src/game/types'

/**
 * Extract trick events from the event log, optionally filtered by round.
 */
export function getTrickEvents(
  eventLog: GameEvent[], 
  roundNumber?: number
): (Trick & { winnerId: string })[] {
  return eventLog
    .filter((e): e is Extract<GameEvent, { type: 'trick' }> => 
      e.type === 'trick' && (roundNumber === undefined || e.roundNumber === roundNumber)
    )
    .map(e => e.data)
}

/**
 * Timer durations (in milliseconds)
 */
export const CALL_TIMER_MS = 10000 // 10 seconds for bidding
export const TRICK_DISPLAY_MS = 2000 // 2 seconds to show completed trick

/** Placeholder card used to hide opponent hands */
const HIDDEN_CARD: Card = { suit: 'spades', rank: 'Q' }

/**
 * Filter game state for a specific player.
 * Hides other players' hands to prevent cheating via WebSocket inspection.
 */
export function filterStateForPlayer(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map(p => {
      // Only show your own hand
      if (p.id === playerId) {
        return p
      }
      // Hide all other hands - only show card count via placeholder cards
      return {
        ...p,
        hand: Array(p.hand.length).fill(HIDDEN_CARD)
      }
    }),
    // Hide the deck (used in 2-player mode)
    deck: [],
  }
}
