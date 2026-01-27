import { describe, test, expect } from 'bun:test'
import {
  isValidPlay,
  getTrickWinner,
  compareCards,
  getTrickPoints,
  calculateJodhi,
  canCallThunee,
  hasTrump,
  getTargetScore,
} from './rules'
import type { Card, Trick, Suit } from './types'

// Helper to create cards quickly
const card = (rank: Card['rank'], suit: Suit): Card => ({ rank, suit })

// Helper to create a trick
const trick = (
  cards: { playerId: string; card: Card }[],
  leadSuit: Suit | null = cards[0]?.card.suit ?? null
): Trick => ({
  cards,
  leadSuit,
  winnerId: null,
})

describe('compareCards', () => {
  test('J beats everything', () => {
    expect(compareCards(card('J', 'hearts'), card('9', 'hearts'))).toBeGreaterThan(0)
    expect(compareCards(card('J', 'hearts'), card('A', 'hearts'))).toBeGreaterThan(0)
    expect(compareCards(card('J', 'hearts'), card('Q', 'hearts'))).toBeGreaterThan(0)
  })

  test('9 beats A, 10, K, Q', () => {
    expect(compareCards(card('9', 'hearts'), card('A', 'hearts'))).toBeGreaterThan(0)
    expect(compareCards(card('9', 'hearts'), card('10', 'hearts'))).toBeGreaterThan(0)
    expect(compareCards(card('9', 'hearts'), card('K', 'hearts'))).toBeGreaterThan(0)
    expect(compareCards(card('9', 'hearts'), card('Q', 'hearts'))).toBeGreaterThan(0)
  })

  test('Q loses to everything', () => {
    expect(compareCards(card('Q', 'hearts'), card('J', 'hearts'))).toBeLessThan(0)
    expect(compareCards(card('Q', 'hearts'), card('9', 'hearts'))).toBeLessThan(0)
    expect(compareCards(card('Q', 'hearts'), card('A', 'hearts'))).toBeLessThan(0)
    expect(compareCards(card('Q', 'hearts'), card('10', 'hearts'))).toBeLessThan(0)
    expect(compareCards(card('Q', 'hearts'), card('K', 'hearts'))).toBeLessThan(0)
  })

  test('full rank order: J > 9 > A > 10 > K > Q', () => {
    const ranks: Card['rank'][] = ['J', '9', 'A', '10', 'K', 'Q']
    for (let i = 0; i < ranks.length - 1; i++) {
      expect(compareCards(card(ranks[i], 'spades'), card(ranks[i + 1], 'spades'))).toBeGreaterThan(0)
    }
  })

  test('same rank returns 0', () => {
    expect(compareCards(card('J', 'hearts'), card('J', 'spades'))).toBe(0)
    expect(compareCards(card('Q', 'hearts'), card('Q', 'clubs'))).toBe(0)
  })
})

describe('isValidPlay', () => {
  test('leading a trick - any card is valid', () => {
    const hand = [card('J', 'hearts'), card('9', 'spades')]
    const emptyTrick = trick([])
    
    expect(isValidPlay(card('J', 'hearts'), hand, emptyTrick, null)).toEqual({ valid: true })
    expect(isValidPlay(card('9', 'spades'), hand, emptyTrick, null)).toEqual({ valid: true })
  })

  test('must follow suit when you have it', () => {
    const hand = [card('J', 'hearts'), card('9', 'hearts'), card('A', 'spades')]
    const heartsTrick = trick([{ playerId: 'p1', card: card('Q', 'hearts') }])
    
    // Playing hearts when hearts led - valid
    expect(isValidPlay(card('J', 'hearts'), hand, heartsTrick, null)).toEqual({ valid: true })
    expect(isValidPlay(card('9', 'hearts'), hand, heartsTrick, null)).toEqual({ valid: true })
    
    // Playing spades when you have hearts - invalid
    const result = isValidPlay(card('A', 'spades'), hand, heartsTrick, null)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Must follow suit')
  })

  test('can play any card when void in lead suit', () => {
    const hand = [card('J', 'spades'), card('9', 'clubs')] // No hearts
    const heartsTrick = trick([{ playerId: 'p1', card: card('Q', 'hearts') }])
    
    expect(isValidPlay(card('J', 'spades'), hand, heartsTrick, null)).toEqual({ valid: true })
    expect(isValidPlay(card('9', 'clubs'), hand, heartsTrick, null)).toEqual({ valid: true })
  })

  test('trump parameter does not affect follow-suit rule', () => {
    const hand = [card('J', 'hearts'), card('9', 'spades')]
    const heartsTrick = trick([{ playerId: 'p1', card: card('Q', 'hearts') }])
    
    // Even with spades as trump, must follow hearts
    const result = isValidPlay(card('9', 'spades'), hand, heartsTrick, 'spades')
    expect(result.valid).toBe(false)
  })
})

