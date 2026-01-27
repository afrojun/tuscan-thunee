import { describe, test, expect, beforeEach } from 'bun:test'
import { handleSetTrump, handleCallThunee } from './calling'
import { createInitialState } from '../../src/game/state'
import type { GameState } from '../../src/game/types'

describe('handleSetTrump', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    // Set up players
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'calling'
    state.trumpCallerId = 'p1'
  })

  test('sets trump and transitions to playing phase', () => {
    const result = handleSetTrump(state, 'p1', 'hearts')
    
    expect(result).toBe(true)
    expect(state.trump).toBe('hearts')
    expect(state.phase).toBe('playing')
  })

  test('sets player after trumper as current player', () => {
    handleSetTrump(state, 'p1', 'spades')
    
    expect(state.currentPlayerId).toBe('p2') // p2 is after p1
  })

  test('wraps around for last player', () => {
    state.trumpCallerId = 'p4'
    handleSetTrump(state, 'p4', 'clubs')
    
    expect(state.currentPlayerId).toBe('p1') // Wraps to p1
  })

  test('sets isLastCardTrump when specified', () => {
    handleSetTrump(state, 'p1', 'diamonds', true)
    
    expect(state.isLastCardTrump).toBe(true)
  })

  test('fails if not in calling phase', () => {
    state.phase = 'playing'
    
    const result = handleSetTrump(state, 'p1', 'hearts')
    
    expect(result).toBe(false)
    expect(state.trump).toBeNull()
  })

  test('fails if not the trump caller', () => {
    const result = handleSetTrump(state, 'p2', 'hearts')
    
    expect(result).toBe(false)
    expect(state.trump).toBeNull()
  })
})

describe('handleCallThunee', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'calling'
    state.trumpCallerId = 'p1'
  })

  test('sets thunee caller and clears trump', () => {
    const result = handleCallThunee(state, 'p1')
    
    expect(result).toBe(true)
    expect(state.thuneeCallerId).toBe('p1')
    expect(state.trump).toBeNull()
    expect(state.phase).toBe('playing')
  })

  test('sets player after caller as current player', () => {
    handleCallThunee(state, 'p1')
    
    expect(state.currentPlayerId).toBe('p2')
  })

  test('fails if not in calling phase', () => {
    state.phase = 'bidding'
    
    const result = handleCallThunee(state, 'p1')
    
    expect(result).toBe(false)
    expect(state.thuneeCallerId).toBeNull()
  })

  test('fails if not the trump caller', () => {
    const result = handleCallThunee(state, 'p3')
    
    expect(result).toBe(false)
    expect(state.thuneeCallerId).toBeNull()
  })
})
