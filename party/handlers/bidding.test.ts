import { describe, test, expect, beforeEach } from 'bun:test'
import { 
  handleBid, 
  handlePass, 
  handlePreselectTrump,
  handleTimerExpired,
  dealRemainingCards 
} from './bidding'
import { createInitialState, createEmptyBidState } from '../../src/game/state'
import type { GameState } from '../../src/game/types'

describe('handleBid', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'bidding'
    state.bidState = createEmptyBidState()
  })

  test('accepts valid first bid of 10', () => {
    const result = handleBid(state, 'p1', 10)
    
    expect(result.success).toBe(true)
    expect(state.bidState.currentBid).toBe(10)
    expect(state.bidState.bidderId).toBe('p1')
  })

  test('accepts bid higher than current', () => {
    state.bidState.currentBid = 30
    
    const result = handleBid(state, 'p2', 40)
    
    expect(result.success).toBe(true)
    expect(state.bidState.currentBid).toBe(40)
  })

  test('accepts 104 bid', () => {
    state.bidState.currentBid = 100
    
    const result = handleBid(state, 'p1', 104)
    
    expect(result.success).toBe(true)
    expect(state.bidState.currentBid).toBe(104)
  })

  test('rejects bid not multiple of 10 (except 104)', () => {
    const result = handleBid(state, 'p1', 15)
    
    expect(result.success).toBe(false)
    expect(state.bidState.currentBid).toBe(0)
  })

  test('rejects bid equal to current', () => {
    state.bidState.currentBid = 30
    
    const result = handleBid(state, 'p1', 30)
    
    expect(result.success).toBe(false)
  })

  test('rejects bid lower than current', () => {
    state.bidState.currentBid = 30
    
    const result = handleBid(state, 'p1', 20)
    
    expect(result.success).toBe(false)
  })

  test('rejects bid over 104', () => {
    const result = handleBid(state, 'p1', 110)
    
    expect(result.success).toBe(false)
  })

  test('rejects bid from player who passed', () => {
    state.bidState.passed.add('p1')
    
    const result = handleBid(state, 'p1', 10)
    
    expect(result.success).toBe(false)
  })

  test('clears preselected trump on new bid', () => {
    state.bidState.preSelectedTrump = 'hearts'
    
    handleBid(state, 'p1', 10)
    
    expect(state.bidState.preSelectedTrump).toBeNull()
  })

  test('rejects bid in wrong phase', () => {
    state.phase = 'playing'
    
    const result = handleBid(state, 'p1', 10)
    
    expect(result.success).toBe(false)
  })
})

describe('handlePass', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'bidding'
    state.bidState = createEmptyBidState()
    state.bidState.currentBid = 30
    state.bidState.bidderId = 'p1'
    state.bidState.timerEndsAt = Date.now() + 10000
  })

  test('allows player to pass', () => {
    const result = handlePass(state, 'p2')
    
    expect(result.success).toBe(true)
    expect(state.bidState.passed.has('p2')).toBe(true)
  })

  test('rejects pass when no timer running', () => {
    state.bidState.timerEndsAt = null
    
    const result = handlePass(state, 'p2')
    
    expect(result.success).toBe(false)
  })

  test('rejects double pass', () => {
    state.bidState.passed.add('p2')
    
    const result = handlePass(state, 'p2')
    
    expect(result.success).toBe(false)
  })

  test('returns allPassed true when all others have passed', () => {
    state.bidState.passed.add('p2')
    state.bidState.passed.add('p3')
    
    const result = handlePass(state, 'p4')
    
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.allPassed).toBe(true)
    }
  })

  test('returns allPassed false when some still need to pass', () => {
    const result = handlePass(state, 'p2')
    
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.allPassed).toBe(false)
    }
  })
})

