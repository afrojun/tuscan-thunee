/**
 * Challenge handlers - challenging plays and Jodhi claims.
 */

import type { GameState, Card, Suit, Trick } from '../../src/game/types'
import { isValidPlay } from '../../src/game/rules'
import { getTrickEvents } from '../helpers'

/**
 * Get all cards a player has played this round.
 */
export function getPlayerCardsPlayed(state: GameState, playerId: string): Card[] {
  const trickEvents = getTrickEvents(state.eventLog, state.gameRound)
  const cardsPlayed: Card[] = []
  
  for (const trick of trickEvents) {
    const play = trick.cards.find(c => c.playerId === playerId)
    if (play) cardsPlayed.push(play.card)
  }
  
  const currentPlay = state.currentTrick.cards.find(c => c.playerId === playerId)
  if (currentPlay) cardsPlayed.push(currentPlay.card)
  
  return cardsPlayed
}

/**
 * Reconstruct a player's hand at a specific point in time.
 */
export function reconstructHandAtPlay(
  state: GameState,
  playerId: string,
  trickIndex: number,
  cardIndexInTrick: number
): Card[] {
  const accused = state.players.find(p => p.id === playerId)
  if (!accused) return []
  
  const trickEvents = getTrickEvents(state.eventLog, state.gameRound)
  const hand = [...accused.hand]
  
  // Add back cards played after the challenged play
  for (let i = trickIndex + 1; i < trickEvents.length; i++) {
    const play = trickEvents[i].cards.find(c => c.playerId === playerId)
    if (play) hand.push(play.card)
  }
  
  // Add back cards from current trick (if it's after the challenged trick)
  if (trickIndex < trickEvents.length) {
    const currentPlay = state.currentTrick.cards.find(c => c.playerId === playerId)
    if (currentPlay) hand.push(currentPlay.card)
  } else {
    // Challenged play is in current trick - add back cards played after it
    for (let i = cardIndexInTrick + 1; i < state.currentTrick.cards.length; i++) {
      if (state.currentTrick.cards[i].playerId === playerId) {
        hand.push(state.currentTrick.cards[i].card)
      }
    }
  }
  
  // Add the challenged card itself
  const challengedTrick = trickIndex < trickEvents.length 
    ? trickEvents[trickIndex] 
    : state.currentTrick
  const challengedPlay = challengedTrick.cards.find(c => c.playerId === playerId)
  if (challengedPlay) hand.push(challengedPlay.card)
  
  return hand
}

/**
 * Get the most recent card played by a player.
 */
export function getMostRecentPlay(
  state: GameState,
  playerId: string
): Card | null {
  const currentPlay = state.currentTrick.cards.find(c => c.playerId === playerId)
  if (currentPlay) return currentPlay.card
  
  const trickEvents = getTrickEvents(state.eventLog, state.gameRound)
  for (let i = trickEvents.length - 1; i >= 0; i--) {
    const play = trickEvents[i].cards.find(c => c.playerId === playerId)
    if (play) return play.card
  }
  return null
}

/**
 * Result of a play challenge.
 */
export type PlayChallengeResult =
  | { valid: false }
  | { valid: true; winningTeam: 0 | 1; wasValidPlay: boolean; card: Card | null }

/**
 * Check if a play challenge is valid and determine the outcome.
 */
