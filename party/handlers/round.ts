/**
 * Round and scoring handlers - end of round, Khanaak, scoring calculations.
 */

import type { GameState, Trick } from '../../src/game/types'
import { getTrickEvents } from '../helpers'
import { getNextPlayerIndex } from '../../src/game/utils'
import { createEmptyTrick } from '../../src/game/state'

/**
 * Calculate Jodhi points for each team.
 */
export function calculateTeamJodhiPoints(
  state: GameState
): { trumpTeamJodhi: number; countingTeamJodhi: number } {
  const trumpTeam = state.players.find(p => p.id === state.trumpCallerId)?.team ?? 0
  let trumpTeamJodhi = 0
  let countingTeamJodhi = 0

  for (const jodhi of state.jodhiCalls) {
    const jodhiPlayer = state.players.find(p => p.id === jodhi.playerId)
    if (jodhiPlayer?.team === trumpTeam) {
      trumpTeamJodhi += jodhi.points
    } else {
      countingTeamJodhi += jodhi.points
    }
  }

  return { trumpTeamJodhi, countingTeamJodhi }
}

/**
 * Result of evaluating Thunee success.
 */
export interface ThuneeResult {
  thuneeSucceeded: boolean
  thuneeTeam: 0 | 1
  winningTeam: 0 | 1
}

/**
 * Evaluate if Thunee was successful (won all tricks).
 */
export function evaluateThunee(
  state: GameState,
  trickEvents: (Trick & { winnerId: string })[]
): ThuneeResult | null {
  if (!state.thuneeCallerId) return null

  const thuneePlayer = state.players.find(p => p.id === state.thuneeCallerId)!
  const thuneeTeam = thuneePlayer.team

  const wonAllTricks = trickEvents.every(t => {
    const winner = state.players.find(p => p.id === t.winnerId)
    return winner?.team === thuneeTeam
  })

  const otherTeam = thuneeTeam === 0 ? 1 : 0
  return {
    thuneeSucceeded: wonAllTricks,
    thuneeTeam,
    winningTeam: wonAllTricks ? thuneeTeam : otherTeam
  }
}

/**
 * Result of normal (non-Thunee) scoring.
 */
export interface NormalScoringResult {
  winningTeam: 0 | 1
  ballsWon: number
}

/**
 * Calculate normal scoring based on card points, bids, and Jodhi.
 */
export function calculateNormalScoring(
  state: GameState,
  trumpTeamJodhi: number,
  countingTeamJodhi: number
): NormalScoringResult {
  const trumpTeam = state.players.find(p => p.id === state.trumpCallerId)?.team ?? 0
  const countingTeam = trumpTeam === 0 ? 1 : 0

  // Adjusted target and score with Jodhi
  const target = 105 - state.bidState.currentBid + trumpTeamJodhi
  const countingScore = state.teams[countingTeam].cardPoints + countingTeamJodhi

  // "Call and lost": if trump team called (bid > 0) and loses, counting team gets 2 balls
  const trumpTeamCalled = state.bidState.currentBid > 0

  if (countingScore >= target) {
    const ballsWon = trumpTeamCalled ? 2 : 1
    return { winningTeam: countingTeam, ballsWon }
  } else {
    return { winningTeam: trumpTeam, ballsWon: 1 }
  }
}

/**
 * Award 10 bonus points for last trick.
 */
export function awardLastTrickBonus(state: GameState): void {
  const trickEvents = getTrickEvents(state.eventLog)
  const lastTrick = trickEvents[trickEvents.length - 1]
  if (lastTrick?.winnerId) {
    const lastWinner = state.players.find(p => p.id === lastTrick.winnerId)
    if (lastWinner) {
      state.teams[lastWinner.team].cardPoints += 10
    }
  }
}

/**
 * Log a round end event.
 */
export function logRoundEnd(
  state: GameState,
  winningTeam: 0 | 1,
  ballsAwarded: number,
  reason: 'normal' | 'thunee' | 'challenge' | 'khanaak'
): void {
  state.eventLog.push({
    type: 'round-end',
    data: { winningTeam, ballsAwarded, reason },
    roundNumber: state.gameRound,
    timestamp: Date.now()
  })
}

/**
 * Check if the game is over (someone reached winning threshold).
 */
export function checkGameOver(state: GameState): boolean {
  const winThreshold = state.isKhanaakGame ? 13 : 12
  if (state.teams[0].balls >= winThreshold || state.teams[1].balls >= winThreshold) {
    state.phase = 'game-over'
    return true
  }
  return false
}

/**
 * Rotate dealer and reset state for next round.
 */
