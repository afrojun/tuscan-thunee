import { describe, test, expect, beforeEach } from 'bun:test'
import {
  getPlayerCardsPlayed,
  reconstructHandAtPlay,
  evaluatePlayChallenge,
  evaluateJodhiChallenge,
  applyChallengeResult
} from './challenge'
import { createInitialState, createEmptyTrick } from '../../src/game/state'
import type { GameState, Card } from '../../src/game/types'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('getPlayerCardsPlayed', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
    ]
    state.gameRound = 1
    state.currentTrick = createEmptyTrick()
  })

  test('returns empty array when no cards played', () => {
    const cards = getPlayerCardsPlayed(state, 'p1')
    expect(cards.length).toBe(0)
  })

  test('includes cards from completed tricks', () => {
    state.eventLog.push({
      type: 'trick',
      data: {
        cards: [{ playerId: 'p1', card: card('J', 'hearts') }],
        leadSuit: 'hearts',
        winnerId: 'p1'
      },
      roundNumber: 1,
      timestamp: Date.now()
    })

    const cards = getPlayerCardsPlayed(state, 'p1')
    expect(cards.length).toBe(1)
    expect(cards[0].rank).toBe('J')
  })

  test('includes cards from current trick', () => {
    state.currentTrick.cards.push({ playerId: 'p1', card: card('9', 'spades') })

    const cards = getPlayerCardsPlayed(state, 'p1')
    expect(cards.length).toBe(1)
    expect(cards[0].rank).toBe('9')
  })

  test('includes cards from both completed and current tricks', () => {
    state.eventLog.push({
      type: 'trick',
      data: {
        cards: [{ playerId: 'p1', card: card('J', 'hearts') }],
        leadSuit: 'hearts',
        winnerId: 'p1'
      },
      roundNumber: 1,
      timestamp: Date.now()
    })
    state.currentTrick.cards.push({ playerId: 'p1', card: card('9', 'spades') })

    const cards = getPlayerCardsPlayed(state, 'p1')
    expect(cards.length).toBe(2)
  })
})

describe('evaluatePlayChallenge', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [card('A', 'hearts')], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [card('K', 'clubs')], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.gameRound = 1
    state.currentTrick = createEmptyTrick()
    state.trump = 'spades'
  })

  test('rejects challenge in wrong phase', () => {
    state.phase = 'bidding'
    const result = evaluatePlayChallenge(state, 'p1', 'p2')
    expect(result.valid).toBe(false)
  })

  test('rejects challenge against teammate', () => {
    state.players[1].team = 0 // Same team
    state.currentTrick.cards.push({ playerId: 'p2', card: card('J', 'hearts') })
    
    const result = evaluatePlayChallenge(state, 'p1', 'p2')
    expect(result.valid).toBe(false)
  })

  test('rejects challenge when accused has not played', () => {
    const result = evaluatePlayChallenge(state, 'p1', 'p2')
    expect(result.valid).toBe(false)
  })

  test('valid play results in accused team winning', () => {
    // p2 leads with clubs (valid - any card when leading)
    state.currentTrick.cards.push({ playerId: 'p2', card: card('K', 'clubs') })
    state.currentTrick.leadSuit = 'clubs'
    
    const result = evaluatePlayChallenge(state, 'p1', 'p2')
    
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.wasValidPlay).toBe(true)
      expect(result.winningTeam).toBe(1) // Accused's team wins (bad challenge)
    }
  })

  test('invalid play results in challenger team winning', () => {
    // p2 has hearts in hand but plays clubs when hearts was led
    state.players[1].hand = [card('K', 'clubs'), card('Q', 'hearts')]
    state.currentTrick.cards = [
      { playerId: 'p1', card: card('A', 'hearts') },
      { playerId: 'p2', card: card('K', 'clubs') }, // Invalid - has hearts
    ]
    state.currentTrick.leadSuit = 'hearts'
    
    const result = evaluatePlayChallenge(state, 'p1', 'p2')
    
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.wasValidPlay).toBe(false)
      expect(result.winningTeam).toBe(0) // Challenger's team wins (caught cheating)
    }
  })
})

