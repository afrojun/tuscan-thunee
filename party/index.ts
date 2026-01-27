import type * as Party from "partykit/server"
import type { GameState, ClientMessage, ServerMessage, Card, Suit } from "../src/game/types"
import { createInitialState, serializeState, deserializeState } from "../src/game/state"
import { getTrickEvents, CALL_TIMER_MS, TRICK_DISPLAY_MS } from "./helpers"
import { handleJoin as handleJoinLogic, canStart } from "./handlers/lobby"
import { handleSetTrump as handleSetTrumpLogic, handleCallThunee as handleCallThuneeLogic } from "./handlers/calling"
import { 
  handleBid as handleBidLogic, 
  handlePass as handlePassLogic, 
  handlePreselectTrump as handlePreselectTrumpLogic,
  handleTimerExpired as handleTimerExpiredLogic
} from "./handlers/bidding"
import {
  handleCallJodhi as handleCallJodhiLogic,
  handlePlayCard as handlePlayCardLogic,
  handleTrickDisplayComplete as handleTrickDisplayCompleteLogic
} from "./handlers/playing"
import {
  evaluatePlayChallenge,
  evaluateJodhiChallenge,
  applyChallengeResult
} from "./handlers/challenge"
import {
  calculateTeamJodhiPoints,
  evaluateThunee,
  calculateNormalScoring,
  awardLastTrickBonus,
  logRoundEnd,
  checkGameOver as checkGameOverLogic,
  rotateDealerAndReset as rotateDealerAndResetLogic,
  setupSecondRound,
  evaluateKhanaak,
  applyKhanaakResult
} from "./handlers/round"
import { setupBiddingPhase } from "./handlers/dealing"

interface ConnectionState {
  playerId: string
}

type AlarmType = 'bidding' | 'trick-display'

export default class ThuneeServer implements Party.Server {
  state: GameState
  connectionPlayerMap: Map<string, string> = new Map() // connectionId -> playerId
  pendingAlarmType: AlarmType | null = null

  constructor(readonly room: Party.Room) {
    this.state = createInitialState(room.id, 4)
  }

  async onStart() {
    const stored = await this.room.storage.get<string>("state")
    if (stored) {
      try {
        const loadedState = deserializeState(stored)
        // Only restore state if there were players (avoid stale empty games)
        if (loadedState.players.length > 0 || loadedState.phase !== 'waiting') {
          this.state = loadedState
        }
      } catch {
        this.state = createInitialState(this.room.id, 4)
      }
    }
  }

  async saveState() {
    await this.room.storage.put("state", serializeState(this.state))
  }

  /**
   * Filter game state for a specific player.
   * Hides other players' hands to prevent cheating via WebSocket inspection.
   */
  getStateForPlayer(playerId: string): GameState {
    return {
      ...this.state,
      players: this.state.players.map(p => {
        // Only show your own hand
        if (p.id === playerId) {
          return p
        }
        
        // Hide all other hands - only show card count via placeholder cards
        return {
          ...p,
          hand: Array(p.hand.length).fill({ suit: 'spades', rank: 'Q' } as Card)
        }
      }),
      // Hide the deck (used in 2-player mode)
      deck: [],
    }
  }

  broadcast(msg: ServerMessage, exclude?: string) {
    for (const conn of this.room.getConnections()) {
      if (exclude && conn.id === exclude) continue
      const playerId = this.connectionPlayerMap.get(conn.id)
      if (playerId) {
        conn.send(JSON.stringify({ ...msg, playerId }))
      }
    }
  }

  sendToConnection(conn: Party.Connection, msg: ServerMessage) {
    const playerId = this.connectionPlayerMap.get(conn.id)
    conn.send(JSON.stringify({ ...msg, playerId }))
  }

  /**
   * Broadcast state to all players, filtering each player's view.
   */
  broadcastState() {
    for (const conn of this.room.getConnections()) {
      const playerId = this.connectionPlayerMap.get(conn.id)
      if (playerId) {
        const filteredState = this.getStateForPlayer(playerId)
        conn.send(JSON.stringify({ 
          type: "state", 
          state: filteredState, 
          playerId 
        }))
      }
    }
  }

  onConnect(conn: Party.Connection) {
    // Generate a temporary player ID - will be replaced on join if reconnecting
    const playerId = crypto.randomUUID()
    this.connectionPlayerMap.set(conn.id, playerId)

    // Send current state immediately (filtered for this player)
    const filteredState = this.getStateForPlayer(playerId)
    conn.send(JSON.stringify({
      type: "state",
      state: filteredState,
      playerId
    }))
  }

