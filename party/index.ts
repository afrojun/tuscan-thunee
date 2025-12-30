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

export default class ThuneeServer implements Party.Server {
  state: GameState
  deck: Card[] = []
  connectionPlayerMap: Map<string, string> = new Map() // connectionId -> playerId

  constructor(readonly room: Party.Room) {
    this.state = createInitialState(room.id, 4)
  }

  async onStart() {
    const stored = await this.room.storage.get<string>("state")
    if (stored) {
      try {
        this.state = deserializeState(stored)
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
      case "set-trump":
        this.handleSetTrump(playerId, msg.suit, msg.lastCard)
        break
      case "call-thunee":
        this.handleCallThunee(playerId)
        break
      case "call-jodhi":
        this.handleCallJodhi(playerId, msg.points)
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
    if (this.state.phase !== "waiting") return

    this.startDeal()
  }

  startDeal() {
    this.deck = shuffleDeck(createDeck())
    this.state.phase = "dealing-first"
    this.state.bidState = createEmptyBidState()
    this.state.trump = null
    this.state.trumpCallerId = null
    this.state.thuneeCallerId = null
    this.state.jodhiCalls = []
    this.state.currentTrick = createEmptyTrick()
    this.state.tricksPlayed = 0
    this.state.trickHistory = []

    // Reset hands
    for (const player of this.state.players) {
      player.hand = []
    }

    // Deal first 4 cards to each player
    const cardsPerPlayer = 4
    for (let i = 0; i < this.state.playerCount; i++) {
      const start = i * cardsPerPlayer
      this.state.players[i].hand = this.deck.slice(start, start + cardsPerPlayer)
    }

    // Move to bidding phase
    this.state.phase = "bidding"
    
    // Player to dealer's right starts bidding (counterclockwise from dealer)
    const dealerIndex = this.state.players.findIndex(p => p.id === this.state.dealerId)
    const starterIndex = (dealerIndex + this.state.playerCount - 1) % this.state.playerCount
    this.state.currentPlayerId = this.state.players[starterIndex].id
  }

  handleBid(playerId: string, amount: number) {
    if (this.state.phase !== "bidding") return
    if (this.state.currentPlayerId !== playerId) return
    if (amount <= this.state.bidState.currentBid) return
    if (amount > 104) return
    if (amount % 10 !== 0 && amount !== 104) return

    this.state.bidState.currentBid = amount
    this.state.bidState.bidderId = playerId

    this.advanceBidding(playerId)
  }

  handlePass(playerId: string) {
    if (this.state.phase !== "bidding") return
    if (this.state.currentPlayerId !== playerId) return

    this.state.bidState.passed.add(playerId)
    this.advanceBidding(playerId)
  }

  advanceBidding(currentPlayerId: string) {
    const currentIndex = this.state.players.findIndex(p => p.id === currentPlayerId)
    
    // Find next player who hasn't passed
    let nextIndex = getNextPlayerIndex(currentIndex, this.state.playerCount)
    let checked = 0
    
    while (checked < this.state.playerCount) {
      const nextPlayer = this.state.players[nextIndex]
      
      // Skip the current bidder (they won the bid)
      if (nextPlayer.id === this.state.bidState.bidderId) {
        nextIndex = getNextPlayerIndex(nextIndex, this.state.playerCount)
        checked++
        continue
      }
      
      if (!this.state.bidState.passed.has(nextPlayer.id)) {
        this.state.currentPlayerId = nextPlayer.id
        return
      }
      
      nextIndex = getNextPlayerIndex(nextIndex, this.state.playerCount)
      checked++
    }

    // All others passed, bidding is over
    this.endBidding()
  }

  endBidding() {
    // Deal remaining 2 cards
    const startIndex = this.state.playerCount * 4
    for (let i = 0; i < this.state.playerCount; i++) {
      const card1 = this.deck[startIndex + i * 2]
      const card2 = this.deck[startIndex + i * 2 + 1]
      if (card1) this.state.players[i].hand.push(card1)
      if (card2) this.state.players[i].hand.push(card2)
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
    
    // Trump caller leads first trick
    this.state.currentPlayerId = playerId
    this.state.phase = "playing"
  }

  handleCallThunee(playerId: string) {
    if (this.state.phase !== "calling") return
    if (this.state.trumpCallerId !== playerId) return

    this.state.thuneeCallerId = playerId
    this.state.trump = null // No trump in Thunee
    this.state.currentPlayerId = playerId
    this.state.phase = "playing"
  }

  handleCallJodhi(playerId: string, points: number) {
    if (this.state.phase !== "playing") return
    
    // Can only call jodhi after winning 1st or 3rd trick
    const player = this.state.players.find(p => p.id === playerId)
    if (!player) return

    this.state.jodhiCalls.push({ playerId, points })
  }

  handlePlayCard(playerId: string, card: Card) {
    if (this.state.phase !== "playing") return
    if (this.state.currentPlayerId !== playerId) return

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

    // Save trick to history
    this.state.trickHistory.push({ ...this.state.currentTrick })

    this.state.tricksPlayed++
    this.state.challengeWindow = false

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
        // The team that LOSES last trick gives 10 to opponent
        const losingTeam = lastWinner.team === 0 ? 1 : 0
        this.state.teams[lastWinner.team].cardPoints += 10
      }
    }

    // Calculate ball awards
    const trumpTeam = this.state.players.find(p => p.id === this.state.trumpCallerId)?.team ?? 0
    const countingTeam = trumpTeam === 0 ? 1 : 0

    const target = 105 - this.state.bidState.currentBid
    const countingScore = this.state.teams[countingTeam].cardPoints

    if (this.state.thuneeCallerId) {
      // Thunee was called
      const thuneePlayer = this.state.players.find(p => p.id === this.state.thuneeCallerId)!
      const thuneeTeam = thuneePlayer.team
      
      // Check if thunee team won all 6 tricks
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

    // Check for game over
    if (this.state.teams[0].balls >= 13) {
      this.state.phase = "game-over"
    } else if (this.state.teams[1].balls >= 13) {
      this.state.phase = "game-over"
    } else if (this.state.playerCount === 2 && this.state.dealRound === 1) {
      // 2-player mode: start second round
      this.state.dealRound = 2
      this.startSecondRound()
    } else {
      // New deal
      this.state.phase = "round-end"
      this.rotateDealerAndReset()
    }
  }

  startSecondRound() {
    // Deal next 6 cards to each player (cards 12-23 from deck)
    const startIndex = 12
    for (let i = 0; i < 2; i++) {
      this.state.players[i].hand = []
      for (let j = 0; j < 4; j++) {
        this.state.players[i].hand.push(this.deck[startIndex + i * 6 + j])
      }
    }
    
    this.state.phase = "bidding"
    this.state.bidState = createEmptyBidState()
    this.state.currentTrick = createEmptyTrick()
    this.state.tricksPlayed = 0
    
    const dealerIndex = this.state.players.findIndex(p => p.id === this.state.dealerId)
    this.state.currentPlayerId = this.state.players[(dealerIndex + 1) % 2].id
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

    // Check if the play was valid
    // We need to reconstruct what the player's hand was before the play
    const trick = this.state.currentTrick
    const card = this.state.lastPlayedCard.card
    
    // The hand after playing + the played card = hand before
    const handBefore = [...accused.hand, card]
    
    const validation = isValidPlay(card, handBefore, {
      ...trick,
      cards: trick.cards.slice(0, -1) // Remove the challenged card
    }, this.state.trump)

    this.state.challengeWindow = false

    if (!validation.valid) {
      // Challenge successful - accused team loses 4 balls
      this.state.teams[accused.team].balls = Math.max(0, this.state.teams[accused.team].balls - 4)
      // Could also award 4 balls to challenger team instead
    } else {
      // Challenge failed - challenger team loses 4 balls  
      this.state.teams[challenger.team].balls = Math.max(0, this.state.teams[challenger.team].balls - 4)
    }
  }
}
