# Jodhi Calling Implementation Plan

## Overview
Implement Jodhi - a bonus scoring mechanic where players can declare they hold Q+K (or Q+K+J) of the same suit after winning a trick.

## Jodhi Rules

### What is Jodhi?
- Holding Queen + King of the same suit = Jodhi
- Holding Queen + King + Jack of the same suit = Jodhi with Jack (higher value)

### Point Values
| Combination | Trump Suit | Off-Suit |
|-------------|------------|----------|
| Q + K       | 40 points  | 20 points |
| Q + K + J   | 50 points  | 30 points |

### Timing
- Can be called **after winning any trick** (not just 1st or 3rd)
- Any player on the **winning team** can call Jodhi
- Multiple Jodhis allowed (different suits)

### Scoring Effect
- Jodhi points are added to **card points**
- The non-trumping team needs to reach 105 to win a ball
- If trumping team calls Jodhi, it **increases** the target (105 + Jodhi points)
- If non-trumping team calls Jodhi, it **adds to their score**

### Challenge Aspect
- Jodhi is called on honor system
- Opponents can challenge (would need hand reveal)
- For this implementation: trust-based, no challenge UI for Jodhi specifically

## Current State
- `jodhiCalls` array exists in GameState
- `handleCallJodhi` exists but is incomplete
- `calculateJodhi` utility exists in rules.ts
- No UI for calling Jodhi

## Implementation Steps

### Step 1: Update Types (src/game/types.ts)

The JodhiCall type should include suit information:
```typescript
// In GameState, update jodhiCalls type
jodhiCalls: { 
  playerId: string
  points: number
  suit: Suit
  hasJack: boolean
}[]
```

Add to ClientMessage union:
```typescript
| { type: 'call-jodhi'; suit: Suit }
```

### Step 2: Update Server Logic (party/index.ts)

Update `handleCallJodhi`:
```typescript
handleCallJodhi(playerId: string, suit: Suit) {
  if (this.state.phase !== 'playing') return
  
  // Can only call after a trick was just won
  const lastTrick = this.state.trickHistory[this.state.trickHistory.length - 1]
  if (!lastTrick?.winnerId) return
  
  // Caller must be on the winning team
  const caller = this.state.players.find(p => p.id === playerId)
  const trickWinner = this.state.players.find(p => p.id === lastTrick.winnerId)
  if (!caller || !trickWinner) return
  if (caller.team !== trickWinner.team) return
  
  // Check if already called Jodhi for this suit
  const alreadyCalled = this.state.jodhiCalls.some(j => 
    j.playerId === playerId && j.suit === suit
  )
  if (alreadyCalled) return
  
  // Check if player has Q+K in the suit (honor system, but validate they have cards)
  const hasQ = caller.hand.some(c => c.suit === suit && c.rank === 'Q')
  const hasK = caller.hand.some(c => c.suit === suit && c.rank === 'K')
  const hasJ = caller.hand.some(c => c.suit === suit && c.rank === 'J')
  
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
```

### Step 3: Update Scoring Logic (party/index.ts)

In `endRound`, incorporate Jodhi into scoring:
```typescript
endRound() {
  // ... existing last trick bonus logic ...

  // Calculate Jodhi adjustments
  const trumpTeam = this.state.players.find(p => p.id === this.state.trumpCallerId)?.team ?? 0
  const countingTeam = trumpTeam === 0 ? 1 : 0

  // Sum Jodhi points by team
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

  // Adjusted target and score
  const target = 105 - this.state.bidState.currentBid + trumpTeamJodhi
  const countingScore = this.state.teams[countingTeam].cardPoints + countingTeamJodhi

  // ... rest of scoring logic using adjusted values ...
}
```

### Step 4: Create Jodhi Call UI (src/components/JodhiButton.tsx)

New component that appears after winning a trick:
```typescript
interface JodhiButtonProps {
  hand: Card[]
  trump: Suit | null
  onCallJodhi: (suit: Suit) => void
  disabled: boolean
}
```

Shows available Jodhi calls based on player's hand:
- Button for each suit where player has Q+K
- Shows point value (20/30/40/50)
- Disabled if not their team's trick win or already called

### Step 5: Add Jodhi Display in ScoreBoard (src/components/ScoreBoard.tsx)

Show called Jodhis:
- Small icons or text showing which Jodhis have been called
- Format: "Jodhi: ♥40" next to team score

### Step 6: Integrate in GameBoard.tsx

- Import JodhiButton component
- Show after trick completion, before next trick starts
- Only show to players on the winning team
- Track "can call Jodhi" window (after trick won, before next card played)

### Step 7: Add Jodhi Window State

Add to GameState:
```typescript
jodhiWindow: boolean  // True after trick won, until next card played
lastTrickWinningTeam: 0 | 1 | null
```

Update in `completeTrick`:
```typescript
this.state.jodhiWindow = true
this.state.lastTrickWinningTeam = winner.team
```

Clear in `handlePlayCard` at the start:
```typescript
this.state.jodhiWindow = false
```

### Step 8: Reset Jodhi State Each Round

In `startDeal`:
```typescript
this.state.jodhiCalls = []
this.state.jodhiWindow = false
this.state.lastTrickWinningTeam = null
```

## UI Design

### Jodhi Button Appearance
- Appears as floating panel above player's hand after trick win
- Shows suit symbols with point values
- Gold/retro styling matching game theme
- Example: "Call Jodhi: ♥40 ♠20"

### Jodhi Announcement
- When Jodhi is called, brief toast/animation
- "JODHI! ♥ +40" appears center screen
- Fades after 1.5 seconds

## Testing Checklist

- [ ] Jodhi button appears only after winning a trick
- [ ] Only winning team can call Jodhi
- [ ] Correct point values for trump vs off-suit
- [ ] Correct point values for with/without Jack
- [ ] Multiple Jodhis can be called (different suits)
- [ ] Same suit Jodhi can't be called twice
- [ ] Jodhi points affect final scoring correctly
- [ ] Trump team Jodhi increases target
- [ ] Counting team Jodhi adds to their score
- [ ] Jodhi display in scoreboard
- [ ] Jodhi window closes when next card is played

## Files to Modify

1. `src/game/types.ts` - Update JodhiCall type, add jodhiWindow state
2. `party/index.ts` - handleCallJodhi, endRound scoring, jodhiWindow management
3. `src/game/state.ts` - Initialize new state fields
4. `src/components/JodhiButton.tsx` - New file
5. `src/components/JodhiAnnouncement.tsx` - New file (optional toast)
6. `src/components/ScoreBoard.tsx` - Show Jodhi calls
7. `src/components/GameBoard.tsx` - Integrate Jodhi UI
