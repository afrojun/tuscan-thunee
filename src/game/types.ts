export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 'J' | '9' | 'A' | '10' | 'K' | 'Q'

export interface Card {
  suit: Suit
  rank: Rank
}

export const CARD_VALUES: Record<Rank, number> = {
  J: 30,
  '9': 20,
  A: 11,
  '10': 10,
  K: 3,
  Q: 2,
}

export const RANK_ORDER: Rank[] = ['J', '9', 'A', '10', 'K', 'Q']

export interface Player {
  id: string
  name: string
  hand: Card[]
  team: 0 | 1
  connected: boolean
  isSpectator: boolean
}

export interface Trick {
  cards: { playerId: string; card: Card }[]
  leadSuit: Suit | null
  winnerId: string | null
}

export interface TrickResult {
  winnerId: string
  winnerName: string
  winningCard: Card
  points: number
  reason: 'trump' | 'highest'  // Won by trump or highest in lead suit
}

export interface TeamScore {
  balls: number
  cardPoints: number
  jodhi: number
}

export type GamePhase = 
  | 'waiting'
  | 'dealing-first'    // First 4 cards dealt
  | 'bidding'          // Players can bid
  | 'dealing-second'   // Last 2 cards dealt
  | 'calling'          // Thunee can be called
  | 'playing'          // Trick-taking
  | 'round-end'        // Scoring a round
  | 'game-over'

export interface BidState {
  currentBid: number
  bidderId: string | null
  passed: Set<string>
  timerEndsAt: number | null // Unix timestamp when timer expires
  defaultTrumperId: string | null // RHO of dealer - can skip calling
  preSelectedTrump: Suit | null // Trumper's pre-selection before timer expires
}

export interface GameState {
  id: string
  phase: GamePhase
  playerCount: 2 | 4
  players: Player[]
  spectators: Player[]
  
  // Dealing
  dealerId: string | null
  dealRound: number // For 2-player mode (1 or 2)
  
  // Bidding
  bidState: BidState
  
  // Trump
  trump: Suit | null
  trumpCallerId: string | null
  isLastCardTrump: boolean
  
  // Special calls
  thuneeCallerId: string | null
  jodhiCalls: { 
    playerId: string
    points: number
    suit: Suit
    hasJack: boolean
  }[]
  jodhiWindow: boolean
  lastTrickWinningTeam: 0 | 1 | null
  
  // Current trick
  currentTrick: Trick
  tricksPlayed: number
  currentPlayerId: string | null
  lastTrickResult: TrickResult | null
  
  // Scoring
  teams: [TeamScore, TeamScore]
  
  // For challenge system
  lastPlayedCard: { playerId: string; card: Card } | null
  challengeWindow: boolean
  challengeResult: {
    challengerId: string
    accusedId: string
    card: Card
    wasValid: boolean
    winningTeam: 0 | 1
  } | null
  
  // History for disputes
  trickHistory: Trick[]
  
  // Deck for 2-player mode (need to persist across rounds)
  deck: Card[]
}

// Messages from client to server
export type ClientMessage =
  | { type: 'join'; name: string; playerCount?: 2 | 4; existingPlayerId?: string }
  | { type: 'start' }
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'preselect-trump'; suit: Suit }  // Trumper pre-selects during bidding window
  | { type: 'set-trump'; suit: Suit; lastCard?: boolean }
  | { type: 'call-thunee' }
  | { type: 'call-jodhi'; suit: Suit }
  | { type: 'call-trumpless' }
  | { type: 'play-card'; card: Card }
  | { type: 'challenge' }
  | { type: 'accept-play' }

// Messages from server to client
export type ServerMessage =
  | { type: 'state'; state: GameState; playerId: string }
  | { type: 'error'; message: string }
  | { type: 'challenge-result'; valid: boolean; penaltyTeam: 0 | 1 | null }
