import type * as Party from "partykit/server"
import type {
  GameState,
  ClientMessage,
  ServerMessage,
  Card,
  Suit,
  Player,
  GameEvent,
  Trick
} from "../src/game/types"
import {
  createInitialState,
  createPlayer,
  createEmptyTrick,
  createEmptyBidState,
  serializeState,
  deserializeState
} from "../src/game/state"
import {
  createDeck,
  shuffleDeck,
  cardEquals
} from "../src/game/deck"
import {
  isValidPlay,
  getTrickWinner,
  getTrickPoints
} from "../src/game/rules"
import {
  getTeamForPlayer,
  getNextPlayerIndex
} from "../src/game/utils"

interface ConnectionState {
  playerId: string
}

const CALL_TIMER_MS = 10000 // 10 seconds
const TRICK_DISPLAY_MS = 2000 // 2 seconds to show completed trick

function getTrickEvents(eventLog: GameEvent[], roundNumber?: number): (Trick & { winnerId: string })[] {
  return eventLog
    .filter((e): e is Extract<GameEvent, { type: 'trick' }> => 
      e.type === 'trick' && (roundNumber === undefined || e.roundNumber === roundNumber)
    )
    .map(e => e.data)
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
    // Check if this is a reconnection by playerId first, then by name
    let existingPlayer = existingPlayerId
      ? this.state.players.find(p => p.id === existingPlayerId)
      : null

    // Fallback to name-based reconnection
    if (!existingPlayer) {
      existingPlayer = this.state.players.find(p => p.name === name)
    }

    if (existingPlayer) {
      existingPlayer.connected = true
      this.connectionPlayerMap.set(conn.id, existingPlayer.id)
      return
    }

    // Set player count if this is the first player
    if (this.state.players.length === 0 && playerCount) {
      this.state.playerCount = playerCount
    }

    // Check if game is full
    if (this.state.players.length >= this.state.playerCount) {
      // Add as spectator
      const spectator = createPlayer(playerId, name, 0)
      spectator.isSpectator = true
      this.state.spectators.push(spectator)
      return
    }

    const team = getTeamForPlayer(this.state.players.length)
    const player = createPlayer(playerId, name, team)
    this.state.players.push(player)

    if (this.state.players.length === 1) {
      this.state.dealerId = playerId
    }
  }

  handleStart() {
    if (this.state.players.length !== this.state.playerCount) return
    if (this.state.phase !== "waiting" && this.state.phase !== "round-end") return

    this.startDeal()
  }

  startDeal() {
    this.state.deck = shuffleDeck(createDeck())
    this.state.phase = "dealing-first"
    this.state.bidState = createEmptyBidState()
    this.state.trump = null
    this.state.trumpCallerId = null
    this.state.trumpRevealed = false
    this.state.thuneeCallerId = null
    this.state.jodhiCalls = []
    this.state.jodhiWindow = false
    this.state.lastTrickWinningTeam = null
    this.state.currentTrick = createEmptyTrick()
    this.state.tricksPlayed = 0
    // Don't reset eventLog - persist across rounds
    this.state.challengeResult = null
    this.state.lastBallAward = null

    // Reset hands
    for (const player of this.state.players) {
      player.hand = []
    }

    // Deal first 4 cards to each player
    if (this.state.playerCount === 4) {
      // 4-player: 4 cards each from first 16 cards
      for (let i = 0; i < 4; i++) {
        const start = i * 4
        this.state.players[i].hand = this.state.deck.slice(start, start + 4)
      }
    } else {
      // 2-player: 4 cards each from first 8 cards
      // Player 0: cards 0-3, Player 1: cards 4-7
      for (let i = 0; i < 2; i++) {
        const start = i * 4
        this.state.players[i].hand = this.state.deck.slice(start, start + 4)
      }
    }

    // Determine default trumper based on score
    // 1. Team that is ahead gets to trump
    // 2. If tied, team that won last round gets to trump
    // 3. Otherwise, RHO of dealer
    const team0Balls = this.state.teams[0].balls
    const team1Balls = this.state.teams[1].balls
    
    // Get last round winner from event log
    const lastRoundEnd = [...this.state.eventLog]
      .reverse()
      .find((e): e is Extract<typeof e, { type: 'round-end' }> => e.type === 'round-end')
    const lastRoundWinner = lastRoundEnd?.data.winningTeam ?? null
    
    let trumpingTeam: 0 | 1 | null = null
    if (team0Balls > team1Balls) {
      trumpingTeam = 0
    } else if (team1Balls > team0Balls) {
      trumpingTeam = 1
    } else if (lastRoundWinner !== null) {
      trumpingTeam = lastRoundWinner
    }
    
    if (trumpingTeam !== null) {
      // Find a player from the trumping team to be default trumper
      const trumpingPlayer = this.state.players.find(p => p.team === trumpingTeam)
      this.state.bidState.defaultTrumperId = trumpingPlayer?.id ?? this.state.players[0].id
    } else {
      // Fallback: RHO of dealer
      const dealerIndex = this.state.players.findIndex(p => p.id === this.state.dealerId)
      const rhoIndex = (dealerIndex + this.state.playerCount - 1) % this.state.playerCount
      this.state.bidState.defaultTrumperId = this.state.players[rhoIndex].id
    }

    // Move to calling phase with timer
    // Others have 10s to call, otherwise default trumper's selection is used
    this.state.phase = "bidding"
    this.state.currentPlayerId = null // Anyone can call
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

    this.state.bidState.timerEndsAt = null

    const noCalls = this.state.bidState.currentBid === 0

    if (noCalls) {
      // No one called - default trumper sets trump
      this.state.trumpCallerId = this.state.bidState.defaultTrumperId
      this.state.bidState.bidderId = null

      // If trumper pre-selected, use that trump directly
      if (this.state.bidState.preSelectedTrump) {
        this.state.trump = this.state.bidState.preSelectedTrump
        this.endBidding()
        // Skip calling phase, go straight to playing
        const trumperIndex = this.state.players.findIndex(p => p.id === this.state.trumpCallerId)
        const leaderIndex = (trumperIndex + this.state.playerCount - 1) % this.state.playerCount
        this.state.currentPlayerId = this.state.players[leaderIndex].id
        this.state.phase = "playing"
      } else {
        // Trumper didn't preselect - go to calling phase for them to choose
        this.endBidding()
      }
    } else {
      // Someone called and timer expired - highest bidder wins
      this.state.trumpCallerId = this.state.bidState.bidderId
      this.endBidding()
    }

    this.saveState()
    this.broadcastState()
  }

  handleBid(playerId: string, amount: number) {
    if (this.state.phase !== "bidding") return

    // Check if player has passed
    if (this.state.bidState.passed.has(playerId)) return

    // Validate bid amount
    if (amount <= this.state.bidState.currentBid) return
    if (amount > 104) return
    if (amount % 10 !== 0 && amount !== 104) return

    this.state.bidState.currentBid = amount
    this.state.bidState.bidderId = playerId

    // Clear any pre-selected trump - bidding war invalidates it
    this.state.bidState.preSelectedTrump = null

    // Start/reset timer for others to counter-call
    this.startCallTimer()
  }

  async handlePass(playerId: string) {
    if (this.state.phase !== "bidding") return
    // Only relevant if timer is running (someone called)
    if (!this.state.bidState.timerEndsAt) return

    // Can't pass twice
    if (this.state.bidState.passed.has(playerId)) return

    this.state.bidState.passed.add(playerId)

    // Check if all OTHER players have passed (bidder doesn't need to pass)
    const otherPlayers = this.state.players.filter(p => p.id !== this.state.bidState.bidderId)
    const allOthersPassed = otherPlayers.every(p => this.state.bidState.passed.has(p.id))
    if (allOthersPassed) {
      // End immediately - delete the alarm
      await this.room.storage.deleteAlarm()
      this.onCallTimerExpired()
    }
  }

  handlePreselectTrump(playerId: string, suit: Suit) {
    if (this.state.phase !== "bidding") return
    
    const someoneHasCalled = this.state.bidState.currentBid > 0
    
    if (someoneHasCalled) {
      // Only current bidder can preselect after a call
      if (playerId !== this.state.bidState.bidderId) return
    } else {
      // Only default trumper can preselect before any calls
      if (playerId !== this.state.bidState.defaultTrumperId) return
    }

    this.state.bidState.preSelectedTrump = suit
  }

  endBidding() {
    // Deal remaining 2 cards to complete hand of 6
    if (this.state.playerCount === 4) {
      // 4-player: cards 16-23 (2 per player)
      const startIndex = 16
      for (let i = 0; i < 4; i++) {
        const card1 = this.state.deck[startIndex + i * 2]
        const card2 = this.state.deck[startIndex + i * 2 + 1]
        if (card1) this.state.players[i].hand.push(card1)
        if (card2) this.state.players[i].hand.push(card2)
      }
    } else {
      // 2-player: cards 8-11 (2 per player)
      // Player 0: cards 8, 9; Player 1: cards 10, 11
      for (let i = 0; i < 2; i++) {
        const card1 = this.state.deck[8 + i * 2]
        const card2 = this.state.deck[8 + i * 2 + 1]
        if (card1) this.state.players[i].hand.push(card1)
        if (card2) this.state.players[i].hand.push(card2)
      }
    }

    if (this.state.bidState.bidderId) {
      // Winner of bid sets trump
      this.state.trumpCallerId = this.state.bidState.bidderId
      this.state.currentPlayerId = this.state.bidState.bidderId
    } else {
      // No one bid - dealer's RHO sets trump
      const dealerIndex = this.state.players.findIndex(p => p.id === this.state.dealerId)
      const rhoIndex = (dealerIndex + this.state.playerCount - 1) % this.state.playerCount
      this.state.trumpCallerId = this.state.players[rhoIndex].id
      this.state.currentPlayerId = this.state.players[rhoIndex].id
    }

    this.state.phase = "calling"
  }

  handleSetTrump(playerId: string, suit: Suit, lastCard?: boolean) {
    if (this.state.phase !== "calling") return
    if (this.state.trumpCallerId !== playerId) return

    this.state.trump = suit
    this.state.isLastCardTrump = lastCard ?? false

    // Player after trumper (in play order) leads first trick
    const trumperIndex = this.state.players.findIndex(p => p.id === playerId)
    const leaderIndex = (trumperIndex + 1) % this.state.playerCount
    this.state.currentPlayerId = this.state.players[leaderIndex].id
    this.state.phase = "playing"
  }

  handleCallThunee(playerId: string) {
    if (this.state.phase !== "calling") return
    if (this.state.trumpCallerId !== playerId) return

    this.state.thuneeCallerId = playerId
    this.state.trump = null // No trump in Thunee

    // Player after thunee caller (in play order) leads first trick
    const callerIndex = this.state.players.findIndex(p => p.id === playerId)
    const leaderIndex = (callerIndex + 1) % this.state.playerCount
    this.state.currentPlayerId = this.state.players[leaderIndex].id
    this.state.phase = "playing"
  }

  handleCallJodhi(playerId: string, suit: Suit, withJack: boolean) {
    if (this.state.phase !== "playing" && this.state.phase !== "trick-complete") return
    if (!this.state.jodhiWindow) return

    // Caller must be on the winning team
    const caller = this.state.players.find(p => p.id === playerId)
    if (!caller) return
    if (caller.team !== this.state.lastTrickWinningTeam) return

    // Check if already called Jodhi for this suit by this player
    const alreadyCalled = this.state.jodhiCalls.some(j =>
      j.playerId === playerId && j.suit === suit
    )
    if (alreadyCalled) return

    // Calculate points based on claim (not validation - that happens on challenge)
    const isTrump = suit === this.state.trump
    const points = withJack 
      ? (isTrump ? 50 : 30) 
      : (isTrump ? 40 : 20)

    this.state.jodhiCalls.push({
      playerId,
      points,
      suit,
      hasJack: withJack  // This is what they CLAIMED, not validated
    })

    // Log the jodhi call
    this.state.eventLog.push({
      type: 'jodhi-call',
      data: { playerId, suit, points, hasJack: withJack },
      roundNumber: this.state.gameRound,
      timestamp: Date.now()
    })
  }

  handlePlayCard(playerId: string, card: Card) {
    if (this.state.phase !== "playing") return
    if (this.state.currentPlayerId !== playerId) return

    // Close jodhi window and clear last trick result when a card is played
    this.state.jodhiWindow = false
    this.state.lastTrickResult = null

    const player = this.state.players.find(p => p.id === playerId)
    if (!player) return

    const cardIndex = player.hand.findIndex(c => cardEquals(c, card))
    if (cardIndex === -1) return

    // Remove card from hand
    player.hand.splice(cardIndex, 1)

    // Add to trick
    if (this.state.currentTrick.cards.length === 0) {
      this.state.currentTrick.leadSuit = card.suit
      // Reveal trump when first card of first trick is played
      if (this.state.tricksPlayed === 0 && !this.state.trumpRevealed) {
        this.state.trumpRevealed = true
      }
    }
    this.state.currentTrick.cards.push({ playerId, card })

    // Check if trick is complete (use actual player count, not configured playerCount)
    if (this.state.currentTrick.cards.length === this.state.players.length) {
      this.completeTrick()
    } else {
      // Next player
      const currentIndex = this.state.players.findIndex(p => p.id === playerId)
      const nextIndex = getNextPlayerIndex(currentIndex, this.state.playerCount)
      this.state.currentPlayerId = this.state.players[nextIndex].id
    }
  }

  completeTrick() {
    const winnerId = getTrickWinner(this.state.currentTrick, this.state.trump)
    this.state.currentTrick.winnerId = winnerId

    // Add points to winning team
    const winner = this.state.players.find(p => p.id === winnerId)!
    const points = getTrickPoints(this.state.currentTrick)
    this.state.teams[winner.team].cardPoints += points

    // Find winning card and determine reason
    const winningPlay = this.state.currentTrick.cards.find(c => c.playerId === winnerId)!
    const wonByTrump = this.state.trump && winningPlay.card.suit === this.state.trump

    // Store trick result for UI display
    this.state.lastTrickResult = {
      winnerId,
      winnerName: winner.name,
      winningCard: winningPlay.card,
      points,
      reason: wonByTrump ? 'trump' : 'highest'
    }

    // Save trick to event log
    this.state.eventLog.push({
      type: 'trick',
      data: { ...this.state.currentTrick, winnerId },
      roundNumber: this.state.gameRound,
      timestamp: Date.now()
    })

    this.state.tricksPlayed++

    // Open jodhi window for winning team
    this.state.jodhiWindow = true
    this.state.lastTrickWinningTeam = winner.team

    // Enter trick-complete phase to show the winner briefly
    this.state.phase = "trick-complete"
    this.startTrickDisplayTimer()
  }

  onTrickDisplayComplete() {
    // Check if round is over (6 tricks for 4 players, 6 per round for 2 players)
    if (this.state.tricksPlayed === 6) {
      this.endRound()
    } else {
      // Winner leads next trick
      const winnerId = this.state.currentTrick.winnerId!
      this.state.currentTrick = createEmptyTrick()
      this.state.currentPlayerId = winnerId
      this.state.phase = "playing"
    }

    this.saveState()
    this.broadcastState()
  }

  endRound() {
    const trickEvents = getTrickEvents(this.state.eventLog)

    // Award 10 points for last trick
    const lastTrick = trickEvents[trickEvents.length - 1]
    if (lastTrick?.winnerId) {
      const lastWinner = this.state.players.find(p => p.id === lastTrick.winnerId)
      if (lastWinner) {
        this.state.teams[lastWinner.team].cardPoints += 10
      }
    }

    // 2-player mode: check for Thunee in Round 1 (resolves immediately)
    if (this.state.playerCount === 2 && this.state.dealRound === 1 && this.state.thuneeCallerId) {
      const thuneePlayer = this.state.players.find(p => p.id === this.state.thuneeCallerId)!
      const thuneeTeam = thuneePlayer.team

      const wonAllTricks = trickEvents.every(t => {
        const winner = this.state.players.find(p => p.id === t.winnerId)
        return winner?.team === thuneeTeam
      })

      if (wonAllTricks) {
        this.state.teams[thuneeTeam].balls += 4
        this.state.lastBallAward = { team: thuneeTeam, amount: 4, reason: 'thunee' }
        this.logRoundEnd(thuneeTeam, 4, 'thunee')
      } else {
        const otherTeam = thuneeTeam === 0 ? 1 : 0
        this.state.teams[otherTeam].balls += 4
        this.state.lastBallAward = { team: otherTeam, amount: 4, reason: 'thunee' }
        this.logRoundEnd(otherTeam, 4, 'thunee')
      }

      if (this.checkGameOver()) return
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
      return
    }

    // 2-player mode: after Round 1 (no Thunee), go to Round 2 without awarding balls
    if (this.state.playerCount === 2 && this.state.dealRound === 1) {
      this.state.dealRound = 2
      this.startSecondRound()
      return
    }

    // Award balls (after Round 2 in 2-player, or after 6 tricks in 4-player)
    const trumpTeam = this.state.players.find(p => p.id === this.state.trumpCallerId)?.team ?? 0
    const countingTeam = trumpTeam === 0 ? 1 : 0

    // Calculate Jodhi points by team
    let trumpTeamJodhi = 0
    let countingTeamJodhi = 0

    for (const jodhi of this.state.jodhiCalls) {
      const jodhiPlayer = this.state.players.find(p => p.id === jodhi.playerId)
      if (jodhiPlayer?.team === trumpTeam) {
        trumpTeamJodhi += jodhi.points
      } else {
        countingTeamJodhi += jodhi.points
      }
    }

    // Adjusted target and score with Jodhi
    const target = 105 - this.state.bidState.currentBid + trumpTeamJodhi
    const countingScore = this.state.teams[countingTeam].cardPoints + countingTeamJodhi

    if (this.state.thuneeCallerId) {
      // Thunee in 4-player mode or Round 2 of 2-player
      const thuneePlayer = this.state.players.find(p => p.id === this.state.thuneeCallerId)!
      const thuneeTeam = thuneePlayer.team

      // For 2-player Round 2, check all 12 tricks
      const wonAllTricks = trickEvents.every(t => {
        const winner = this.state.players.find(p => p.id === t.winnerId)
        return winner?.team === thuneeTeam
      })

      if (wonAllTricks) {
        this.state.teams[thuneeTeam].balls += 4
        this.state.lastBallAward = { team: thuneeTeam, amount: 4, reason: 'thunee' }
        this.logRoundEnd(thuneeTeam, 4, 'thunee')
      } else {
        const otherTeam = thuneeTeam === 0 ? 1 : 0
        this.state.teams[otherTeam].balls += 4
        this.state.lastBallAward = { team: otherTeam, amount: 4, reason: 'thunee' }
        this.logRoundEnd(otherTeam, 4, 'thunee')
      }
    } else {
      // Normal scoring
      // "Call and lost": if trump team called (bid > 0) and loses, counting team gets 2 balls
      const trumpTeamCalled = this.state.bidState.currentBid > 0
      
      if (countingScore >= target) {
        const ballsWon = trumpTeamCalled ? 2 : 1
        this.state.teams[countingTeam].balls += ballsWon
        this.state.lastBallAward = { team: countingTeam, amount: ballsWon, reason: 'normal' }
        this.logRoundEnd(countingTeam, ballsWon, 'normal')
      } else {
        this.state.teams[trumpTeam].balls += 1
        this.state.lastBallAward = { team: trumpTeam, amount: 1, reason: 'normal' }
        this.logRoundEnd(trumpTeam, 1, 'normal')
      }
    }

    if (this.checkGameOver()) return
    this.state.phase = "round-end"
    this.rotateDealerAndReset()
  }

  checkGameOver(): boolean {
    const winThreshold = this.state.isKhanaakGame ? 13 : 12
    if (this.state.teams[0].balls >= winThreshold || this.state.teams[1].balls >= winThreshold) {
      this.state.phase = "game-over"
      return true
    }
    return false
  }

  logRoundEnd(winningTeam: 0 | 1, ballsAwarded: number, reason: 'normal' | 'thunee' | 'challenge' | 'khanaak') {
    this.state.eventLog.push({
      type: 'round-end',
      data: { winningTeam, ballsAwarded, reason },
      roundNumber: this.state.gameRound,
      timestamp: Date.now()
    })
  }

  startSecondRound() {
    // Deal remaining 12 cards (6 to each player)
    // Player 0 gets cards 12-17, Player 1 gets cards 18-23
    for (let i = 0; i < 2; i++) {
      this.state.players[i].hand = []
      for (let j = 0; j < 6; j++) {
        this.state.players[i].hand.push(this.state.deck[12 + i * 6 + j])
      }
    }

    // Skip directly to playing - trump and bid carry over
    this.state.phase = "playing"
    this.state.currentTrick = createEmptyTrick()
    this.state.tricksPlayed = 0
    // Don't reset eventLog - need full history for cumulative scoring

    // Winner of last trick from Round 1 leads
    const trickEvents = getTrickEvents(this.state.eventLog)
    const lastTrick = trickEvents[trickEvents.length - 1]
    if (lastTrick?.winnerId) {
      this.state.currentPlayerId = lastTrick.winnerId
    } else {
      const dealerIndex = this.state.players.findIndex(p => p.id === this.state.dealerId)
      this.state.currentPlayerId = this.state.players[(dealerIndex + 1) % 2].id
    }
  }

  rotateDealerAndReset() {
    const dealerIndex = this.state.players.findIndex(p => p.id === this.state.dealerId)
    const nextDealerIndex = getNextPlayerIndex(dealerIndex, this.state.playerCount)
    this.state.dealerId = this.state.players[nextDealerIndex].id

    // Reset for next deal (but keep phase as round-end so players can see summary)
    this.state.teams[0].cardPoints = 0
    this.state.teams[1].cardPoints = 0
    this.state.dealRound = 1
    this.state.gameRound++  // Increment overall round counter
    // Phase stays as "round-end" - handleStart will set it to dealing
  }

  // Get all cards a player has played this round (from event log + current trick)
  getPlayerCardsPlayed(playerId: string): Card[] {
    const trickEvents = getTrickEvents(this.state.eventLog, this.state.gameRound)
    const cardsPlayed: Card[] = []
    
    // Cards from completed tricks this round
    for (const trick of trickEvents) {
      const play = trick.cards.find(c => c.playerId === playerId)
      if (play) cardsPlayed.push(play.card)
    }
    
    // Cards from current trick
    const currentPlay = this.state.currentTrick.cards.find(c => c.playerId === playerId)
    if (currentPlay) cardsPlayed.push(currentPlay.card)
    
    return cardsPlayed
  }

  // Reconstruct a player's hand at a specific point in time
  // Returns: current hand + all cards played after the specified trick/card
  reconstructHandAtPlay(playerId: string, trickIndex: number, cardIndexInTrick: number): Card[] {
    const accused = this.state.players.find(p => p.id === playerId)
    if (!accused) return []
    
    const trickEvents = getTrickEvents(this.state.eventLog, this.state.gameRound)
    const hand = [...accused.hand]
    
    // Add back cards played after the challenged play
    // First, cards from tricks after the challenged trick
    for (let i = trickIndex + 1; i < trickEvents.length; i++) {
      const play = trickEvents[i].cards.find(c => c.playerId === playerId)
      if (play) hand.push(play.card)
    }
    
    // Add back cards from current trick (if it's after the challenged trick)
    if (trickIndex < trickEvents.length) {
      const currentPlay = this.state.currentTrick.cards.find(c => c.playerId === playerId)
      if (currentPlay) hand.push(currentPlay.card)
    } else {
      // Challenged play is in current trick - add back cards played after it
      for (let i = cardIndexInTrick + 1; i < this.state.currentTrick.cards.length; i++) {
        if (this.state.currentTrick.cards[i].playerId === playerId) {
          hand.push(this.state.currentTrick.cards[i].card)
        }
      }
    }
    
    // Add the challenged card itself
    const challengedTrick = trickIndex < trickEvents.length 
      ? trickEvents[trickIndex] 
      : this.state.currentTrick
    const challengedPlay = challengedTrick.cards.find(c => c.playerId === playerId)
    if (challengedPlay) hand.push(challengedPlay.card)
    
    return hand
  }

  handleChallengePlay(challengerId: string, accusedId: string) {
    if (this.state.phase !== "playing" && this.state.phase !== "trick-complete") return

    const challenger = this.state.players.find(p => p.id === challengerId)
    const accused = this.state.players.find(p => p.id === accusedId)

    if (!challenger || !accused) return
    if (challenger.team === accused.team) return // Can't challenge teammate

    // Check ALL cards played by the accused this round for any invalid play
    const trickEvents = getTrickEvents(this.state.eventLog, this.state.gameRound)
    let foundInvalidPlay = false
    let invalidCard: Card | null = null

    // Build list of all tricks to check (completed + current)
    const allTricks: { trick: Trick; trickIndex: number }[] = [
      ...trickEvents.map((t, i) => ({ trick: t, trickIndex: i })),
    ]
    
    // Add current trick if it has cards
    if (this.state.currentTrick.cards.length > 0) {
      allTricks.push({ trick: this.state.currentTrick, trickIndex: trickEvents.length })
    }

    // Check each trick for invalid plays by the accused
    for (const { trick, trickIndex } of allTricks) {
      const accusedPlayIndex = trick.cards.findIndex(c => c.playerId === accusedId)
      if (accusedPlayIndex === -1) continue

      const accusedPlay = trick.cards[accusedPlayIndex]
      const card = accusedPlay.card

      // Reconstruct the hand at the time of this play
      const handBefore = this.reconstructHandAtPlay(accusedId, trickIndex, accusedPlayIndex)

      // Build trick state before the challenged card was played
      const cardsBeforePlay = trick.cards.slice(0, accusedPlayIndex)

      const trickBefore: Trick = {
        cards: cardsBeforePlay,
        leadSuit: cardsBeforePlay.length > 0 ? trick.leadSuit : null,
        winnerId: null
      }

      const validation = isValidPlay(card, handBefore, trickBefore, this.state.trump)

      if (!validation.valid) {
        foundInvalidPlay = true
        invalidCard = card
        break // Found an invalid play, challenge succeeds
      }
    }

    // If no plays found at all, can't challenge
    if (allTricks.every(({ trick }) => !trick.cards.some(c => c.playerId === accusedId))) {
      return
    }

    // Determine winning team: if all plays were valid, accused's team wins (bad challenge)
    // If any play was invalid, challenger's team wins (caught cheating)
    const allPlaysValid = !foundInvalidPlay
    const winningTeam = allPlaysValid ? accused.team : challenger.team
    
    // Use the invalid card if found, otherwise use the most recent card played
    const cardToShow = invalidCard ?? this.getMostRecentPlay(accusedId, trickEvents)

    this.resolveChallengeResult(challengerId, accusedId, 'play', winningTeam, allPlaysValid, cardToShow ?? undefined)
  }

  getMostRecentPlay(playerId: string, trickEvents: (Trick & { winnerId: string })[]): Card | null {
    // Check current trick first
    const currentPlay = this.state.currentTrick.cards.find(c => c.playerId === playerId)
    if (currentPlay) return currentPlay.card
    
    // Check completed tricks in reverse order
    for (let i = trickEvents.length - 1; i >= 0; i--) {
      const play = trickEvents[i].cards.find(c => c.playerId === playerId)
      if (play) return play.card
    }
    return null
  }

  handleChallengeJodhi(challengerId: string, accusedId: string, suit: Suit) {
    if (this.state.phase !== "playing" && this.state.phase !== "trick-complete") return

    const challenger = this.state.players.find(p => p.id === challengerId)
    const accused = this.state.players.find(p => p.id === accusedId)

    if (!challenger || !accused) return
    if (challenger.team === accused.team) return // Can't challenge teammate

    // Find the jodhi claim
    const jodhiClaim = this.state.jodhiCalls.find(j => j.playerId === accusedId && j.suit === suit)
    if (!jodhiClaim) return // No such claim

    // Validate: check if Q+K (and J if claimed) exist in current hand + all cards played this round
    const allCards = [...accused.hand, ...this.getPlayerCardsPlayed(accusedId)]
    const hasQ = allCards.some(c => c.suit === suit && c.rank === 'Q')
    const hasK = allCards.some(c => c.suit === suit && c.rank === 'K')
    const hasJ = allCards.some(c => c.suit === suit && c.rank === 'J')
    
    // Valid if they have Q+K, AND if they claimed J they must have J
    const isValid = hasQ && hasK && (!jodhiClaim.hasJack || hasJ)

    // Determine winning team
    const winningTeam = isValid ? accused.team : challenger.team

    // If jodhi was false, remove it from calls
    if (!isValid) {
      this.state.jodhiCalls = this.state.jodhiCalls.filter(
        j => !(j.playerId === accusedId && j.suit === suit)
      )
    }

    this.resolveChallengeResult(challengerId, accusedId, 'jodhi', winningTeam, isValid, undefined, suit)
  }

  resolveChallengeResult(
    challengerId: string, 
    accusedId: string, 
    challengeType: 'play' | 'jodhi',
    winningTeam: 0 | 1,
    wasValid: boolean,
    card?: Card,
    suit?: Suit
  ) {
    // Store challenge result for UI
    this.state.challengeResult = {
      challengerId,
      accusedId,
      challengeType,
      card,
      suit,
      wasValid,
      winningTeam
    }

    // Add to event log
    this.state.eventLog.push({
      type: 'challenge',
      data: {
        challengerId,
        accusedId,
        card: card ?? { suit: suit!, rank: 'Q' }, // Placeholder for jodhi
        wasValid,
        winningTeam
      },
      roundNumber: this.state.gameRound,
      timestamp: Date.now()
    })

    // Award 4 balls to winning team
    this.state.teams[winningTeam].balls += 4
    this.logRoundEnd(winningTeam, 4, 'challenge')

    // Check for game over
    if (!this.checkGameOver()) {
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
    }
  }

  handleCallKhanaak(playerId: string) {
    // Khanaak can only be called on the last trick (trick-complete phase after 6th trick)
    if (this.state.phase !== "trick-complete") return
    if (this.state.tricksPlayed !== 6) return

    const caller = this.state.players.find(p => p.id === playerId)
    if (!caller) return

    // Must be the player (or team) winning the last trick
    const lastTrickWinnerId = this.state.currentTrick.winnerId
    const lastTrickWinner = this.state.players.find(p => p.id === lastTrickWinnerId)
    if (!lastTrickWinner || caller.team !== lastTrickWinner.team) return

    // Caller's team must have a Jodhi
    const callerTeamJodhi = this.state.jodhiCalls
      .filter(j => {
        const jodhiPlayer = this.state.players.find(p => p.id === j.playerId)
        return jodhiPlayer?.team === caller.team
      })
      .reduce((sum, j) => sum + j.points, 0)

    if (callerTeamJodhi === 0) return // Can't call Khanaak without a Jodhi

    // Calculate opponent's points (already includes +10 for last trick in endRound)
    const trumpTeam = this.state.players.find(p => p.id === this.state.trumpCallerId)?.team ?? 0
    const isBackward = caller.team !== trumpTeam

    // Opponent team's card points (before last trick bonus is applied in endRound)
    const opponentTeam = caller.team === 0 ? 1 : 0
    const opponentPoints = this.state.teams[opponentTeam].cardPoints

    // Khanaak succeeds if opponent's card points < caller's Jodhi + 10 (last trick bonus)
    // Note: bids and opponent jodhis are not counted in Khanaak
    const khanaakThreshold = callerTeamJodhi + 10
    const success = opponentPoints < khanaakThreshold

    // Log the khanaak call
    this.state.eventLog.push({
      type: 'khanaak-call',
      data: {
        playerId,
        success,
        jodhiTotal: callerTeamJodhi,
        opponentPoints,
        isBackward
      },
      roundNumber: this.state.gameRound,
      timestamp: Date.now()
    })

    if (success) {
      // Award balls based on backward or forward khanaak
      const ballsWon = isBackward ? 6 : 3
      this.state.teams[caller.team].balls += ballsWon
      this.state.lastBallAward = { team: caller.team, amount: ballsWon, reason: 'normal' }
      this.logRoundEnd(caller.team, ballsWon, 'khanaak')
      // Khanaak makes the game 13 balls to win
      this.state.isKhanaakGame = true
    } else {
      // Failed khanaak: opponent gets 4 balls
      this.state.teams[opponentTeam].balls += 4
      this.state.lastBallAward = { team: opponentTeam, amount: 4, reason: 'normal' }
      this.logRoundEnd(opponentTeam, 4, 'khanaak')
    }

    // End the round (skip normal scoring since khanaak resolved it)
    if (!this.checkGameOver()) {
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
    }
  }
}
