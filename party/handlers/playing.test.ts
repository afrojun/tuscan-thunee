import { describe, test, expect, beforeEach } from 'bun:test'
import { 
  handleCallJodhi, 
  handlePlayCard, 
  completeTrick,
  handleTrickDisplayComplete 
} from './playing'
import { createInitialState, createEmptyTrick } from '../../src/game/state'
import type { GameState, Card } from '../../src/game/types'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('handleCallJodhi', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.jodhiWindow = true
    state.lastTrickWinningTeam = 0
    state.trump = 'spades'
  })

  test('allows jodhi call from winning team', () => {
    const result = handleCallJodhi(state, 'p1', 'hearts', false)
    
    expect(result).toBe(true)
    expect(state.jodhiCalls.length).toBe(1)
    expect(state.jodhiCalls[0].suit).toBe('hearts')
    expect(state.jodhiCalls[0].points).toBe(20) // non-trump, no jack
  })

  test('calculates trump jodhi points correctly', () => {
    handleCallJodhi(state, 'p1', 'spades', false)
    expect(state.jodhiCalls[0].points).toBe(40) // trump, no jack

    state.jodhiCalls = []
    handleCallJodhi(state, 'p1', 'spades', true)
    expect(state.jodhiCalls[0].points).toBe(50) // trump + jack
  })

  test('calculates non-trump jodhi with jack', () => {
    handleCallJodhi(state, 'p1', 'hearts', true)
    expect(state.jodhiCalls[0].points).toBe(30) // non-trump + jack
  })

  test('rejects call from non-winning team', () => {
    const result = handleCallJodhi(state, 'p2', 'hearts', false) // p2 is team 1
    
    expect(result).toBe(false)
    expect(state.jodhiCalls.length).toBe(0)
  })

  test('rejects call when jodhi window closed', () => {
    state.jodhiWindow = false
    
    const result = handleCallJodhi(state, 'p1', 'hearts', false)
    
    expect(result).toBe(false)
  })

  test('rejects duplicate call for same suit', () => {
    handleCallJodhi(state, 'p1', 'hearts', false)
    const result = handleCallJodhi(state, 'p1', 'hearts', true) // Try again with jack
    
    expect(result).toBe(false)
    expect(state.jodhiCalls.length).toBe(1)
  })

  test('allows multiple calls for different suits', () => {
    handleCallJodhi(state, 'p1', 'hearts', false)
    handleCallJodhi(state, 'p1', 'diamonds', false)
    
    expect(state.jodhiCalls.length).toBe(2)
  })

  test('logs event to eventLog', () => {
    handleCallJodhi(state, 'p1', 'hearts', true)
    
    const event = state.eventLog[0]
    expect(event.type).toBe('jodhi-call')
  })
})

