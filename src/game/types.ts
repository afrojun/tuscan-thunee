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
  roundNumber?: number  // Which round this trick was played in
}

export interface TrickResult {
  winnerId: string
  winnerName: string
  winningCard: Card
  points: number
  reason: 'trump' | 'highest'  // Won by trump or highest in lead suit
}

// Unified event log types
// To add a new event type:
// 1. Add a new variant to GameEvent union below
// 2. Push the event in party/index.ts where the action occurs
// 3. Add rendering logic in ScoreBoard.tsx inside the eventLog.map()
export type GameEvent =
  | { type: 'trick'; data: Trick & { winnerId: string }; roundNumber: number; timestamp: number }
  | { type: 'challenge'; data: { challengerId: string; accusedId: string; card: Card; wasValid: boolean; winningTeam: 0 | 1 }; roundNumber: number; timestamp: number }
  | { type: 'thunee-call'; data: { playerId: string }; roundNumber: number; timestamp: number }
  | { type: 'jodhi-call'; data: { playerId: string; suit: Suit; points: number; hasJack: boolean }; roundNumber: number; timestamp: number }
  | { type: 'round-start'; data: { dealerId: string }; roundNumber: number; timestamp: number }
  | { type: 'khanaak-call'; data: { playerId: string; success: boolean; jodhiTotal: number; opponentPoints: number; isBackward: boolean }; roundNumber: number; timestamp: number }

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
  | 'trick-complete'   // Brief pause showing completed trick
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
  gameRound: number // Overall round counter (for history)
  
  // Khanaak makes the game require 13 balls instead of 12
  isKhanaakGame: boolean
  
  // Bidding
  bidState: BidState
  
  // Trump
  trump: Suit | null
  trumpCallerId: string | null
  isLastCardTrump: boolean
  trumpRevealed: boolean  // True after first card is played
  
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
  
  // Challenge result (displayed in modal after challenge resolves)
  challengeResult: {
    challengerId: string
    accusedId: string
    challengeType: 'play' | 'jodhi'
    card?: Card        // for play challenges
    suit?: Suit        // for jodhi challenges
    wasValid: boolean
    winningTeam: 0 | 1
  } | null
  
  // Unified event log
  eventLog: GameEvent[]
  
  // Deck for 2-player mode (need to persist across rounds)
  deck: Card[]
  
  // Ball award tracking for celebration animation
  lastBallAward: {
    team: 0 | 1
    amount: number
    reason: 'normal' | 'thunee'
  } | null
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
  | { type: 'call-jodhi'; suit: Suit; withJack: boolean }
  | { type: 'call-trumpless' }
  | { type: 'call-khanaak' }
  | { type: 'play-card'; card: Card }
  | { type: 'challenge-play'; accusedId: string }
  | { type: 'challenge-jodhi'; accusedId: string; suit: Suit }

// Messages from server to client
export type ServerMessage =
  | { type: 'state'; state: GameState; playerId: string }
  | { type: 'error'; message: string }
  | { type: 'challenge-result'; valid: boolean; penaltyTeam: 0 | 1 | null }
