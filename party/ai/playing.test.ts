import { describe, test, expect } from 'bun:test'
import { getValidCards, decidePlay } from './playing'
import { createInitialState, createEmptyTrick } from '../../src/game/state'
import type { Card, GameState, Trick } from '../../src/game/types'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('getValidCards', () => {
  test('returns all cards when leading', () => {
    const hand: Card[] = [
      card('J', 'hearts'),
      card('9', 'spades'),
      card('A', 'diamonds'),
    ]
    const trick: Trick = { cards: [], leadSuit: null, winnerId: null }
    
    const valid = getValidCards(hand, trick)
    
    expect(valid.length).toBe(3)
  })

  test('must follow suit if possible', () => {
    const hand: Card[] = [
      card('J', 'hearts'),
      card('9', 'spades'),
      card('A', 'hearts'),
    ]
    const trick: Trick = {
      cards: [{ playerId: 'other', card: card('K', 'hearts') }],
      leadSuit: 'hearts',
      winnerId: null
    }
    
    const valid = getValidCards(hand, trick)
    
    expect(valid.length).toBe(2) // Only hearts
    expect(valid.every(c => c.suit === 'hearts')).toBe(true)
  })

  test('can play any card when void', () => {
    const hand: Card[] = [
      card('J', 'spades'),
      card('9', 'diamonds'),
      card('A', 'clubs'),
    ]
    const trick: Trick = {
      cards: [{ playerId: 'other', card: card('K', 'hearts') }],
      leadSuit: 'hearts',
      winnerId: null
    }
    
    const valid = getValidCards(hand, trick)
    
    expect(valid.length).toBe(3) // All cards valid when void
  })
})

describe('decidePlay', () => {
  let state: GameState

  test('plays only valid card', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'p1', name: 'AI', hand: [card('J', 'hearts')], team: 0, connected: true, isSpectator: false, isAI: true },
      { id: 'p2', name: 'Human', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'p1'
    state.currentTrick = createEmptyTrick()
    state.trump = 'spades'
    
    const play = decidePlay(state, 'p1')
    
    expect(play.rank).toBe('J')
    expect(play.suit).toBe('hearts')
  })

  test('follows suit when required', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'p1', name: 'AI', hand: [card('J', 'hearts'), card('9', 'spades')], team: 0, connected: true, isSpectator: false, isAI: true },
      { id: 'p2', name: 'Human', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'p1'
    state.currentTrick = {
      cards: [{ playerId: 'p2', card: card('K', 'hearts') }],
      leadSuit: 'hearts',
      winnerId: null
    }
    state.trump = 'spades'
    
    const play = decidePlay(state, 'p1')
    
    // Must follow hearts
    expect(play.suit).toBe('hearts')
  })

  test('plays low when partner is winning', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'p1', name: 'AI', hand: [card('J', 'hearts'), card('Q', 'hearts')], team: 0, connected: true, isSpectator: false, isAI: true },
      { id: 'p2', name: 'Opp1', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Partner', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Opp2', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'p1'
    state.currentTrick = {
      cards: [
        { playerId: 'p2', card: card('K', 'hearts') },
        { playerId: 'p3', card: card('A', 'hearts') }, // Partner winning
      ],
      leadSuit: 'hearts',
      winnerId: null
    }
    state.trump = 'spades'
    
    const play = decidePlay(state, 'p1')
    
    // Should play low (Q) since partner is winning
    expect(play.rank).toBe('Q')
  })

  test('trumps when void and opponent winning', () => {
    state = createInitialState('test', 4)
    state.players = [
      { id: 'p1', name: 'AI', hand: [card('9', 'spades'), card('Q', 'diamonds')], team: 0, connected: true, isSpectator: false, isAI: true },
      { id: 'p2', name: 'Opp1', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Partner', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Opp2', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.currentPlayerId = 'p1'
    state.currentTrick = {
      cards: [
        { playerId: 'p2', card: card('J', 'hearts') }, // Opponent winning with J
        { playerId: 'p3', card: card('K', 'hearts') },
      ],
      leadSuit: 'hearts',
      winnerId: null
    }
    state.trump = 'spades'
    state.tricksPlayed = 4 // Late game, worth winning
    
    const play = decidePlay(state, 'p1')
    
    // Should trump to beat the J
    expect(play.suit).toBe('spades')
  })
})
