import { describe, test, expect, beforeEach } from 'bun:test'
import { handleJoin, canStart, addAIPlayer } from './lobby'
import { createInitialState } from '../../src/game/state'
import type { GameState } from '../../src/game/types'

describe('handleJoin', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
  })

  test('first player joins and becomes dealer', () => {
    const result = handleJoin(state, 'p1', 'Alice', 4)
    
    expect(result.type).toBe('joined')
    expect(state.players.length).toBe(1)
    expect(state.players[0].name).toBe('Alice')
    expect(state.players[0].team).toBe(0)
    expect(state.dealerId).toBe('p1')
  })

  test('players join alternating teams', () => {
    handleJoin(state, 'p1', 'Alice')
    handleJoin(state, 'p2', 'Bob')
    handleJoin(state, 'p3', 'Charlie')
    handleJoin(state, 'p4', 'Diana')
    
    expect(state.players[0].team).toBe(0) // Alice
    expect(state.players[1].team).toBe(1) // Bob
    expect(state.players[2].team).toBe(0) // Charlie
    expect(state.players[3].team).toBe(1) // Diana
  })

  test('fifth player becomes spectator', () => {
    handleJoin(state, 'p1', 'Alice')
    handleJoin(state, 'p2', 'Bob')
    handleJoin(state, 'p3', 'Charlie')
    handleJoin(state, 'p4', 'Diana')
    
    const result = handleJoin(state, 'p5', 'Eve')
    
    expect(result.type).toBe('spectator')
    expect(state.players.length).toBe(4)
    expect(state.spectators.length).toBe(1)
    expect(state.spectators[0].name).toBe('Eve')
    expect(state.spectators[0].isSpectator).toBe(true)
  })

  test('reconnection by existing player ID', () => {
    handleJoin(state, 'p1', 'Alice')
    state.players[0].connected = false
    
    const result = handleJoin(state, 'new-id', 'Different Name', undefined, 'p1')
    
    expect(result.type).toBe('reconnected')
    if (result.type === 'reconnected') {
      expect(result.playerId).toBe('p1')
    }
    expect(state.players[0].connected).toBe(true)
    expect(state.players.length).toBe(1) // No new player added
  })

  test('reconnection by name', () => {
    handleJoin(state, 'p1', 'Alice')
    state.players[0].connected = false
    
    const result = handleJoin(state, 'new-id', 'Alice')
    
    expect(result.type).toBe('reconnected')
    expect(state.players[0].connected).toBe(true)
  })

  test('first player sets game player count', () => {
    state = createInitialState('test-game', 4) // Default to 4
    
    handleJoin(state, 'p1', 'Alice', 2) // Request 2-player game
    
    expect(state.playerCount).toBe(2)
  })

  test('2-player game fills with 2 players', () => {
    state = createInitialState('test-game', 2)
    
    handleJoin(state, 'p1', 'Alice')
    handleJoin(state, 'p2', 'Bob')
    const result = handleJoin(state, 'p3', 'Charlie')
    
    expect(state.players.length).toBe(2)
    expect(result.type).toBe('spectator')
  })
})

describe('canStart', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
  })

  test('cannot start with no players', () => {
    expect(canStart(state)).toBe(false)
  })

  test('cannot start with partial players', () => {
    handleJoin(state, 'p1', 'Alice')
    handleJoin(state, 'p2', 'Bob')
    
    expect(canStart(state)).toBe(false)
  })

  test('can start with full player count in waiting phase', () => {
    handleJoin(state, 'p1', 'Alice')
    handleJoin(state, 'p2', 'Bob')
    handleJoin(state, 'p3', 'Charlie')
    handleJoin(state, 'p4', 'Diana')
    
    expect(canStart(state)).toBe(true)
  })

  test('can start in round-end phase', () => {
    handleJoin(state, 'p1', 'Alice')
    handleJoin(state, 'p2', 'Bob')
    handleJoin(state, 'p3', 'Charlie')
    handleJoin(state, 'p4', 'Diana')
    state.phase = 'round-end'
    
    expect(canStart(state)).toBe(true)
  })

  test('cannot start in playing phase', () => {
    handleJoin(state, 'p1', 'Alice')
    handleJoin(state, 'p2', 'Bob')
    handleJoin(state, 'p3', 'Charlie')
    handleJoin(state, 'p4', 'Diana')
    state.phase = 'playing'
    
    expect(canStart(state)).toBe(false)
  })
})

describe('addAIPlayer', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
  })

  test('adds AI player with isAI flag', () => {
    const player = addAIPlayer(state)
    
    expect(player).not.toBeNull()
    expect(player!.isAI).toBe(true)
    expect(player!.connected).toBe(true)
    expect(state.players.length).toBe(1)
  })

  test('AI player gets unique name', () => {
    addAIPlayer(state)
    addAIPlayer(state)
    
    expect(state.players[0].name).not.toBe(state.players[1].name)
  })

  test('AI player ID starts with ai-', () => {
    const player = addAIPlayer(state)
    
    expect(player!.id.startsWith('ai-')).toBe(true)
  })

  test('assigns team correctly', () => {
    addAIPlayer(state)
    addAIPlayer(state)
    addAIPlayer(state)
    addAIPlayer(state)
    
    expect(state.players[0].team).toBe(0)
    expect(state.players[1].team).toBe(1)
    expect(state.players[2].team).toBe(0)
    expect(state.players[3].team).toBe(1)
  })

  test('returns null when game is full', () => {
    addAIPlayer(state)
    addAIPlayer(state)
    addAIPlayer(state)
    addAIPlayer(state)
    
    const result = addAIPlayer(state)
    
    expect(result).toBeNull()
    expect(state.players.length).toBe(4)
  })

  test('returns null when not in waiting phase', () => {
    state.phase = 'playing'
    
    const result = addAIPlayer(state)
    
    expect(result).toBeNull()
  })

  test('first AI becomes dealer', () => {
    addAIPlayer(state)
    
    expect(state.dealerId).toBe(state.players[0].id)
  })

  test('allows mixing AI and human players', () => {
    handleJoin(state, 'p1', 'Human')
    addAIPlayer(state)
    
    expect(state.players.length).toBe(2)
    expect(state.players[0].isAI).toBeUndefined()
    expect(state.players[1].isAI).toBe(true)
  })
})