export function evaluatePlayChallenge(
  state: GameState,
  challengerId: string,
  accusedId: string
): PlayChallengeResult {
  if (state.phase !== 'playing' && state.phase !== 'trick-complete') {
    return { valid: false }
  }

  const challenger = state.players.find(p => p.id === challengerId)
  const accused = state.players.find(p => p.id === accusedId)

  if (!challenger || !accused) return { valid: false }
  if (challenger.team === accused.team) return { valid: false }

  const trickEvents = getTrickEvents(state.eventLog, state.gameRound)
  let foundInvalidPlay = false
  let invalidCard: Card | null = null

  // Build list of all tricks to check
  const allTricks: { trick: Trick; trickIndex: number }[] = [
    ...trickEvents.map((t, i) => ({ trick: t, trickIndex: i })),
  ]
  
  if (state.currentTrick.cards.length > 0) {
    allTricks.push({ trick: state.currentTrick, trickIndex: trickEvents.length })
  }

  // Check if accused has played any cards
  const hasPlayed = allTricks.some(({ trick }) => 
    trick.cards.some(c => c.playerId === accusedId)
  )
  if (!hasPlayed) return { valid: false }

  // Check each trick for invalid plays
  for (const { trick, trickIndex } of allTricks) {
    const accusedPlayIndex = trick.cards.findIndex(c => c.playerId === accusedId)
    if (accusedPlayIndex === -1) continue

    const accusedPlay = trick.cards[accusedPlayIndex]
    const card = accusedPlay.card

    const handBefore = reconstructHandAtPlay(state, accusedId, trickIndex, accusedPlayIndex)
    const cardsBeforePlay = trick.cards.slice(0, accusedPlayIndex)

    const trickBefore: Trick = {
      cards: cardsBeforePlay,
      leadSuit: cardsBeforePlay.length > 0 ? trick.leadSuit : null,
      winnerId: null
    }

    const validation = isValidPlay(card, handBefore, trickBefore, state.trump)

    if (!validation.valid) {
      foundInvalidPlay = true
      invalidCard = card
      break
    }
  }

  const wasValidPlay = !foundInvalidPlay
  const winningTeam = wasValidPlay ? accused.team : challenger.team
  const cardToShow = invalidCard ?? getMostRecentPlay(state, accusedId)

  return { valid: true, winningTeam, wasValidPlay, card: cardToShow }
}

/**
 * Result of a Jodhi challenge.
 */
export type JodhiChallengeResult =
  | { valid: false }
  | { valid: true; winningTeam: 0 | 1; jodhiWasValid: boolean }

/**
 * Check if a Jodhi challenge is valid and determine the outcome.
 */
export function evaluateJodhiChallenge(
  state: GameState,
  challengerId: string,
  accusedId: string,
  suit: Suit
): JodhiChallengeResult {
  if (state.phase !== 'playing' && state.phase !== 'trick-complete') {
    return { valid: false }
  }

  const challenger = state.players.find(p => p.id === challengerId)
  const accused = state.players.find(p => p.id === accusedId)

  if (!challenger || !accused) return { valid: false }
  if (challenger.team === accused.team) return { valid: false }

  const jodhiClaim = state.jodhiCalls.find(j => j.playerId === accusedId && j.suit === suit)
  if (!jodhiClaim) return { valid: false }

  // Check if Q+K (and J if claimed) exist in hand + played cards
  const allCards = [...accused.hand, ...getPlayerCardsPlayed(state, accusedId)]
  const hasQ = allCards.some(c => c.suit === suit && c.rank === 'Q')
  const hasK = allCards.some(c => c.suit === suit && c.rank === 'K')
  const hasJ = allCards.some(c => c.suit === suit && c.rank === 'J')
  
  const jodhiWasValid = hasQ && hasK && (!jodhiClaim.hasJack || hasJ)
  const winningTeam = jodhiWasValid ? accused.team : challenger.team

  return { valid: true, winningTeam, jodhiWasValid }
}

/**
 * Apply the result of a challenge to the game state.
 */
export function applyChallengeResult(
  state: GameState,
  challengerId: string,
  accusedId: string,
  challengeType: 'play' | 'jodhi',
  winningTeam: 0 | 1,
  wasValid: boolean,
  card?: Card,
  suit?: Suit
): void {
  // Store challenge result for UI
  state.challengeResult = {
    challengerId,
    accusedId,
    challengeType,
    card,
    suit,
    wasValid,
    winningTeam
  }

  // Add to event log
  state.eventLog.push({
    type: 'challenge',
    data: {
      challengerId,
      accusedId,
      card: card ?? { suit: suit!, rank: 'Q' },
      wasValid,
      winningTeam
    },
    roundNumber: state.gameRound,
    timestamp: Date.now()
  })

  // Award 4 balls to winning team
  state.teams[winningTeam].balls += 4

  // Log round end
  state.eventLog.push({
    type: 'round-end',
    data: { winningTeam, ballsAwarded: 4, reason: 'challenge' },
    roundNumber: state.gameRound,
    timestamp: Date.now()
  })

  // Remove invalid jodhi if applicable
  if (challengeType === 'jodhi' && !wasValid) {
    state.jodhiCalls = state.jodhiCalls.filter(
      j => !(j.playerId === accusedId && j.suit === suit)
    )
  }
}
