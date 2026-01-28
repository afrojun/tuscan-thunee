import type * as Party from "partykit/server"
import type { GameState, ClientMessage, ServerMessage, Suit, Card } from "../src/game/types"
import { createInitialState, serializeState, deserializeState } from "../src/game/state"
import { CALL_TIMER_MS, TRICK_DISPLAY_MS, filterStateForPlayer } from "./helpers"
import { handler, type MessageContext, type MessageHandler } from "./registry"
import { handleJoin as handleJoinLogic, canStart, addAIPlayer as addAIPlayerLogic } from "./handlers/lobby"
import { handleSetTrump as handleSetTrumpLogic, handleCallThunee as handleCallThuneeLogic } from "./handlers/calling"
import { computeAIMove, getNextAIPlayer } from "./ai"
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
  checkGameOver as checkGameOverLogic,
  rotateDealerAndReset as rotateDealerAndResetLogic,
  evaluateKhanaak,
  applyKhanaakResult,
  processEndRound
} from "./handlers/round"
import { setupBiddingPhase } from "./handlers/dealing"

type AlarmType = 'bidding' | 'trick-display' | 'ai-turn'

// Delay before AI makes a move (ms) - makes game feel more natural
const AI_MOVE_DELAY_MS = 500

export default class ThuneeServer implements Party.Server {
  state: GameState
  connectionPlayerMap: Map<string, string> = new Map() // connectionId -> playerId
  pendingAlarmType: AlarmType | null = null

  /** Message handler registry - type-safe via handler() helper */
  private handlers = new Map<ClientMessage['type'], MessageHandler<ThuneeServer>>([
    handler('join', (ctx, msg) => {
      this.handleJoin(ctx.playerId, msg.name, msg.playerCount, ctx.conn, msg.existingPlayerId)
    }),
    handler('start', () => this.handleStart()),
    handler('add-ai', (ctx, msg) => this.handleAddAI(msg.team)),
    handler('bid', (ctx, msg) => this.handleBid(ctx.playerId, msg.amount)),
    handler('pass', (ctx) => this.handlePass(ctx.playerId)),
    handler('preselect-trump', (ctx, msg) => this.handlePreselectTrump(ctx.playerId, msg.suit)),
    handler('set-trump', (ctx, msg) => this.handleSetTrump(ctx.playerId, msg.suit, msg.lastCard)),
    handler('call-thunee', (ctx) => this.handleCallThunee(ctx.playerId)),
    handler('call-jodhi', (ctx, msg) => this.handleCallJodhi(ctx.playerId, msg.suit, msg.withJack)),
    handler('play-card', (ctx, msg) => this.handlePlayCard(ctx.playerId, msg.card)),
    handler('challenge-play', (ctx, msg) => this.handleChallengePlay(ctx.playerId, msg.accusedId)),
    handler('challenge-jodhi', (ctx, msg) => this.handleChallengeJodhi(ctx.playerId, msg.accusedId, msg.suit)),
    handler('call-khanaak', (ctx) => this.handleCallKhanaak(ctx.playerId)),
  ])

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

  getStateForPlayer(playerId: string): GameState {
    return filterStateForPlayer(this.state, playerId)
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

    // Dispatch to registered handler
    const handler = this.handlers.get(msg.type)
    if (handler) {
      handler({ server: this, playerId, conn: sender }, msg)
    }

    this.saveState()
    this.broadcastState()
    
    // Check if AI needs to act after this message
    this.maybeScheduleAITurn()
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
    } else if (alarmType === 'ai-turn') {
      this.executeAITurn()
    }
  }

  /**
   * Handle adding an AI player to the game.
   */
  handleAddAI(team?: 0 | 1) {
    if (this.state.phase !== 'waiting') return
    
    const player = addAIPlayerLogic(this.state, team)
    if (player) {
      this.saveState()
      this.broadcastState()
    }
  }

  /**
   * Check if an AI player needs to act and schedule their turn.
   */
  async maybeScheduleAITurn() {
    const aiPlayer = getNextAIPlayer(this.state)
    if (!aiPlayer) return
    
    // Don't schedule if we already have an AI turn pending
    if (this.pendingAlarmType === 'ai-turn') return
    
    // During bidding phase, execute AI decisions immediately (can't use alarm - would cancel bidding timer)
    if (this.state.phase === 'bidding') {
      this.executeAIBiddingTurn(aiPlayer)
      return
    }
    
    // Schedule AI move with a small delay for natural feel
    this.pendingAlarmType = 'ai-turn'
    await this.room.storage.setAlarm(Date.now() + AI_MOVE_DELAY_MS)
  }

  /**
   * Execute AI bidding decision immediately (no alarm delay).
   */
  executeAIBiddingTurn(aiPlayer: ReturnType<typeof getNextAIPlayer>) {
    if (!aiPlayer) return
    
    const decision = computeAIMove(this.state, aiPlayer.id)
    if (!decision || decision.type === 'skip') {
      // AI wants to let timer expire (e.g., to become default trumper)
      return
    }
    
    if (decision.type === 'bid') {
      this.handleBid(aiPlayer.id, decision.amount)
    } else if (decision.type === 'pass') {
      this.handlePass(aiPlayer.id)
    }
    
    this.saveState()
    this.broadcastState()
    
    // Check if another AI needs to bid
    const nextAI = getNextAIPlayer(this.state)
    if (nextAI && this.state.phase === 'bidding') {
      this.executeAIBiddingTurn(nextAI)
    }
  }

  /**
   * Execute the AI player's turn.
   */
  executeAITurn() {
    const aiPlayer = getNextAIPlayer(this.state)
    if (!aiPlayer) return
    
    const decision = computeAIMove(this.state, aiPlayer.id)
    if (!decision || decision.type === 'skip') {
      // AI doesn't need to act right now
      return
    }
    
    // Execute the AI's decision
    switch (decision.type) {
      case 'bid':
        this.handleBid(aiPlayer.id, decision.amount)
        break
      case 'pass':
        this.handlePass(aiPlayer.id)
        break
      case 'set-trump':
        this.handleSetTrump(aiPlayer.id, decision.suit, decision.lastCard)
        break
      case 'play-card':
        this.handlePlayCard(aiPlayer.id, decision.card)
        break
      case 'call-thunee':
        this.handleCallThunee(aiPlayer.id)
        break
      case 'call-jodhi':
        this.handleCallJodhi(aiPlayer.id, decision.suit, decision.withJack)
        break
    }
    
    this.saveState()
    this.broadcastState()
    
    // Check if another AI needs to act
    this.maybeScheduleAITurn()
  }

  onCallTimerExpired() {
    if (this.state.phase !== "bidding") return
    handleTimerExpiredLogic(this.state)
    this.saveState()
    this.broadcastState()
    
    // Check if AI needs to act (e.g., set trump after becoming trumper)
    this.maybeScheduleAITurn()
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
    
    // Check if AI needs to play next
    this.maybeScheduleAITurn()
  }

  endRound() {
    processEndRound(this.state)
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
