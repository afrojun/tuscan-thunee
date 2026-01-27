import { describe, test, expect, beforeEach } from 'bun:test'
import {
  calculateTeamJodhiPoints,
  evaluateThunee,
  calculateNormalScoring,
  awardLastTrickBonus,
  checkGameOver,
  rotateDealerAndReset,
  evaluateKhanaak
} from './round'
import { createInitialState, createEmptyTrick } from '../../src/game/state'
import type { GameState, Card, Trick } from '../../src/game/types'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('calculateTeamJodhiPoints', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.trumpCallerId = 'p1' // Team 0 is trump team
  })

  test('calculates jodhi points by team', () => {
    state.jodhiCalls = [
      { playerId: 'p1', suit: 'hearts', points: 20, hasJack: false },
      { playerId: 'p2', suit: 'spades', points: 40, hasJack: false },
    ]

    const result = calculateTeamJodhiPoints(state)

    expect(result.trumpTeamJodhi).toBe(20) // p1 is on trump team (0)
    expect(result.countingTeamJodhi).toBe(40) // p2 is on counting team (1)
  })

  test('returns zero when no jodhis', () => {
    state.jodhiCalls = []

    const result = calculateTeamJodhiPoints(state)

    expect(result.trumpTeamJodhi).toBe(0)
    expect(result.countingTeamJodhi).toBe(0)
  })
})

describe('evaluateThunee', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
    ]
  })

  test('returns null when no thunee called', () => {
    state.thuneeCallerId = null
    const result = evaluateThunee(state, [])
    expect(result).toBeNull()
  })

  test('succeeds when thunee team won all tricks', () => {
    state.thuneeCallerId = 'p1'
    const tricks = [
      { cards: [], leadSuit: null, winnerId: 'p1' },
      { cards: [], leadSuit: null, winnerId: 'p1' },
    ] as (Trick & { winnerId: string })[]

    const result = evaluateThunee(state, tricks)

    expect(result?.thuneeSucceeded).toBe(true)
    expect(result?.winningTeam).toBe(0)
  })

  test('fails when opponent won any trick', () => {
    state.thuneeCallerId = 'p1'
    const tricks = [
      { cards: [], leadSuit: null, winnerId: 'p1' },
      { cards: [], leadSuit: null, winnerId: 'p2' }, // Opponent won
    ] as (Trick & { winnerId: string })[]

    const result = evaluateThunee(state, tricks)

    expect(result?.thuneeSucceeded).toBe(false)
    expect(result?.winningTeam).toBe(1) // Opponent team wins
  })
})

describe('calculateNormalScoring', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.trumpCallerId = 'p1'
    state.bidState.currentBid = 30
  })

  test('trump team wins with low bid and opponent under target', () => {
    // Target = 105 - 30 + 0 (jodhi) = 75
    state.teams[0].cardPoints = 60
    state.teams[1].cardPoints = 44 // Under 75

    const result = calculateNormalScoring(state, 0, 0)

    expect(result.winningTeam).toBe(0) // Trump team
    expect(result.ballsWon).toBe(1)
  })

  test('counting team wins 1 ball when reaching target (no bid)', () => {
    state.bidState.currentBid = 0 // No call
    // Target = 105 - 0 = 105 (but team 1 is counting)
    state.teams[1].cardPoints = 105

    const result = calculateNormalScoring(state, 0, 0)

    expect(result.winningTeam).toBe(1)
    expect(result.ballsWon).toBe(1) // Not "call and lost"
  })

  test('counting team wins 2 balls on call and lost', () => {
    state.bidState.currentBid = 40
    // Target = 105 - 40 = 65
    state.teams[1].cardPoints = 70 // Counting team exceeds target

    const result = calculateNormalScoring(state, 0, 0)

    expect(result.winningTeam).toBe(1)
    expect(result.ballsWon).toBe(2) // "Call and lost"
  })

  test('jodhi affects target and scoring', () => {
    state.bidState.currentBid = 30
    // Target = 105 - 30 + 20 (trump jodhi) = 95
    state.teams[1].cardPoints = 60

    const result = calculateNormalScoring(state, 20, 30)
    // Counting score = 60 + 30 (counting jodhi) = 90, under 95

    expect(result.winningTeam).toBe(0) // Trump team wins
  })
})

describe('checkGameOver', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.isKhanaakGame = false
  })

  test('returns false when below threshold', () => {
    state.teams[0].balls = 10
    state.teams[1].balls = 8

    expect(checkGameOver(state)).toBe(false)
    expect(state.phase).not.toBe('game-over')
  })

  test('returns true at 12 balls (normal game)', () => {
    state.teams[0].balls = 12

    expect(checkGameOver(state)).toBe(true)
    expect(state.phase).toBe('game-over')
  })

  test('requires 13 balls in khanaak game', () => {
    state.isKhanaakGame = true
    state.teams[0].balls = 12

    expect(checkGameOver(state)).toBe(false)

    state.teams[0].balls = 13
    expect(checkGameOver(state)).toBe(true)
  })
})

describe('rotateDealerAndReset', () => {
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
    state.teams[0].cardPoints = 50
    state.teams[1].cardPoints = 54
    state.gameRound = 1
  })

  test('rotates dealer to next player', () => {
    rotateDealerAndReset(state)
    expect(state.dealerId).toBe('p2')
  })

  test('resets card points', () => {
    rotateDealerAndReset(state)
    expect(state.teams[0].cardPoints).toBe(0)
    expect(state.teams[1].cardPoints).toBe(0)
  })

  test('increments game round', () => {
    rotateDealerAndReset(state)
    expect(state.gameRound).toBe(2)
  })
})

describe('evaluateKhanaak', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'trick-complete'
    state.tricksPlayed = 6
    state.currentTrick = { cards: [], leadSuit: null, winnerId: 'p1' }
    state.jodhiCalls = [{ playerId: 'p1', suit: 'hearts', points: 40, hasJack: false }]
    state.trumpCallerId = 'p1'
    state.teams[1].cardPoints = 30 // Opponent points
  })

  test('rejects khanaak before 6th trick', () => {
    state.tricksPlayed = 5
    const result = evaluateKhanaak(state, 'p1')
    expect(result.valid).toBe(false)
  })

  test('rejects khanaak from non-winning team', () => {
    state.currentTrick.winnerId = 'p2' // Team 1 won
    const result = evaluateKhanaak(state, 'p1') // Team 0 tries to call
    expect(result.valid).toBe(false)
  })

  test('rejects khanaak without jodhi', () => {
    state.jodhiCalls = []
    const result = evaluateKhanaak(state, 'p1')
    expect(result.valid).toBe(false)
  })

  test('succeeds when opponent points < jodhi + 10', () => {
    state.teams[1].cardPoints = 40 // Just under 50 threshold
    const result = evaluateKhanaak(state, 'p1')

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.success).toBe(true)
      expect(result.ballsWon).toBe(3) // Forward khanaak
    }
  })

  test('fails when opponent points >= jodhi + 10', () => {
    state.teams[1].cardPoints = 50 // At threshold
    const result = evaluateKhanaak(state, 'p1')

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.success).toBe(false)
      expect(result.ballsWon).toBe(4) // Failed khanaak penalty
    }
  })

  test('backward khanaak awards 6 balls', () => {
    state.trumpCallerId = 'p2' // p2 is trump caller
    state.jodhiCalls = [{ playerId: 'p1', suit: 'hearts', points: 60, hasJack: true }]
    state.teams[1].cardPoints = 30

    const result = evaluateKhanaak(state, 'p1')

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.isBackward).toBe(true)
      expect(result.ballsWon).toBe(6)
    }
  })
})
