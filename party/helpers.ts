/**
 * Shared helper functions for party handlers.
 */

import type { GameEvent, Trick } from '../src/game/types'

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