describe('getTrickWinner', () => {
  test('highest card in lead suit wins (no trump)', () => {
    const t = trick([
      { playerId: 'p1', card: card('Q', 'hearts') },
      { playerId: 'p2', card: card('K', 'hearts') },
      { playerId: 'p3', card: card('9', 'hearts') },
      { playerId: 'p4', card: card('A', 'hearts') },
    ])
    
    expect(getTrickWinner(t, null)).toBe('p3') // 9 is highest in Thunee
  })

  test('J beats 9 in same suit', () => {
    const t = trick([
      { playerId: 'p1', card: card('9', 'hearts') },
      { playerId: 'p2', card: card('J', 'hearts') },
    ])
    
    expect(getTrickWinner(t, null)).toBe('p2')
  })

  test('trump beats lead suit', () => {
    const t = trick([
      { playerId: 'p1', card: card('J', 'hearts') }, // Lead with J of hearts
      { playerId: 'p2', card: card('Q', 'spades') }, // Trump with lowest spade
    ])
    
    expect(getTrickWinner(t, 'spades')).toBe('p2') // Even Q of trump beats J of lead
  })

  test('higher trump beats lower trump', () => {
    const t = trick([
      { playerId: 'p1', card: card('J', 'hearts') },
      { playerId: 'p2', card: card('Q', 'spades') },
      { playerId: 'p3', card: card('9', 'spades') },
    ])
    
    expect(getTrickWinner(t, 'spades')).toBe('p3') // 9 of trump beats Q of trump
  })

  test('off-suit non-trump never wins', () => {
    const t = trick([
      { playerId: 'p1', card: card('Q', 'hearts') }, // Lead
      { playerId: 'p2', card: card('J', 'clubs') },  // Off-suit (not trump)
      { playerId: 'p3', card: card('K', 'hearts') }, // Follows suit
    ])
    
    // J of clubs doesn't count because clubs isn't trump and isn't lead suit
    expect(getTrickWinner(t, 'spades')).toBe('p3') // K of hearts wins
  })

  test('first trump played wins if no higher trump', () => {
    const t = trick([
      { playerId: 'p1', card: card('J', 'hearts') },
      { playerId: 'p2', card: card('A', 'spades') }, // First trump
      { playerId: 'p3', card: card('K', 'hearts') },
      { playerId: 'p4', card: card('Q', 'hearts') },
    ])
    
    expect(getTrickWinner(t, 'spades')).toBe('p2')
  })

  test('throws on empty trick', () => {
    expect(() => getTrickWinner(trick([]), null)).toThrow('Cannot determine winner of empty trick')
  })
})

describe('getTrickPoints', () => {
  test('calculates sum of card values', () => {
    const t = trick([
      { playerId: 'p1', card: card('J', 'hearts') },  // 30
      { playerId: 'p2', card: card('9', 'spades') },  // 20
    ])
    
    expect(getTrickPoints(t)).toBe(50)
  })

  test('all card values are correct', () => {
    // J=30, 9=20, A=11, 10=10, K=3, Q=2
    expect(getTrickPoints(trick([{ playerId: 'p1', card: card('J', 'hearts') }]))).toBe(30)
    expect(getTrickPoints(trick([{ playerId: 'p1', card: card('9', 'hearts') }]))).toBe(20)
    expect(getTrickPoints(trick([{ playerId: 'p1', card: card('A', 'hearts') }]))).toBe(11)
    expect(getTrickPoints(trick([{ playerId: 'p1', card: card('10', 'hearts') }]))).toBe(10)
    expect(getTrickPoints(trick([{ playerId: 'p1', card: card('K', 'hearts') }]))).toBe(3)
    expect(getTrickPoints(trick([{ playerId: 'p1', card: card('Q', 'hearts') }]))).toBe(2)
  })

  test('full trick with all cards', () => {
    const t = trick([
      { playerId: 'p1', card: card('J', 'hearts') },  // 30
      { playerId: 'p2', card: card('9', 'hearts') },  // 20
      { playerId: 'p3', card: card('A', 'hearts') },  // 11
      { playerId: 'p4', card: card('10', 'hearts') }, // 10
    ])
    
    expect(getTrickPoints(t)).toBe(71)
  })
})

