# 2-Player Mode Polish Implementation Plan

## Overview
Fix and polish the 2-player mode where each player plays 2 rounds of 6 cards from a single 24-card deck, with cumulative scoring.

## 2-Player Mode Rules

### Dealing
- Full 24-card deck shuffled once per deal
- **Round 1**: Each player gets 6 cards (cards 0-5 for P1, cards 6-11 for P2)
- **Round 2**: Each player gets remaining 6 cards (cards 12-17 for P1, cards 18-23 for P2)

### Calling
- Calling phase happens **once** at the start (after first 4 cards dealt)
- Remaining 2 cards dealt after calling completes
- **Trump stays the same** for both rounds

### Scoring
- Card points are **cumulative** across both rounds
- After Round 2 completes (12 tricks total), balls are awarded based on combined score
- Target is still 105 - bid amount

### Thunee Special Case
- If Thunee is called and won in Round 1 (all 6 tricks), **no Round 2**
- Award 4 balls immediately

## Current Issues

### Bug 1: Incorrect Dealing in startSecondRound
Current code:
```typescript
for (let j = 0; j < 4; j++) {
  this.state.players[i].hand.push(this.deck[startIndex + i * 6 + j])
}
```
Only deals 4 cards instead of 6.

### Bug 2: Round 2 Shouldn't Have Bidding Phase
Current code sets `this.state.phase = "bidding"` but rules say calling only happens once.

### Bug 3: Scoring Happens After Round 1
Current `endRound` awards balls after 6 tricks, but in 2-player mode should wait for 12 tricks (both rounds).

### Bug 4: Thunee Check Not Working
Need to check if Thunee was called AND won in Round 1, then skip Round 2.

### Bug 5: Card Points Not Cumulative
`rotateDealerAndReset` resets cardPoints to 0, but for 2-player we need them cumulative until after Round 2.

## Implementation Steps

### Step 1: Fix startSecondRound Dealing

```typescript
startSecondRound() {
  // Deal remaining 12 cards (6 to each player)
  // Player 0 gets cards 12-17, Player 1 gets cards 18-23
  for (let i = 0; i < 2; i++) {
    this.state.players[i].hand = []
    for (let j = 0; j < 6; j++) {
      this.state.players[i].hand.push(this.deck[12 + i * 6 + j])
    }
  }
  
  // Skip directly to playing - trump and bid carry over
  this.state.phase = "playing"
  this.state.currentTrick = createEmptyTrick()
  this.state.tricksPlayed = 0
  
  // Same player leads as won last trick of Round 1
  const lastTrick = this.state.trickHistory[this.state.trickHistory.length - 1]
  if (lastTrick?.winnerId) {
    this.state.currentPlayerId = lastTrick.winnerId
  }
}
```

### Step 2: Fix endRound for 2-Player Mode

Update to only award balls after Round 2:

```typescript
endRound() {
  // Award 10 points for last trick
  const lastTrick = this.state.trickHistory[this.state.trickHistory.length - 1]
  if (lastTrick?.winnerId) {
    const lastWinner = this.state.players.find(p => p.id === lastTrick.winnerId)
    if (lastWinner) {
      this.state.teams[lastWinner.team].cardPoints += 10
    }
  }

  // 2-player mode: check for Thunee win in Round 1
  if (this.state.playerCount === 2 && this.state.dealRound === 1 && this.state.thuneeCallerId) {
    const thuneePlayer = this.state.players.find(p => p.id === this.state.thuneeCallerId)!
    const thuneeTeam = thuneePlayer.team
    
    const wonAllTricks = this.state.trickHistory.every(t => {
      const winner = this.state.players.find(p => p.id === t.winnerId)
      return winner?.team === thuneeTeam
    })

    if (wonAllTricks) {
      // Thunee won in Round 1 - award balls, skip Round 2
      this.state.teams[thuneeTeam].balls += 4
      this.checkGameOver()
      if (this.state.phase !== 'game-over') {
        this.state.phase = "round-end"
        this.rotateDealerAndReset()
      }
      return
    } else {
      // Thunee failed in Round 1 - opponent gets balls, skip Round 2
      const otherTeam = thuneeTeam === 0 ? 1 : 0
      this.state.teams[otherTeam].balls += 4
      this.checkGameOver()
      if (this.state.phase !== 'game-over') {
        this.state.phase = "round-end"
        this.rotateDealerAndReset()
      }
      return
    }
  }

  // 2-player mode: after Round 1, go to Round 2 (if not Thunee)
  if (this.state.playerCount === 2 && this.state.dealRound === 1) {
    this.state.dealRound = 2
    this.startSecondRound()
    return
  }

  // Calculate ball awards (after Round 2 in 2-player, or after 6 tricks in 4-player)
  const trumpTeam = this.state.players.find(p => p.id === this.state.trumpCallerId)?.team ?? 0
  const countingTeam = trumpTeam === 0 ? 1 : 0

  const target = 105 - this.state.bidState.currentBid
  const countingScore = this.state.teams[countingTeam].cardPoints

  if (this.state.thuneeCallerId) {
    // Thunee in 4-player mode (or Round 2 of 2-player)
    const thuneePlayer = this.state.players.find(p => p.id === this.state.thuneeCallerId)!
    const thuneeTeam = thuneePlayer.team
    
    // For 2-player Round 2, check all 12 tricks
    const tricksToCheck = this.state.playerCount === 2 ? this.state.trickHistory : this.state.trickHistory
    const wonAllTricks = tricksToCheck.every(t => {
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

  this.checkGameOver()
  if (this.state.phase !== 'game-over') {
    this.state.phase = "round-end"
    this.rotateDealerAndReset()
  }
}

checkGameOver() {
  if (this.state.teams[0].balls >= 13) {
    this.state.phase = "game-over"
  } else if (this.state.teams[1].balls >= 13) {
    this.state.phase = "game-over"
  }
}
```

