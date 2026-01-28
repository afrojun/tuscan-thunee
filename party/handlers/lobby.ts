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

// AI player names for variety
const AI_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave']

/**
 * Add an AI player to the game.
 * Returns the created player, or null if game is full.
 */
export function addAIPlayer(state: GameState, requestedTeam?: 0 | 1): Player | null {
  // Can only add AI during waiting phase
  if (state.phase !== 'waiting') return null
  
  // Check if game is full
  if (state.players.length >= state.playerCount) return null
  
  // Determine team
  const team = requestedTeam ?? getTeamForPlayer(state.players.length)
  
  // Generate unique AI ID
  const aiId = `ai-${crypto.randomUUID().slice(0, 8)}`
  
  // Pick a name that hasn't been used
  const usedNames = new Set(state.players.map(p => p.name))
  const name = AI_NAMES.find(n => !usedNames.has(n)) ?? `Bot ${state.players.length + 1}`
  
  // Create the AI player
  const player = createPlayer(aiId, name, team)
  player.isAI = true
  player.connected = true  // AI is always "connected"
  state.players.push(player)
  
  // Set dealer if this is the first player
  if (state.players.length === 1) {
    state.dealerId = aiId
  }
  
  return player
}