  onClose(conn: Party.Connection) {
    const playerId = this.connectionPlayerMap.get(conn.id)
    if (playerId) {
      const player = this.state.players.find(p => p.id === playerId)
      if (player) {
        player.connected = false
        this.broadcastState()
      }
    }
    this.connectionPlayerMap.delete(conn.id)
  }

  onMessage(message: string, sender: Party.Connection) {
    // Validate and parse incoming message
    let msg: ClientMessage
    try {
      const parsed = JSON.parse(message)
      if (!parsed || typeof parsed.type !== 'string') {
        console.error('Invalid message format:', message.slice(0, 100))
        return
      }
      msg = parsed as ClientMessage
    } catch (e) {
      console.error('Failed to parse message:', e)
      return
    }

    const playerId = this.connectionPlayerMap.get(sender.id)
    if (!playerId) return

    switch (msg.type) {
      case "join":
        this.handleJoin(playerId, msg.name, msg.playerCount, sender, msg.existingPlayerId)
        break
      case "start":
        this.handleStart()
        break
      case "bid":
        this.handleBid(playerId, msg.amount)
        break
      case "pass":
        this.handlePass(playerId)
        break
      case "preselect-trump":
        this.handlePreselectTrump(playerId, msg.suit)
        break
      case "set-trump":
        this.handleSetTrump(playerId, msg.suit, msg.lastCard)
        break
      case "call-thunee":
        this.handleCallThunee(playerId)
        break
      case "call-jodhi":
        this.handleCallJodhi(playerId, msg.suit, msg.withJack)
        break
      case "play-card":
        this.handlePlayCard(playerId, msg.card)
        break
      case "challenge-play":
        this.handleChallengePlay(playerId, msg.accusedId)
        break
      case "challenge-jodhi":
        this.handleChallengeJodhi(playerId, msg.accusedId, msg.suit)
        break
      case "call-khanaak":
        this.handleCallKhanaak(playerId)
        break
    }

    this.saveState()
    this.broadcastState()
  }

  handleJoin(playerId: string, name: string, playerCount: 2 | 4 | undefined, conn: Party.Connection, existingPlayerId?: string) {
    const result = handleJoinLogic(this.state, playerId, name, playerCount, existingPlayerId)
    
    // Update connection mapping based on result
    if (result.type === 'reconnected') {
      this.connectionPlayerMap.set(conn.id, result.playerId)
    }
    // For 'joined' and 'spectator', the playerId is already mapped in onConnect
  }

  handleStart() {
    if (!canStart(this.state)) return
    this.startDeal()
  }

  startDeal() {
    setupBiddingPhase(this.state)
    this.startCallTimer()
  }

  async startCallTimer() {
    // Set timer end time
    this.state.bidState.timerEndsAt = Date.now() + CALL_TIMER_MS
    this.pendingAlarmType = 'bidding'

    // Use PartyKit's alarm API for reliable server-side timer
    await this.room.storage.setAlarm(Date.now() + CALL_TIMER_MS)

    await this.saveState()
    this.broadcastState()
  }

  async startTrickDisplayTimer() {
    this.pendingAlarmType = 'trick-display'
    await this.room.storage.setAlarm(Date.now() + TRICK_DISPLAY_MS)
    await this.saveState()
    this.broadcastState()
  }

  // PartyKit alarm handler - called when alarm fires
  async onAlarm() {
    const alarmType = this.pendingAlarmType
    this.pendingAlarmType = null

    if (alarmType === 'bidding' && this.state.phase === "bidding") {
      this.onCallTimerExpired()
    } else if (alarmType === 'trick-display' && this.state.phase === "trick-complete") {
      this.onTrickDisplayComplete()
    }
  }

  onCallTimerExpired() {
    if (this.state.phase !== "bidding") return
    handleTimerExpiredLogic(this.state)
    this.saveState()
    this.broadcastState()
  }

  handleBid(playerId: string, amount: number) {
    const result = handleBidLogic(this.state, playerId, amount)
    if (result.success) {
      this.startCallTimer()
    }
  }

  async handlePass(playerId: string) {
    const result = handlePassLogic(this.state, playerId)
    if (result.success && result.allPassed) {
      await this.room.storage.deleteAlarm()
      this.onCallTimerExpired()
    }
  }