describe('evaluateJodhiChallenge', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [card('K', 'hearts'), card('Q', 'hearts')], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'playing'
    state.gameRound = 1
    state.currentTrick = createEmptyTrick()
    state.jodhiCalls = [{ playerId: 'p2', suit: 'hearts', points: 20, hasJack: false }]
  })

  test('rejects challenge when no jodhi claim exists', () => {
    state.jodhiCalls = []
    const result = evaluateJodhiChallenge(state, 'p1', 'p2', 'hearts')
    expect(result.valid).toBe(false)
  })

  test('valid jodhi results in accused team winning', () => {
    const result = evaluateJodhiChallenge(state, 'p1', 'p2', 'hearts')
    
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.jodhiWasValid).toBe(true)
      expect(result.winningTeam).toBe(1) // Accused has K+Q
    }
  })

  test('invalid jodhi (missing K) results in challenger winning', () => {
    state.players[1].hand = [card('Q', 'hearts')] // Only Q, no K
    
    const result = evaluateJodhiChallenge(state, 'p1', 'p2', 'hearts')
    
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.jodhiWasValid).toBe(false)
      expect(result.winningTeam).toBe(0) // Challenger wins
    }
  })

  test('jack claim validated correctly', () => {
    state.jodhiCalls = [{ playerId: 'p2', suit: 'hearts', points: 30, hasJack: true }]
    state.players[1].hand = [card('K', 'hearts'), card('Q', 'hearts')] // K+Q but no J
    
    const result = evaluateJodhiChallenge(state, 'p1', 'p2', 'hearts')
    
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.jodhiWasValid).toBe(false) // Claimed J but doesn't have it
    }
  })

  test('considers cards played this round', () => {
    state.players[1].hand = [card('Q', 'hearts')] // Only Q in hand
    state.eventLog.push({
      type: 'trick',
      data: {
        cards: [{ playerId: 'p2', card: card('K', 'hearts') }], // K was played
        leadSuit: 'hearts',
        winnerId: 'p2'
      },
      roundNumber: 1,
      timestamp: Date.now()
    })
    
    const result = evaluateJodhiChallenge(state, 'p1', 'p2', 'hearts')
    
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.jodhiWasValid).toBe(true) // Had K+Q at some point
    }
  })
})

describe('applyChallengeResult', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.gameRound = 1
  })

  test('awards 4 balls to winning team', () => {
    applyChallengeResult(state, 'p1', 'p2', 'play', 0, false, card('J', 'hearts'))
    expect(state.teams[0].balls).toBe(4)
  })

  test('stores challenge result', () => {
    applyChallengeResult(state, 'p1', 'p2', 'play', 1, true, card('J', 'hearts'))
    
    expect(state.challengeResult).not.toBeNull()
    expect(state.challengeResult!.challengerId).toBe('p1')
    expect(state.challengeResult!.winningTeam).toBe(1)
  })

  test('logs challenge event', () => {
    applyChallengeResult(state, 'p1', 'p2', 'jodhi', 0, false, undefined, 'hearts')
    
    const challengeEvent = state.eventLog.find(e => e.type === 'challenge')
    expect(challengeEvent).toBeDefined()
  })

  test('removes invalid jodhi from calls', () => {
    state.jodhiCalls = [{ playerId: 'p2', suit: 'hearts', points: 20, hasJack: false }]
    
    applyChallengeResult(state, 'p1', 'p2', 'jodhi', 0, false, undefined, 'hearts')
    
    expect(state.jodhiCalls.length).toBe(0)
  })

  test('keeps valid jodhi in calls', () => {
    state.jodhiCalls = [{ playerId: 'p2', suit: 'hearts', points: 20, hasJack: false }]
    
    applyChallengeResult(state, 'p1', 'p2', 'jodhi', 1, true, undefined, 'hearts')
    
    expect(state.jodhiCalls.length).toBe(1)
  })
})
