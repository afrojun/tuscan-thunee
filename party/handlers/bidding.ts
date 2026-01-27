/**
 * Bidding phase handlers - bids, passes, and trump preselection.
 */

import type { GameState, Suit } from '../../src/game/types'

/**
 * Result of a bid operation.
 */
export type BidResult = 
  | { success: true; shouldResetTimer: true }
  | { success: false }

/**
 * Handle a player's bid.
 * Returns whether the bid was valid and if the timer should reset.
 */
export function handleBid(
  state: GameState,
  playerId: string,
  amount: number
): BidResult {
  if (state.phase !== 'bidding') return { success: false }

  // Check if player has passed
  if (state.bidState.passed.has(playerId)) return { success: false }

  // Validate bid amount
  if (amount <= state.bidState.currentBid) return { success: false }
  if (amount > 104) return { success: false }
  if (amount % 10 !== 0 && amount !== 104) return { success: false }

  state.bidState.currentBid = amount
  state.bidState.bidderId = playerId

  // Clear any pre-selected trump - bidding war invalidates it
  state.bidState.preSelectedTrump = null

  return { success: true, shouldResetTimer: true }
}

/**
 * Result of a pass operation.
 */
export type PassResult =
  | { success: true; allPassed: boolean }
  | { success: false }

/**
 * Handle a player passing on bidding.
 * Returns whether all other players have now passed.
 */
export function handlePass(
  state: GameState,
  playerId: string
): PassResult {
  if (state.phase !== 'bidding') return { success: false }
  
  // Only relevant if timer is running (someone called)
  if (!state.bidState.timerEndsAt) return { success: false }

  // Can't pass twice
  if (state.bidState.passed.has(playerId)) return { success: false }

  state.bidState.passed.add(playerId)

  // Check if all OTHER players have passed (bidder doesn't need to pass)
  const otherPlayers = state.players.filter(p => p.id !== state.bidState.bidderId)
  const allOthersPassed = otherPlayers.every(p => state.bidState.passed.has(p.id))

  return { success: true, allPassed: allOthersPassed }
}

/**
 * Handle preselecting a trump suit during bidding.
 */
export function handlePreselectTrump(
  state: GameState,
  playerId: string,
  suit: Suit
): boolean {
  if (state.phase !== 'bidding') return false
  
  const someoneHasCalled = state.bidState.currentBid > 0
  
  if (someoneHasCalled) {
    // Only current bidder can preselect after a call
    if (playerId !== state.bidState.bidderId) return false
  } else {
    // Only default trumper can preselect before any calls
    if (playerId !== state.bidState.defaultTrumperId) return false
  }

  state.bidState.preSelectedTrump = suit
  return true
}

/**
 * Result of timer expiration.
 */
export type TimerExpiredResult =
  | { phase: 'calling' }
  | { phase: 'playing'; currentPlayerId: string }

/**
 * Handle the bidding timer expiring.
 * Determines next phase and trump caller.
 */
export function handleTimerExpired(state: GameState): TimerExpiredResult {
  state.bidState.timerEndsAt = null

  const noCalls = state.bidState.currentBid === 0

  if (noCalls) {
    // No one called - default trumper sets trump
    state.trumpCallerId = state.bidState.defaultTrumperId
    state.bidState.bidderId = null

    // If trumper pre-selected, use that trump directly
    if (state.bidState.preSelectedTrump) {
      state.trump = state.bidState.preSelectedTrump
      dealRemainingCards(state)
      
      // Skip calling phase, go straight to playing
      const trumperIndex = state.players.findIndex(p => p.id === state.trumpCallerId)
      const leaderIndex = (trumperIndex + state.playerCount - 1) % state.playerCount
      const currentPlayerId = state.players[leaderIndex].id
      state.currentPlayerId = currentPlayerId
      state.phase = 'playing'
      
      return { phase: 'playing', currentPlayerId }
    } else {
      // Trumper didn't preselect - go to calling phase for them to choose
      dealRemainingCards(state)
      setTrumpCaller(state)
      state.phase = 'calling'
      return { phase: 'calling' }
    }
  } else {
    // Someone called and timer expired - highest bidder wins
    state.trumpCallerId = state.bidState.bidderId
    dealRemainingCards(state)
    setTrumpCaller(state)
    state.phase = 'calling'
    return { phase: 'calling' }
  }
}

/**
 * Deal the remaining 2 cards to each player.
 */
export function dealRemainingCards(state: GameState): void {
  if (state.playerCount === 4) {
    // 4-player: cards 16-23 (2 per player)
    const startIndex = 16
    for (let i = 0; i < 4; i++) {
      const card1 = state.deck[startIndex + i * 2]
      const card2 = state.deck[startIndex + i * 2 + 1]
      if (card1) state.players[i].hand.push(card1)
      if (card2) state.players[i].hand.push(card2)
    }
  } else {
    // 2-player: cards 8-11 (2 per player)
    for (let i = 0; i < 2; i++) {
      const card1 = state.deck[8 + i * 2]
      const card2 = state.deck[8 + i * 2 + 1]
      if (card1) state.players[i].hand.push(card1)
      if (card2) state.players[i].hand.push(card2)
    }
  }
}

/**
 * Set the trump caller based on bidding results.
 */
function setTrumpCaller(state: GameState): void {
  if (state.bidState.bidderId) {
    // Winner of bid sets trump
    state.trumpCallerId = state.bidState.bidderId
    state.currentPlayerId = state.bidState.bidderId
  } else {
    // No one bid - dealer's RHO sets trump
    const dealerIndex = state.players.findIndex(p => p.id === state.dealerId)
    const rhoIndex = (dealerIndex + state.playerCount - 1) % state.playerCount
    state.trumpCallerId = state.players[rhoIndex].id
    state.currentPlayerId = state.players[rhoIndex].id
  }
}
