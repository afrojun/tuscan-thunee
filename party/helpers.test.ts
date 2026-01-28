import { describe, test, expect, beforeEach } from 'bun:test'
import { filterStateForPlayer, getTrickEvents } from './helpers'
import { createInitialState } from '../src/game/state'
import type { GameState, Card } from '../src/game/types'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('filterStateForPlayer', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [card('J', 'hearts'), card('9', 'spades')], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [card('K', 'hearts'), card('Q', 'diamonds')], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [card('A', 'clubs')], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.deck = [card('10', 'hearts'), card('K', 'clubs')]
  })

  test('returns own hand unchanged', () => {
    const filtered = filterStateForPlayer(state, 'p1')
    
    expect(filtered.players[0].hand).toEqual([card('J', 'hearts'), card('9', 'spades')])
  })

  test('hides other players hands with placeholders', () => {
    const filtered = filterStateForPlayer(state, 'p1')
    
    // p2 has 2 cards, should see 2 placeholders
    expect(filtered.players[1].hand.length).toBe(2)
    expect(filtered.players[1].hand[0]).toEqual({ suit: 'spades', rank: 'Q' })
    expect(filtered.players[1].hand[1]).toEqual({ suit: 'spades', rank: 'Q' })
    
    // p3 has 1 card
    expect(filtered.players[2].hand.length).toBe(1)
    expect(filtered.players[2].hand[0]).toEqual({ suit: 'spades', rank: 'Q' })
  })

  test('preserves card count for hidden hands', () => {
    const filtered = filterStateForPlayer(state, 'p1')
    
    expect(filtered.players[0].hand.length).toBe(2) // Own hand
    expect(filtered.players[1].hand.length).toBe(2) // Bob's hand
    expect(filtered.players[2].hand.length).toBe(1) // Charlie's hand
    expect(filtered.players[3].hand.length).toBe(0) // Diana's empty hand
  })

  test('hides the deck', () => {
    const filtered = filterStateForPlayer(state, 'p1')
    
    expect(filtered.deck).toEqual([])
    expect(state.deck.length).toBe(2) // Original unchanged
  })

  test('does not mutate original state', () => {
    const originalHand = [...state.players[1].hand]
    const originalDeck = [...state.deck]
    
    filterStateForPlayer(state, 'p1')
    
    expect(state.players[1].hand).toEqual(originalHand)
    expect(state.deck).toEqual(originalDeck)
  })

  test('preserves other player properties', () => {
    const filtered = filterStateForPlayer(state, 'p1')
    
    expect(filtered.players[1].id).toBe('p2')
    expect(filtered.players[1].name).toBe('Bob')
    expect(filtered.players[1].team).toBe(1)
    expect(filtered.players[1].connected).toBe(true)
  })

  test('preserves non-player state', () => {
    state.phase = 'playing'
    state.trump = 'hearts'
    state.teams[0].balls = 5
    
    const filtered = filterStateForPlayer(state, 'p1')
    
    expect(filtered.phase).toBe('playing')
    expect(filtered.trump).toBe('hearts')
    expect(filtered.teams[0].balls).toBe(5)
  })
})

describe('getTrickEvents', () => {
  test('extracts trick events from log', () => {
    const eventLog = [
      { type: 'trick' as const, data: { cards: [], leadSuit: null, winnerId: 'p1' }, roundNumber: 1, timestamp: 1 },
      { type: 'jodhi-call' as const, data: {}, roundNumber: 1, timestamp: 2 },
      { type: 'trick' as const, data: { cards: [], leadSuit: 'hearts', winnerId: 'p2' }, roundNumber: 1, timestamp: 3 },
    ]

    const tricks = getTrickEvents(eventLog as any)
    
    expect(tricks.length).toBe(2)
    expect(tricks[0].winnerId).toBe('p1')
    expect(tricks[1].winnerId).toBe('p2')
  })

  test('filters by round number', () => {
    const eventLog = [
      { type: 'trick' as const, data: { cards: [], leadSuit: null, winnerId: 'p1' }, roundNumber: 1, timestamp: 1 },
      { type: 'trick' as const, data: { cards: [], leadSuit: null, winnerId: 'p2' }, roundNumber: 2, timestamp: 2 },
    ]

    const round1Tricks = getTrickEvents(eventLog as any, 1)
    const round2Tricks = getTrickEvents(eventLog as any, 2)
    
    expect(round1Tricks.length).toBe(1)
    expect(round1Tricks[0].winnerId).toBe('p1')
    expect(round2Tricks.length).toBe(1)
    expect(round2Tricks[0].winnerId).toBe('p2')
  })

  test('returns empty array when no tricks', () => {
    const eventLog = [
      { type: 'jodhi-call' as const, data: {}, roundNumber: 1, timestamp: 1 },
    ]

    const tricks = getTrickEvents(eventLog as any)
    
    expect(tricks).toEqual([])
  })
})