export function rotateDealerAndReset(state: GameState): void {
  const dealerIndex = state.players.findIndex(p => p.id === state.dealerId)
  const nextDealerIndex = getNextPlayerIndex(dealerIndex, state.playerCount)
  state.dealerId = state.players[nextDealerIndex].id

  // Reset for next deal
  state.teams[0].cardPoints = 0
  state.teams[1].cardPoints = 0
  state.dealRound = 1
  state.gameRound++
}

/**
 * Set up second round in 2-player mode.
 */
export function setupSecondRound(state: GameState): void {
  // Deal remaining 12 cards (6 to each player)
  for (let i = 0; i < 2; i++) {
    state.players[i].hand = []
    for (let j = 0; j < 6; j++) {
      state.players[i].hand.push(state.deck[12 + i * 6 + j])
    }
  }

  state.phase = 'playing'
  state.currentTrick = createEmptyTrick()
  state.tricksPlayed = 0

  // Winner of last trick from Round 1 leads
  const trickEvents = getTrickEvents(state.eventLog)
  const lastTrick = trickEvents[trickEvents.length - 1]
  if (lastTrick?.winnerId) {
    state.currentPlayerId = lastTrick.winnerId
  } else {
    const dealerIndex = state.players.findIndex(p => p.id === state.dealerId)
    state.currentPlayerId = state.players[(dealerIndex + 1) % 2].id
  }
}

/**
 * Result of a Khanaak call.
 */
export type KhanaakResult =
  | { valid: false }
  | { valid: true; success: boolean; callerTeam: 0 | 1; ballsWon: number; isBackward: boolean }

/**
 * Evaluate a Khanaak call.
 */
export function evaluateKhanaak(
  state: GameState,
  playerId: string
): KhanaakResult {
  // Can only be called on the last trick (trick-complete phase after 6th trick)
  if (state.phase !== 'trick-complete') return { valid: false }
  if (state.tricksPlayed !== 6) return { valid: false }

  const caller = state.players.find(p => p.id === playerId)
  if (!caller) return { valid: false }

  // Must be the team winning the last trick
  const lastTrickWinnerId = state.currentTrick.winnerId
  const lastTrickWinner = state.players.find(p => p.id === lastTrickWinnerId)
  if (!lastTrickWinner || caller.team !== lastTrickWinner.team) return { valid: false }

  // Caller's team must have a Jodhi
  const callerTeamJodhi = state.jodhiCalls
    .filter(j => {
      const jodhiPlayer = state.players.find(p => p.id === j.playerId)
      return jodhiPlayer?.team === caller.team
    })
    .reduce((sum, j) => sum + j.points, 0)

  if (callerTeamJodhi === 0) return { valid: false }

  const trumpTeam = state.players.find(p => p.id === state.trumpCallerId)?.team ?? 0
  const isBackward = caller.team !== trumpTeam

  const opponentTeam = caller.team === 0 ? 1 : 0
  const opponentPoints = state.teams[opponentTeam].cardPoints

  // Khanaak succeeds if opponent's card points < caller's Jodhi + 10
  const khanaakThreshold = callerTeamJodhi + 10
  const success = opponentPoints < khanaakThreshold

  const ballsWon = success ? (isBackward ? 6 : 3) : 4

  return {
    valid: true,
    success,
    callerTeam: caller.team,
    ballsWon,
    isBackward
  }
}

/**
 * Apply Khanaak result to game state.
 */
export function applyKhanaakResult(
  state: GameState,
  playerId: string,
  result: Extract<KhanaakResult, { valid: true }>
): void {
  const opponentTeam = result.callerTeam === 0 ? 1 : 0
  const winningTeam = result.success ? result.callerTeam : opponentTeam

  // Log the khanaak call
  state.eventLog.push({
    type: 'khanaak-call',
    data: {
      playerId,
      success: result.success,
      jodhiTotal: result.ballsWon, // Simplified - actual value computed in evaluateKhanaak
      opponentPoints: state.teams[opponentTeam].cardPoints,
      isBackward: result.isBackward
    },
    roundNumber: state.gameRound,
    timestamp: Date.now()
  })

  if (result.success) {
    state.teams[result.callerTeam].balls += result.ballsWon
    state.lastBallAward = { team: result.callerTeam, amount: result.ballsWon, reason: 'normal' }
    state.isKhanaakGame = true
    logRoundEnd(state, result.callerTeam, result.ballsWon, 'khanaak')
  } else {
    state.teams[opponentTeam].balls += 4
    state.lastBallAward = { team: opponentTeam, amount: 4, reason: 'normal' }
    logRoundEnd(state, opponentTeam, 4, 'khanaak')
  }
}
