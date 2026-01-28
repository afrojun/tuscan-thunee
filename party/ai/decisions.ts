/**
 * Core AI decision orchestration.
 * 
 * Routes to appropriate strategy based on game phase.
 */

import type { GameState, Player, Suit } from '../../src/game/types'
import type { AIDecision } from './types'
import { decideBid, chooseTrumpSuit, shouldCallLastCard, evaluateHand } from './bidding'
import { decidePlay } from './playing'
import { calculateJodhi } from '../../src/game/rules'

/**
 * Compute the AI's next move based on current game state.
 * Returns null if no action is needed.
 */
export function computeAIMove(state: GameState, playerId: string): AIDecision | null {
  const player = state.players.find(p => p.id === playerId)
  if (!player || !player.isAI) return null
  
  switch (state.phase) {
    case 'bidding':
      return computeBiddingMove(state, player)
    
    case 'calling':
      return computeCallingMove(state, player)
    
    case 'playing':
      return computePlayingMove(state, player)
    
    default:
      return null
  }
}

/**
 * Decide bid or pass during bidding phase.
 */
function computeBiddingMove(state: GameState, player: Player): AIDecision | null {
  // Already passed
  if (state.bidState.passed.has(player.id)) {
    return null
  }
  
  // Check if we're the default trumper (RHO of dealer) - we might want to let timer expire
  if (state.bidState.defaultTrumperId === player.id && state.bidState.currentBid === 0) {
    // We'll become trumper if no one bids - decide if we want that
    const strength = evaluateHand(player.hand)
    if (strength.totalHighCards >= 2) {
      // We have a decent hand, let timer expire to become trumper
      return { type: 'skip' }
    }
    // Weak hand, pass to avoid being forced to trump
    return { type: 'pass' }
  }
  
  const hasAlreadyBid = state.bidState.bidderId === player.id
  const bidAmount = decideBid(player.hand, state.bidState.currentBid, hasAlreadyBid)
  
  if (bidAmount === null) {
    return { type: 'pass' }
  }
  
  return { type: 'bid', amount: bidAmount }
}

/**
 * Decide trump suit and special calls during calling phase.
 */
function computeCallingMove(state: GameState, player: Player): AIDecision | null {
  // Only the trump caller can set trump
  if (state.trumpCallerId !== player.id) {
    // Check if we can call jodhi
    if (state.jodhiWindow) {
      const jodhi = calculateJodhi(player.hand, state.trump)
      if (jodhi) {
        const hasJack = player.hand.some(c => c.suit === jodhi.suit && c.rank === 'J')
        return { type: 'call-jodhi', suit: jodhi.suit, withJack: hasJack }
      }
    }
    return null
  }
  
  // We are the trump caller - need to set trump
  if (!state.trump) {
    const suit = chooseTrumpSuit(player.hand)
    const lastCard = shouldCallLastCard(player.hand)
    return { type: 'set-trump', suit, lastCard }
  }
  
  // Trump is set, check for thunee call
  // AI rarely calls thunee - only with very strong hand
  const strength = evaluateHand(player.hand)
  if (strength.jacks >= 2 && player.hand.length === 6) {
    // Very strong hand - consider thunee
    const trumpCards = player.hand.filter(c => c.suit === state.trump)
    if (trumpCards.some(c => c.rank === 'J') && trumpCards.length >= 3) {
      return { type: 'call-thunee' }
    }
  }
  
  return null
}

/**
 * Decide which card to play during playing phase.
 */
function computePlayingMove(state: GameState, player: Player): AIDecision | null {
  // Not our turn
  if (state.currentPlayerId !== player.id) {
    return null
  }
  
  const card = decidePlay(state, player.id)
  return { type: 'play-card', card }
}

/**
 * Check if any AI player needs to act.
 */
export function getNextAIPlayer(state: GameState): Player | null {
  // In bidding phase, any AI that hasn't passed might need to act
  if (state.phase === 'bidding') {
    for (const player of state.players) {
      if (player.isAI && !state.bidState.passed.has(player.id)) {
        // Check if this AI should act (not already the highest bidder)
        if (state.bidState.bidderId !== player.id) {
          return player
        }
      }
    }
    return null
  }
  
  // In calling phase, check if trump caller is AI
  if (state.phase === 'calling') {
    if (!state.trump && state.trumpCallerId) {
      const caller = state.players.find(p => p.id === state.trumpCallerId)
      if (caller?.isAI) return caller
    }
    // Also check for jodhi calls from any AI
    if (state.jodhiWindow) {
      for (const player of state.players) {
        if (player.isAI) {
          const jodhi = calculateJodhi(player.hand, state.trump)
          const hasCalledJodhi = state.jodhiCalls.some(j => j.playerId === player.id)
          if (jodhi && !hasCalledJodhi) {
            return player
          }
        }
      }
    }
    return null
  }
  
  // In playing phase, check if current player is AI
  if (state.phase === 'playing' && state.currentPlayerId) {
    const current = state.players.find(p => p.id === state.currentPlayerId)
    if (current?.isAI) return current
  }
  
  return null
}