describe('handlePreselectTrump', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'bidding'
    state.bidState = createEmptyBidState()
    state.bidState.defaultTrumperId = 'p1'
  })

  test('default trumper can preselect before any calls', () => {
    const result = handlePreselectTrump(state, 'p1', 'hearts')
    
    expect(result).toBe(true)
    expect(state.bidState.preSelectedTrump).toBe('hearts')
  })

  test('non-trumper cannot preselect before any calls', () => {
    const result = handlePreselectTrump(state, 'p2', 'hearts')
    
    expect(result).toBe(false)
    expect(state.bidState.preSelectedTrump).toBeNull()
  })

  test('current bidder can preselect after a call', () => {
    state.bidState.currentBid = 30
    state.bidState.bidderId = 'p2'
    
    const result = handlePreselectTrump(state, 'p2', 'spades')
    
    expect(result).toBe(true)
    expect(state.bidState.preSelectedTrump).toBe('spades')
  })

  test('non-bidder cannot preselect after a call', () => {
    state.bidState.currentBid = 30
    state.bidState.bidderId = 'p2'
    
    const result = handlePreselectTrump(state, 'p1', 'spades')
    
    expect(result).toBe(false)
  })
})

describe('handleTimerExpired', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    state.phase = 'bidding'
    state.bidState = createEmptyBidState()
    state.bidState.timerEndsAt = Date.now()
    state.dealerId = 'p1'
    // Mock deck with enough cards
    state.deck = Array(24).fill({ suit: 'hearts', rank: 'J' })
  })

  test('with no calls, goes to calling phase', () => {
    state.bidState.defaultTrumperId = 'p4' // RHO of dealer
    
    const result = handleTimerExpired(state)
    
    expect(result.phase).toBe('calling')
    expect(state.phase).toBe('calling')
    expect(state.trumpCallerId).toBe('p4')
  })

  test('with preselected trump, goes directly to playing', () => {
    state.bidState.defaultTrumperId = 'p4'
    state.bidState.preSelectedTrump = 'spades'
    
    const result = handleTimerExpired(state)
    
    expect(result.phase).toBe('playing')
    expect(state.phase).toBe('playing')
    expect(state.trump).toBe('spades')
  })

  test('with winning bid, bidder becomes trump caller', () => {
    state.bidState.currentBid = 40
    state.bidState.bidderId = 'p2'
    
    const result = handleTimerExpired(state)
    
    expect(result.phase).toBe('calling')
    expect(state.trumpCallerId).toBe('p2')
  })

  test('clears timer', () => {
    handleTimerExpired(state)
    
    expect(state.bidState.timerEndsAt).toBeNull()
  })
})

describe('dealRemainingCards', () => {
  let state: GameState

  beforeEach(() => {
    state = createInitialState('test-game', 4)
    state.players = [
      { id: 'p1', name: 'Alice', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p2', name: 'Bob', hand: [], team: 1, connected: true, isSpectator: false },
      { id: 'p3', name: 'Charlie', hand: [], team: 0, connected: true, isSpectator: false },
      { id: 'p4', name: 'Diana', hand: [], team: 1, connected: true, isSpectator: false },
    ]
    // Create a deck with distinct cards for testing
    state.deck = Array(24).fill(null).map((_, i) => ({ 
      suit: 'hearts' as const, 
      rank: String(i) as any 
    }))
  })

  test('deals 2 more cards to each player (4-player)', () => {
    dealRemainingCards(state)
    
    expect(state.players[0].hand.length).toBe(2)
    expect(state.players[1].hand.length).toBe(2)
    expect(state.players[2].hand.length).toBe(2)
    expect(state.players[3].hand.length).toBe(2)
  })

  test('deals from correct deck positions (4-player)', () => {
    dealRemainingCards(state)
    
    // Player 0 gets cards 16, 17
    expect(state.players[0].hand[0].rank).toBe('16')
    expect(state.players[0].hand[1].rank).toBe('17')
    // Player 1 gets cards 18, 19
    expect(state.players[1].hand[0].rank).toBe('18')
  })

  test('deals 2 cards in 2-player mode', () => {
    state.playerCount = 2
    state.players = state.players.slice(0, 2)
    
    dealRemainingCards(state)
    
    expect(state.players[0].hand.length).toBe(2)
    expect(state.players[1].hand.length).toBe(2)
    // Player 0 gets cards 8, 9
    expect(state.players[0].hand[0].rank).toBe('8')
  })
})