describe('calculateJodhi', () => {
  test('K+Q non-trump = 20 points', () => {
    const hand = [card('K', 'hearts'), card('Q', 'hearts'), card('J', 'spades')]
    const result = calculateJodhi(hand, 'spades')
    
    expect(result).toEqual({ points: 20, suit: 'hearts' })
  })

  test('K+Q trump = 40 points', () => {
    const hand = [card('K', 'spades'), card('Q', 'spades'), card('J', 'hearts')]
    const result = calculateJodhi(hand, 'spades')
    
    expect(result).toEqual({ points: 40, suit: 'spades' })
  })

  test('K+Q+J non-trump = 30 points', () => {
    const hand = [card('K', 'hearts'), card('Q', 'hearts'), card('J', 'hearts')]
    const result = calculateJodhi(hand, 'spades')
    
    expect(result).toEqual({ points: 30, suit: 'hearts' })
  })

  test('K+Q+J trump = 50 points', () => {
    const hand = [card('K', 'spades'), card('Q', 'spades'), card('J', 'spades')]
    const result = calculateJodhi(hand, 'spades')
    
    expect(result).toEqual({ points: 50, suit: 'spades' })
  })

  test('no K+Q returns null', () => {
    const hand = [card('K', 'hearts'), card('J', 'hearts'), card('A', 'spades')]
    expect(calculateJodhi(hand, 'spades')).toBeNull()
  })

  test('K and Q in different suits returns null', () => {
    const hand = [card('K', 'hearts'), card('Q', 'spades')]
    expect(calculateJodhi(hand, null)).toBeNull()
  })

  test('returns first jodhi found if multiple exist', () => {
    const hand = [
      card('K', 'hearts'), card('Q', 'hearts'),
      card('K', 'spades'), card('Q', 'spades'),
    ]
    const result = calculateJodhi(hand, 'spades')
    
    // Should return one of them (implementation returns first found)
    expect(result).not.toBeNull()
    expect([20, 40]).toContain(result!.points)
  })
})

describe('canCallThunee', () => {
  test('can call with 6 cards', () => {
    const hand = [
      card('J', 'hearts'), card('9', 'hearts'), card('A', 'hearts'),
      card('10', 'hearts'), card('K', 'hearts'), card('Q', 'hearts'),
    ]
    expect(canCallThunee(hand)).toBe(true)
  })

  test('cannot call with fewer than 6 cards', () => {
    expect(canCallThunee([card('J', 'hearts')])).toBe(false)
    expect(canCallThunee([])).toBe(false)
  })

  test('cannot call with more than 6 cards', () => {
    const hand = Array(7).fill(card('J', 'hearts'))
    expect(canCallThunee(hand)).toBe(false)
  })
})

describe('hasTrump', () => {
  test('returns true when hand contains trump suit', () => {
    const hand = [card('J', 'hearts'), card('9', 'spades')]
    expect(hasTrump(hand, 'spades')).toBe(true)
  })

  test('returns false when hand has no trump', () => {
    const hand = [card('J', 'hearts'), card('9', 'clubs')]
    expect(hasTrump(hand, 'spades')).toBe(false)
  })
})

describe('getTargetScore', () => {
  test('calculates target correctly', () => {
    // Target = 105 - bid + jodhiDiff
    expect(getTargetScore(0, 0)).toBe(105)
    expect(getTargetScore(10, 0)).toBe(95)
    expect(getTargetScore(50, 0)).toBe(55)
    expect(getTargetScore(0, 20)).toBe(125)
    expect(getTargetScore(30, -20)).toBe(55)
  })
})