  handlePreselectTrump(playerId: string, suit: Suit) {
    handlePreselectTrumpLogic(this.state, playerId, suit)
  }

  handleSetTrump(playerId: string, suit: Suit, lastCard?: boolean) {
    handleSetTrumpLogic(this.state, playerId, suit, lastCard)
  }

  handleCallThunee(playerId: string) {
    handleCallThuneeLogic(this.state, playerId)
  }

  handleCallJodhi(playerId: string, suit: Suit, withJack: boolean) {
    handleCallJodhiLogic(this.state, playerId, suit, withJack)
  }

  handlePlayCard(playerId: string, card: Card) {
    const result = handlePlayCardLogic(this.state, playerId, card)
    if (result.success && result.trickComplete) {
      this.startTrickDisplayTimer()
    }
  }

  onTrickDisplayComplete() {
    const result = handleTrickDisplayCompleteLogic(this.state)
    if (result.roundOver) {
      this.endRound()
    }
    this.saveState()
    this.broadcastState()
  }

  endRound() {
    const trickEvents = getTrickEvents(this.state.eventLog)
    awardLastTrickBonus(this.state)

    // 2-player mode: check for Thunee in Round 1
    if (this.state.playerCount === 2 && this.state.dealRound === 1 && this.state.thuneeCallerId) {
      const thuneeResult = evaluateThunee(this.state, trickEvents)
      if (thuneeResult) {
        this.state.teams[thuneeResult.winningTeam].balls += 4
        this.state.lastBallAward = { team: thuneeResult.winningTeam, amount: 4, reason: 'thunee' }
        logRoundEnd(this.state, thuneeResult.winningTeam, 4, 'thunee')
      }
      if (this.checkGameOver()) return
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
      return
    }

    // 2-player mode: after Round 1 (no Thunee), go to Round 2
    if (this.state.playerCount === 2 && this.state.dealRound === 1) {
      this.state.dealRound = 2
      setupSecondRound(this.state)
      return
    }

    // Award balls (after Round 2 in 2-player, or after 6 tricks in 4-player)
    const thuneeResult = evaluateThunee(this.state, trickEvents)
    
    if (thuneeResult) {
      this.state.teams[thuneeResult.winningTeam].balls += 4
      this.state.lastBallAward = { team: thuneeResult.winningTeam, amount: 4, reason: 'thunee' }
      logRoundEnd(this.state, thuneeResult.winningTeam, 4, 'thunee')
    } else {
      const { trumpTeamJodhi, countingTeamJodhi } = calculateTeamJodhiPoints(this.state)
      const scoringResult = calculateNormalScoring(this.state, trumpTeamJodhi, countingTeamJodhi)
      this.state.teams[scoringResult.winningTeam].balls += scoringResult.ballsWon
      this.state.lastBallAward = { team: scoringResult.winningTeam, amount: scoringResult.ballsWon, reason: 'normal' }
      logRoundEnd(this.state, scoringResult.winningTeam, scoringResult.ballsWon, 'normal')
    }

    if (this.checkGameOver()) return
    this.state.phase = "round-end"
    this.rotateDealerAndReset()
  }

  checkGameOver(): boolean {
    return checkGameOverLogic(this.state)
  }

  rotateDealerAndReset() {
    rotateDealerAndResetLogic(this.state)
  }

  handleChallengePlay(challengerId: string, accusedId: string) {
    const result = evaluatePlayChallenge(this.state, challengerId, accusedId)
    if (!result.valid) return

    applyChallengeResult(
      this.state, challengerId, accusedId, 'play',
      result.winningTeam, result.wasValidPlay, result.card ?? undefined
    )

    if (!this.checkGameOver()) {
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
    }
  }

  handleChallengeJodhi(challengerId: string, accusedId: string, suit: Suit) {
    const result = evaluateJodhiChallenge(this.state, challengerId, accusedId, suit)
    if (!result.valid) return

    applyChallengeResult(
      this.state, challengerId, accusedId, 'jodhi',
      result.winningTeam, result.jodhiWasValid, undefined, suit
    )

    if (!this.checkGameOver()) {
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
    }
  }

  handleCallKhanaak(playerId: string) {
    const result = evaluateKhanaak(this.state, playerId)
    if (!result.valid) return

    applyKhanaakResult(this.state, playerId, result)

    if (!this.checkGameOver()) {
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
    }
  }
}
