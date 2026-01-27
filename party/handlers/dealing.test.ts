import { describe, test, expect, beforeEach } from 'bun:test'
import {
  determineTrumpingTeam,
  determineDefaultTrumper,
  dealInitialCards,
  resetForNewDeal,
  setupBiddingPhase
} from './dealing'
import { createInitialState } from '../../src/game/state'
import type { GameState, Card } from '../../src/game/types'

describe('determineTrumpingTeam', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
  })

  test('returns team 0 when ahead', () => {
    state.teams[0].balls = 5
    state.teams[1].balls = 3

    expect(determineTrumpingTeam(state)).toBe(0)
  })

  test('returns team 1 when ahead', () => {
    state.teams[0].balls = 2
    state.teams[1].balls = 7

    expect(determineTrumpingTeam(state)).toBe(1)
  })

  test('returns last round winner when tied', () => {
    state.teams[0].balls = 4
    state.teams[1].balls = 4
    state.eventLog.push({
      type: 'round-end',
      data: { winningTeam: 1, ballsAwarded: 1, reason: 'normal' },
      roundNumber: 1,
      timestamp: Date.now()
    })

    expect(determineTrumpingTeam(state)).toBe(1)
  })

  test('returns null when tied with no history', () => {
    state.teams[0].balls = 0
    state.teams[1].balls = 0

    expect(determineTrumpingTeam(state)).toBeNull()
  })
})

describe('determineDefaultTrumper', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.dealerId = 'p1'
  })

  test('returns player from leading team', () => {
    state.teams[0].balls = 5
    state.teams[1].balls = 2

    const result = determineDefaultTrumper(state)
    const player = state.players.find(p => p.id === result)

    expect(player?.team).toBe(0)
  })

  test('returns RHO of dealer when tied and no history', () => {
    state.teams[0].balls = 0
    state.teams[1].balls = 0
    state.dealerId = 'p1' // Dealer is index 0

    // RHO is player at index 3 (p4)
    expect(determineDefaultTrumper(state)).toBe('p4')
  })
})

describe('dealInitialCards', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    // Create a mock deck with identifiable cards
    state.deck = Array(24).fill(null).map((_, i) => ({
      suit: 'hearts' as const,
      rank: String(i) as any
    }))
  })

  test('deals 4 cards to each player in 4-player mode', () => {
    dealInitialCards(state)

    expect(state.players[0].hand.length).toBe(4)
    expect(state.players[1].hand.length).toBe(4)
    expect(state.players[2].hand.length).toBe(4)
    expect(state.players[3].hand.length).toBe(4)
  })

  test('deals from correct positions in 4-player mode', () => {
    dealInitialCards(state)

    // Player 0 gets cards 0-3
    expect(state.players[0].hand[0].rank).toBe('0')
    expect(state.players[0].hand[3].rank).toBe('3')

    // Player 1 gets cards 4-7
    expect(state.players[1].hand[0].rank).toBe('4')
  })

  test('deals 4 cards to each player in 2-player mode', () => {
    state.playerCount = 2
    state.players = state.players.slice(0, 2)

    dealInitialCards(state)

    expect(state.players[0].hand.length).toBe(4)
    expect(state.players[1].hand.length).toBe(4)
  })
})

describe('resetForNewDeal', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [{ suit: 'hearts', rank: 'J' }], team: 0, connected: true, isSpectator: false },
    ]
    state.trump = 'spades'
    state.thuneeCallerId = 'p1'
    state.tricksPlayed = 5
  })

  test('creates new shuffled deck', () => {
    resetForNewDeal(state)

    expect(state.deck.length).toBe(24)
  })

  test('clears trump state', () => {
    resetForNewDeal(state)

    expect(state.trump).toBeNull()
    expect(state.trumpCallerId).toBeNull()
    expect(state.trumpRevealed).toBe(false)
  })

  test('clears thunee and jodhi state', () => {
    state.jodhiCalls = [{ playerId: 'p1', suit: 'hearts', points: 20, hasJack: false }]

    resetForNewDeal(state)

    expect(state.thuneeCallerId).toBeNull()
    expect(state.jodhiCalls.length).toBe(0)
  })

  test('resets trick counter', () => {
    resetForNewDeal(state)

    expect(state.tricksPlayed).toBe(0)
  })

  test('clears player hands', () => {
    resetForNewDeal(state)

    expect(state.players[0].hand.length).toBe(0)
  })
})

describe('setupBiddingPhase', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.dealerId = 'p1'
  })

  test('sets phase to bidding', () => {
    setupBiddingPhase(state)

    expect(state.phase).toBe('bidding')
  })

  test('deals initial cards', () => {
    setupBiddingPhase(state)

    expect(state.players[0].hand.length).toBe(4)
  })

  test('sets default trumper', () => {
    setupBiddingPhase(state)

    expect(state.bidState.defaultTrumperId).toBeDefined()
  })

  test('clears current player (anyone can bid)', () => {
    setupBiddingPhase(state)

    expect(state.currentPlayerId).toBeNull()
  })
})