### Step 3: Fix First Round Dealing for 2-Player

In `startDeal`, update dealing for 2-player mode:

```typescript
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
  if (this.state.playerCount === 4) {
    // 4-player: 4 cards each from first 16 cards
    for (let i = 0; i < 4; i++) {
      const start = i * 4
      this.state.players[i].hand = this.deck.slice(start, start + 4)
    }
  } else {
    // 2-player: 4 cards each from first 8 cards
    for (let i = 0; i < 2; i++) {
      const start = i * 4
      this.state.players[i].hand = this.deck.slice(start, start + 4)
    }
  }

  // Move to calling phase with timer
  this.state.phase = "bidding"
  this.state.currentPlayerId = null
  this.startCallTimer()
}
```

### Step 4: Fix endBidding for 2-Player

Update remaining card dealing:

```typescript
endBidding() {
  if (this.state.playerCount === 4) {
    // Deal remaining 2 cards to each player (cards 16-23)
    const startIndex = 16
    for (let i = 0; i < 4; i++) {
      const card1 = this.deck[startIndex + i * 2]
      const card2 = this.deck[startIndex + i * 2 + 1]
      if (card1) this.state.players[i].hand.push(card1)
      if (card2) this.state.players[i].hand.push(card2)
    }
  } else {
    // 2-player: Deal remaining 2 cards to each player (cards 8-11)
    for (let i = 0; i < 2; i++) {
      const card1 = this.deck[8 + i * 2]
      const card2 = this.deck[8 + i * 2 + 1]
      if (card1) this.state.players[i].hand.push(card1)
      if (card2) this.state.players[i].hand.push(card2)
    }
  }

  // ... rest unchanged ...
}
```

### Step 5: Update UI for 2-Player Mode

#### GameBoard.tsx
- Show "Round 1/2" or "Round 2/2" indicator in 2-player mode
- Adjust layout for 2-player (opponent only at top, no sides)

#### ScoreBoard.tsx
- Show cumulative card points clearly
- Maybe show "Round X" indicator

### Step 6: Add Round Indicator Component

New component or addition to GameHeader:
```typescript
{gameState.playerCount === 2 && gameState.phase === 'playing' && (
  <span className="font-mono text-xs">
    Round {gameState.dealRound}/2
  </span>
)}
```

## Testing Checklist

- [ ] 2-player game creation works
- [ ] First round: 4 cards dealt, then 2 more after calling = 6 cards each
- [ ] Calling phase only happens once
- [ ] After 6 tricks, Round 2 starts automatically
- [ ] Round 2: 6 new cards dealt to each player
- [ ] Trump carries over from Round 1
- [ ] Card points are cumulative across both rounds
- [ ] Balls awarded only after Round 2 completes
- [ ] Thunee win in Round 1 ends deal (no Round 2)
- [ ] Thunee loss in Round 1 ends deal (no Round 2)
- [ ] Round indicator shows correctly
- [ ] Layout works for 2-player (no side opponents)
- [ ] Winner of last trick in Round 1 leads Round 2

## Files to Modify

1. `party/index.ts` - Fix dealing, endRound logic, startSecondRound
2. `src/components/GameBoard.tsx` - 2-player layout adjustments
3. `src/components/ScoreBoard.tsx` - Round indicator
4. `src/components/GameHeader.tsx` - Optional round display
