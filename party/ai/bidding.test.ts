import { describe, test, expect } from 'bun:test'
import { evaluateHand, decideBid, chooseTrumpSuit, analyzeSuit } from './bidding'
import type { Card } from '../../src/game/types'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('analyzeSuit', () => {
  test('identifies jack, nine, ace correctly', () => {
    const hand: Card[] = [
      card('J', 'hearts'),
      card('9', 'hearts'),
      card('A', 'hearts'),
    ]
    
    const analysis = analyzeSuit(hand, 'hearts')
    
    expect(analysis.hasJack).toBe(true)
    expect(analysis.hasNine).toBe(true)
    expect(analysis.hasAce).toBe(true)
    expect(analysis.count).toBe(3)
    expect(analysis.strength).toBeGreaterThan(10) // High strength with J, 9, A
  })

  test('returns zero count for void suit', () => {
    const hand: Card[] = [
      card('J', 'hearts'),
      card('9', 'hearts'),
    ]
    
    const analysis = analyzeSuit(hand, 'spades')
    
    expect(analysis.count).toBe(0)
    expect(analysis.hasJack).toBe(false)
    expect(analysis.hasNine).toBe(false)
    expect(analysis.hasAce).toBe(false)
  })
})

describe('evaluateHand', () => {
  test('counts jacks, nines, and aces', () => {
    const hand: Card[] = [
      card('J', 'hearts'),
      card('J', 'spades'),
      card('9', 'diamonds'),
      card('A', 'clubs'),
      card('K', 'hearts'),
      card('Q', 'spades'),
    ]
    
    const strength = evaluateHand(hand)
    
    expect(strength.jacks).toBe(2)
    expect(strength.nines).toBe(1)
    expect(strength.aces).toBe(1)
    expect(strength.totalHighCards).toBe(4)
  })

  test('identifies best trump suit', () => {
    const hand: Card[] = [
      card('J', 'hearts'),
      card('9', 'hearts'),
      card('Q', 'hearts'),
      card('K', 'spades'),
      card('Q', 'spades'),
      card('10', 'diamonds'),
    ]
    
    const strength = evaluateHand(hand)
    
    // Hearts should be strongest (J + 9 + Q)
    expect(strength.trumpPotential[0].suit).toBe('hearts')
  })
})

describe('decideBid', () => {
  test('passes with weak hand', () => {
    const weakHand: Card[] = [
      card('Q', 'hearts'),
      card('K', 'spades'),
      card('10', 'diamonds'),
      card('Q', 'clubs'),
    ]
    
    const bid = decideBid(weakHand, 0, false)
    
    expect(bid).toBeNull()
  })

  test('bids with strong hand', () => {
    const strongHand: Card[] = [
      card('J', 'hearts'),
      card('J', 'spades'),
      card('9', 'hearts'),
      card('A', 'diamonds'),
      card('K', 'clubs'),
      card('Q', 'hearts'),
    ]
    
    const bid = decideBid(strongHand, 0, false)
    
    // Should bid with 2 jacks
    expect(bid).not.toBeNull()
  })

  test('does not overbid', () => {
    const mediumHand: Card[] = [
      card('J', 'hearts'),
      card('9', 'spades'),
      card('A', 'diamonds'),
      card('K', 'clubs'),
      card('Q', 'hearts'),
      card('10', 'hearts'),
    ]
    
    // Current bid is already high
    const bid = decideBid(mediumHand, 40, false)
    
    // Should pass rather than overbid
    expect(bid).toBeNull()
  })

  test('bids higher than current bid', () => {
    const strongHand: Card[] = [
      card('J', 'hearts'),
      card('J', 'spades'),
      card('9', 'hearts'),
      card('A', 'diamonds'),
      card('K', 'clubs'),
      card('Q', 'hearts'),
    ]
    
    const bid = decideBid(strongHand, 15, true)
    
    expect(bid).not.toBeNull()
    if (bid !== null) {
      expect(bid).toBeGreaterThan(15)
    }
  })
})

describe('chooseTrumpSuit', () => {
  test('chooses suit with jack', () => {
    const hand: Card[] = [
      card('J', 'hearts'),
      card('K', 'hearts'),
      card('9', 'spades'),
      card('Q', 'diamonds'),
      card('10', 'clubs'),
      card('A', 'clubs'),
    ]
    
    const trump = chooseTrumpSuit(hand)
    
    expect(trump).toBe('hearts') // Has J
  })

  test('chooses longest strong suit', () => {
    const hand: Card[] = [
      card('9', 'hearts'),
      card('A', 'hearts'),
      card('K', 'hearts'),
      card('Q', 'spades'),
      card('10', 'diamonds'),
      card('K', 'clubs'),
    ]
    
    const trump = chooseTrumpSuit(hand)
    
    expect(trump).toBe('hearts') // 3 cards including 9 and A
  })
})
