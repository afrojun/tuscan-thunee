/**
 * Lobby phase handlers - joining games and starting rounds.
 */

import type { GameState, Player } from '../../src/game/types'
import { createPlayer } from '../../src/game/state'
import { getTeamForPlayer } from '../../src/game/utils'

/**
 * Result of a join operation.
 */
export type JoinResult = 
  | { type: 'reconnected'; playerId: string }
  | { type: 'joined'; player: Player }
  | { type: 'spectator'; player: Player }
  | { type: 'full' }

/**
 * Handle a player joining the game.
 * Returns the result without modifying connectionPlayerMap (caller handles that).
 */
export function handleJoin(
  state: GameState,
  playerId: string,
  name: string,
  playerCount?: 2 | 4,
  existingPlayerId?: string
): JoinResult {
  // Check if this is a reconnection by playerId first, then by name
  let existingPlayer = existingPlayerId
    ? state.players.find(p => p.id === existingPlayerId)
    : null

  // Fallback to name-based reconnection
  if (!existingPlayer) {
    existingPlayer = state.players.find(p => p.name === name)
  }

  if (existingPlayer) {
    existingPlayer.connected = true
    return { type: 'reconnected', playerId: existingPlayer.id }
  }

  // Set player count if this is the first player
  if (state.players.length === 0 && playerCount) {
    state.playerCount = playerCount
  }

  // Check if game is full
  if (state.players.length >= state.playerCount) {
    // Add as spectator
    const spectator = createPlayer(playerId, name, 0)
    spectator.isSpectator = true
    state.spectators.push(spectator)
    return { type: 'spectator', player: spectator }
  }

  // Add as regular player
  const team = getTeamForPlayer(state.players.length)
  const player = createPlayer(playerId, name, team)
  state.players.push(player)

  if (state.players.length === 1) {
    state.dealerId = playerId
  }

  return { type: 'joined', player }
}

/**
 * Check if the game can be started.
 */
export function canStart(state: GameState): boolean {
  if (state.players.length !== state.playerCount) return false
  if (state.phase !== 'waiting' && state.phase !== 'round-end') return false
  return true
}
