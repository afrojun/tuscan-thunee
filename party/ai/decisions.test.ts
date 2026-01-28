import { describe, test, expect } from 'bun:test'
import { computeAIMove, getNextAIPlayer } from './decisions'
import { createInitialState, createEmptyTrick } from '../../src/game/state'
import type { Card, GameState } from '../../src/game/types'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('computeAIMove', () => {
  let state: GameState

  test('returns null for non-AI player', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'p1', name: 'Human', hand: [], team: 0, connected: true, isSpectator: false },
    ]
    
    const move = computeAIMove(state, 'p1')
    
    expect(move).toBeNull()
  })

  test('returns bid decision in bidding phase', () => {
    state = createInitialState('test', 4)
    state.players = [
      { 
        id: 'ai1', 
        name: 'Bot', 
        hand: [
          card('J', 'hearts'),
          card('J', 'spades'),
          card('9', 'hearts'),
          card('A', 'diamonds'),
        ], 
        team: 0, 
        connected: true, 
        isSpectator: false,
        isAI: true
      },
    ]
    state.phase = 'bidding'
    state.bidState.currentBid = 0
    state.bidState.passed = new Set()
    
    const move = computeAIMove(state, 'ai1')
    
    // Should bid or pass
    expect(move?.type === 'bid' || move?.type === 'pass').toBe(true)
  })

  test('returns set-trump in calling phase when trumper', () => {
    state = createInitialState('test', 4)
    state.players = [
      { 
        id: 'ai1', 
        name: 'Bot', 
        hand: [
          card('J', 'hearts'),
          card('9', 'hearts'),
          card('K', 'hearts'),
          card('Q', 'spades'),
        ], 
        team: 0, 
        connected: true, 
        isSpectator: false,
        isAI: true
      },
    ]
    state.phase = 'calling'
    state.trumpCallerId = 'ai1'
    state.trump = null
    
    const move = computeAIMove(state, 'ai1')
    
    expect(move?.type).toBe('set-trump')
    if (move?.type === 'set-trump') {
      expect(move.suit).toBe('hearts') // Strongest suit
    }
  })

  test('returns play-card in playing phase when current player', () => {
    state = createInitialState('test', 4)
    state.players = [
      { 
        id: 'ai1', 
        name: 'Bot', 
        hand: [card('J', 'hearts')], 
        team: 0, 
        connected: true, 
        isSpectator: false,
        isAI: true
      },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'ai1'
    state.currentTrick = createEmptyTrick()
    state.trump = 'spades'
    
    const move = computeAIMove(state, 'ai1')
    
    expect(move?.type).toBe('play-card')
    if (move?.type === 'play-card') {
      expect(move.card.rank).toBe('J')
      expect(move.card.suit).toBe('hearts')
    }
  })

  test('returns null when not current player in playing phase', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'ai1', name: 'Bot', hand: [card('J', 'hearts')], team: 0, connected: true, isSpectator: false, isAI: true },
      { id: 'p2', name: 'Human', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'p2' // Not the AI's turn
    
    const move = computeAIMove(state, 'ai1')
    
    expect(move).toBeNull()
  })
})

describe('getNextAIPlayer', () => {
  let state: GameState

  test('returns null when no AI players', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'p1', name: 'Human', hand: [], team: 0, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'p1'
    
    const ai = getNextAIPlayer(state)
    
    expect(ai).toBeNull()
  })

  test('returns AI player when it is their turn', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'ai1', name: 'Bot', hand: [], team: 0, connected: true, isSpectator: false, isAI: true },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'ai1'
    
    const ai = getNextAIPlayer(state)
    
    expect(ai?.id).toBe('ai1')
  })

  test('returns AI trump caller in calling phase', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'ai1', name: 'Bot', hand: [], team: 0, connected: true, isSpectator: false, isAI: true },
      { id: 'p2', name: 'Human', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'calling'
    state.trumpCallerId = 'ai1'
    state.trump = null
    
    const ai = getNextAIPlayer(state)
    
    expect(ai?.id).toBe('ai1')
  })

  test('returns AI that has not passed in bidding phase', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'ai1', name: 'Bot1', hand: [], team: 0, connected: true, isSpectator: false, isAI: true },
      { id: 'ai2', name: 'Bot2', hand: [], team: 1, connected: true, isSpectator: false, isAI: true },
    ]
    state.phase = 'bidding'
    state.bidState.passed = new Set(['ai1']) // ai1 has passed
    state.bidState.bidderId = null
    
    const ai = getNextAIPlayer(state)
    
    expect(ai?.id).toBe('ai2') // ai2 hasn't passed
  })
})