describe('handlePlayCard', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [card('J', 'hearts'), card('9', 'spades')], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [card('K', 'hearts')], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [card('Q', 'hearts')], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [card('A', 'hearts')], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'p1'
    state.currentTrick = createEmptyTrick()
    state.trump = 'spades'
  })

  test('plays card and removes from hand', () => {
    const result = handlePlayCard(state, 'p1', card('J', 'hearts'))
    
    expect(result.success).toBe(true)
    expect(state.players[0].hand.length).toBe(1) // Had 2, now 1
    expect(state.currentTrick.cards.length).toBe(1)
  })

  test('sets lead suit on first card', () => {
    handlePlayCard(state, 'p1', card('J', 'hearts'))
    
    expect(state.currentTrick.leadSuit).toBe('hearts')
  })

  test('reveals trump on first trick', () => {
    state.tricksPlayed = 0
    state.trumpRevealed = false
    
    handlePlayCard(state, 'p1', card('J', 'hearts'))
    
    expect(state.trumpRevealed).toBe(true)
  })

  test('advances to next player when trick incomplete', () => {
    const result = handlePlayCard(state, 'p1', card('J', 'hearts'))
    
    expect(result.success).toBe(true)
    if (result.success && !result.trickComplete) {
      expect(result.nextPlayerId).toBe('p2')
    }
    expect(state.currentPlayerId).toBe('p2')
  })

  test('completes trick when all players have played', () => {
    // Simulate 3 cards already played
    state.currentTrick.cards = [
      { playerId: 'p2', card: card('K', 'hearts') },
      { playerId: 'p3', card: card('Q', 'hearts') },
      { playerId: 'p4', card: card('A', 'hearts') },
    ]
    state.currentTrick.leadSuit = 'hearts'
    
    const result = handlePlayCard(state, 'p1', card('J', 'hearts'))
    
    expect(result.success).toBe(true)
    if (result.success && result.trickComplete) {
      expect(result.trickResult.winnerId).toBe('p1') // J is highest
    }
  })

  test('rejects play from wrong player', () => {
    const result = handlePlayCard(state, 'p2', card('K', 'hearts'))
    
    expect(result.success).toBe(false)
  })

  test('rejects card not in hand', () => {
    const result = handlePlayCard(state, 'p1', card('A', 'clubs'))
    
    expect(result.success).toBe(false)
  })

  test('closes jodhi window when card is played', () => {
    state.jodhiWindow = true
    
    handlePlayCard(state, 'p1', card('J', 'hearts'))
    
    expect(state.jodhiWindow).toBe(false)
  })
})

describe('completeTrick', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.trump = 'spades'
    state.currentTrick = {
      cards: [
        { playerId: 'p1', card: card('J', 'hearts') }, // 30 points
        { playerId: 'p2', card: card('9', 'hearts') }, // 20 points, but J beats 9
        { playerId: 'p3', card: card('Q', 'hearts') }, // 2 points
        { playerId: 'p4', card: card('K', 'hearts') }, // 3 points
      ],
      leadSuit: 'hearts',
      winnerId: null
    }
  })

  test('determines correct winner', () => {
    const result = completeTrick(state)
    
    expect(result.winnerId).toBe('p1') // J is highest
  })

  test('awards points to winning team', () => {
    completeTrick(state)
    
    expect(state.teams[0].cardPoints).toBe(55) // 30+20+2+3
  })

  test('opens jodhi window for winning team', () => {
    completeTrick(state)
    
    expect(state.jodhiWindow).toBe(true)
    expect(state.lastTrickWinningTeam).toBe(0)
  })

  test('transitions to trick-complete phase', () => {
    completeTrick(state)
    
    expect(state.phase).toBe('trick-complete')
  })

  test('increments tricks played', () => {
    state.tricksPlayed = 3
    completeTrick(state)
    
    expect(state.tricksPlayed).toBe(4)
  })

  test('logs trick to event log', () => {
    completeTrick(state)
    
    const event = state.eventLog[state.eventLog.length - 1]
    expect(event.type).toBe('trick')
  })
})

describe('handleTrickDisplayComplete', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'trick-complete'
    state.currentTrick = {
      cards: [],
      leadSuit: 'hearts',
      winnerId: 'p1'
    }
  })

  test('returns to playing phase when not round over', () => {
    state.tricksPlayed = 3
    
    const result = handleTrickDisplayComplete(state)
    
    expect(result.roundOver).toBe(false)
    expect(state.phase).toBe('playing')
  })

  test('sets winner as next leader', () => {
    state.tricksPlayed = 3
    
    const result = handleTrickDisplayComplete(state)
    
    if (!result.roundOver) {
      expect(result.nextLeaderId).toBe('p1')
    }
    expect(state.currentPlayerId).toBe('p1')
  })

  test('creates empty trick for next round', () => {
    state.tricksPlayed = 3
    
    handleTrickDisplayComplete(state)
    
    expect(state.currentTrick.cards.length).toBe(0)
    expect(state.currentTrick.leadSuit).toBeNull()
  })

  test('signals round over after 6 tricks', () => {
    state.tricksPlayed = 6
    
    const result = handleTrickDisplayComplete(state)
    
    expect(result.roundOver).toBe(true)
  })
})
