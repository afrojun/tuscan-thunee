import type * as Party from "partykit/server"
import type { 
  GameState, 
  ClientMessage, 
  ServerMessage, 
  Card, 
  Suit,
  Player 
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

export default class ThuneeServer implements Party.Server {
  state: GameState
  connectionPlayerMap: Map<string, string> = new Map() // connectionId -> playerId

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

  broadcastState() {
    this.broadcast({ type: "state", state: this.state, playerId: "" })
  }

  onConnect(conn: Party.Connection) {
    // Generate a temporary player ID - will be replaced on join if reconnecting
    const playerId = crypto.randomUUID()
    this.connectionPlayerMap.set(conn.id, playerId)
    
    // Send current state immediately
    conn.send(JSON.stringify({ 
      type: "state", 
      state: this.state, 
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
    const msg = JSON.parse(message) as ClientMessage
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
        this.handleCallJodhi(playerId, msg.suit)
        break
      case "play-card":
        this.handlePlayCard(playerId, msg.card)
        break
      case "challenge":
        this.handleChallenge(playerId)
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
    this.state.thuneeCallerId = null
    this.state.jodhiCalls = []
    this.state.jodhiWindow = false
    this.state.lastTrickWinningTeam = null
    this.state.currentTrick = createEmptyTrick()
    this.state.tricksPlayed = 0
    this.state.trickHistory = []
    this.state.challengeResult = null

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

    // Set default trumper (RHO of dealer)
    const dealerIndex = this.state.players.findIndex(p => p.id === this.state.dealerId)
    const rhoIndex = (dealerIndex + this.state.playerCount - 1) % this.state.playerCount
    this.state.bidState.defaultTrumperId = this.state.players[rhoIndex].id
    
    // Move to calling phase with timer
    // Others have 10s to call, otherwise default trumper's selection is used
    this.state.phase = "bidding"
    this.state.currentPlayerId = null // Anyone can call
    this.startCallTimer()
  }

  async startCallTimer() {
    // Set timer end time
    this.state.bidState.timerEndsAt = Date.now() + CALL_TIMER_MS

    // Use PartyKit's alarm API for reliable server-side timer
    await this.room.storage.setAlarm(Date.now() + CALL_TIMER_MS)

    await this.saveState()
    this.broadcastState()
  }

  // PartyKit alarm handler - called when alarm fires
  async onAlarm() {
    if (this.state.phase === "bidding") {
      this.onCallTimerExpired()
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
    // Only default trumper can preselect
    if (playerId !== this.state.bidState.defaultTrumperId) return
    // Can't preselect if someone has already called
    if (this.state.bidState.currentBid > 0) return
    
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
    
    // Person to the right of trumper leads first trick
    const trumperIndex = this.state.players.findIndex(p => p.id === playerId)
    const leaderIndex = (trumperIndex + this.state.playerCount - 1) % this.state.playerCount
    this.state.currentPlayerId = this.state.players[leaderIndex].id
    this.state.phase = "playing"
  }

  handleCallThunee(playerId: string) {
    if (this.state.phase !== "calling") return
    if (this.state.trumpCallerId !== playerId) return

    this.state.thuneeCallerId = playerId
    this.state.trump = null // No trump in Thunee
    
    // Person to the right of thunee caller leads first trick
    const callerIndex = this.state.players.findIndex(p => p.id === playerId)
    const leaderIndex = (callerIndex + this.state.playerCount - 1) % this.state.playerCount
    this.state.currentPlayerId = this.state.players[leaderIndex].id
    this.state.phase = "playing"
  }

  handleCallJodhi(playerId: string, suit: Suit) {
    if (this.state.phase !== "playing") return
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
    
    // Check if player has Q+K in the suit (honor system, but validate they have cards)
    const hasQ = caller.hand.some(c => c.suit === suit && c.rank === 'Q')
    const hasK = caller.hand.some(c => c.suit === suit && c.rank === 'K')
    const hasJ = caller.hand.some(c => c.suit === suit && c.rank === 'J')
    
    // Must have at least Q+K (honor system - we trust the player)
    if (!hasQ || !hasK) return
    
    // Calculate points
    const isTrump = suit === this.state.trump
    let points: number
    if (hasJ) {
      points = isTrump ? 50 : 30
    } else {
      points = isTrump ? 40 : 20
    }
    
    this.state.jodhiCalls.push({
      playerId,
      points,
      suit,
      hasJack: hasJ
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
    }
    this.state.currentTrick.cards.push({ playerId, card })

    // Track for challenge system
    this.state.lastPlayedCard = { playerId, card }
    this.state.challengeWindow = true

    // Check if trick is complete
    if (this.state.currentTrick.cards.length === this.state.playerCount) {
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

    // Save trick to history
    this.state.trickHistory.push({ ...this.state.currentTrick })

    this.state.tricksPlayed++
    this.state.challengeWindow = false
    
    // Open jodhi window for winning team
    this.state.jodhiWindow = true
    this.state.lastTrickWinningTeam = winner.team

    // Check if round is over (6 tricks for 4 players, 6 per round for 2 players)
    if (this.state.tricksPlayed === 6) {
      this.endRound()
    } else {
      // Winner leads next trick
      this.state.currentTrick = createEmptyTrick()
      this.state.currentPlayerId = winnerId
    }
  }

  endRound() {
    // Award 10 points for last trick
    const lastTrick = this.state.trickHistory[this.state.trickHistory.length - 1]
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
      
      const wonAllTricks = this.state.trickHistory.every(t => {
        const winner = this.state.players.find(p => p.id === t.winnerId)
        return winner?.team === thuneeTeam
      })

      if (wonAllTricks) {
        this.state.teams[thuneeTeam].balls += 4
      } else {
        const otherTeam = thuneeTeam === 0 ? 1 : 0
        this.state.teams[otherTeam].balls += 4
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
      const wonAllTricks = this.state.trickHistory.every(t => {
        const winner = this.state.players.find(p => p.id === t.winnerId)
        return winner?.team === thuneeTeam
      })

      if (wonAllTricks) {
        this.state.teams[thuneeTeam].balls += 4
      } else {
        const otherTeam = thuneeTeam === 0 ? 1 : 0
        this.state.teams[otherTeam].balls += 4
      }
    } else {
      // Normal scoring
      if (countingScore >= target) {
        this.state.teams[countingTeam].balls += 1
      } else {
        this.state.teams[trumpTeam].balls += 1
      }
    }

    if (this.checkGameOver()) return
    this.state.phase = "round-end"
    this.rotateDealerAndReset()
  }

  checkGameOver(): boolean {
    if (this.state.teams[0].balls >= 13 || this.state.teams[1].balls >= 13) {
      this.state.phase = "game-over"
      return true
    }
    return false
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
    // Don't reset trickHistory - need full history for cumulative scoring
    
    // Winner of last trick from Round 1 leads
    const lastTrick = this.state.trickHistory[this.state.trickHistory.length - 1]
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
    
    // Reset for next deal
    this.state.teams[0].cardPoints = 0
    this.state.teams[1].cardPoints = 0
    this.state.dealRound = 1
    this.state.phase = "waiting"
  }

  handleChallenge(challengerId: string) {
    if (!this.state.challengeWindow) return
    if (!this.state.lastPlayedCard) return

    const challenger = this.state.players.find(p => p.id === challengerId)
    const accused = this.state.players.find(p => p.id === this.state.lastPlayedCard!.playerId)
    
    if (!challenger || !accused) return
    if (challenger.team === accused.team) return // Can't challenge teammate

    const card = this.state.lastPlayedCard.card
    
    // Reconstruct the hand before the play
    const handBefore = [...accused.hand, card]
    
    // Build trick state before the challenged card was played
    const cardsBeforePlay = this.state.currentTrick.cards.filter(c => c.playerId !== accused.id)
    
    // Check if accused led the trick (was first to play)
    const accusedLedTrick = this.state.currentTrick.cards.length > 0 && 
                            this.state.currentTrick.cards[0].playerId === accused.id
    
    const trickBefore: Trick = {
      cards: cardsBeforePlay,
      // If accused led, leadSuit should be null (they can play anything)
      // Otherwise, preserve the original lead suit
      leadSuit: accusedLedTrick ? null : this.state.currentTrick.leadSuit,
      winnerId: null
    }

    const validation = isValidPlay(card, handBefore, trickBefore, this.state.trump)

    // Determine winning team: if play was valid, accused's team wins (bad challenge)
    // If play was invalid, challenger's team wins (caught cheating)
    const winningTeam = validation.valid ? accused.team : challenger.team

    // Store challenge result for UI
    this.state.challengeResult = {
      challengerId,
      accusedId: accused.id,
      card,
      wasValid: validation.valid,
      winningTeam
    }

    // Award 4 balls to winning team
    this.state.teams[winningTeam].balls += 4

    // End round immediately
    this.state.challengeWindow = false
    
    // Check for game over
    if (this.state.teams[0].balls >= 13 || this.state.teams[1].balls >= 13) {
      this.state.phase = "game-over"
    } else {
      this.state.phase = "round-end"
    }
  }
}
