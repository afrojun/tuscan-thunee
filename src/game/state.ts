import type { GameState, Player, TeamScore, Trick, BidState } from './types'

export function createInitialState(gameId: string, playerCount: 2 | 4): GameState {
  return {
    id: gameId,
    phase: 'waiting',
    playerCount,
    players: [],
    spectators: [],
    
    dealerId: null,
    dealRound: 1,
    gameRound: 1,
    
    bidState: createEmptyBidState(),
    
    trump: null,
    trumpCallerId: null,
    isLastCardTrump: false,
    
    thuneeCallerId: null,
    jodhiCalls: [],
    jodhiWindow: false,
    lastTrickWinningTeam: null,
    
    currentTrick: createEmptyTrick(),
    tricksPlayed: 0,
    currentPlayerId: null,
    lastTrickResult: null,
    
    teams: [createEmptyTeamScore(), createEmptyTeamScore()],
    
    challengeResult: null,
    
    eventLog: [],
    deck: [],
  }
}

export function createEmptyBidState(): BidState {
  return {
    currentBid: 0,
    bidderId: null,
    passed: new Set(),
    timerEndsAt: null,
    defaultTrumperId: null,
    preSelectedTrump: null,
  }
}

export function createEmptyTrick(): Trick {
  return {
    cards: [],
    leadSuit: null,
    winnerId: null,
  }
}

export function createEmptyTeamScore(): TeamScore {
  return {
    balls: 0,
    cardPoints: 0,
    jodhi: 0,
  }
}

export function createPlayer(id: string, name: string, team: 0 | 1): Player {
  return {
    id,
    name,
    hand: [],
    team,
    connected: true,
    isSpectator: false,
  }
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state, (_key, value) => {
    if (value instanceof Set) {
      return { __type: 'Set', values: [...value] }
    }
    return value
  })
}

export function deserializeState(json: string): GameState {
  return JSON.parse(json, (_key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Set') {
      return new Set(value.values)
    }
    return value
  })
}
