# Challenge System Implementation Plan

## Overview
Implement the full challenge mechanic where players can challenge opponents for illegal plays (not following suit when able). This is central to Thunee's "cheating allowed" design.

## Current State
- `challengeWindow` boolean exists in GameState
- `lastPlayedCard` tracks the most recent play
- `handleChallenge` in party/index.ts has basic logic but needs fixes
- Challenge button shows in GameBoard.tsx during challenge window

## Requirements

### Game Flow
1. After any card is played, a challenge window opens
2. Opponent team players see a "CHALLENGE" button
3. If challenged:
   - Reconstruct the accused player's hand **before** their play
   - Check if they had the lead suit and didn't play it
   - If cheating confirmed: challenger's team gets **+4 balls**, round ends immediately
   - If challenge fails: challenger's team gets **+4 balls penalty** (awarded to accused team), round ends
4. Round ends and next deal begins after any challenge resolution

### UI Requirements
- Challenge button visible only to opponent team during challenge window
- Challenge result modal showing:
  - The challenged card
  - Whether the play was valid/invalid
  - Which team gets 4 balls
  - "CHEATER CAUGHT!" or "BAD CHALLENGE!" message
- Auto-dismiss after 3 seconds or on tap, then start next round

## Implementation Steps

### Step 1: Fix Server Challenge Logic (party/index.ts)

Update `handleChallenge` method:

```typescript
handleChallenge(challengerId: string) {
  if (!this.state.challengeWindow) return
  if (!this.state.lastPlayedCard) return

  const challenger = this.state.players.find(p => p.id === challengerId)
  const accused = this.state.players.find(p => p.id === this.state.lastPlayedCard!.playerId)
  
  if (!challenger || !accused) return
  if (challenger.team === accused.team) return // Can't challenge teammate

  // Reconstruct hand before the play
  const card = this.state.lastPlayedCard.card
  const handBefore = [...accused.hand, card]
  
  // Build the trick state before this card was played
  const trickBefore = {
    ...this.state.currentTrick,
    cards: this.state.currentTrick.cards.filter(c => c.playerId !== accused.id)
  }

  const validation = isValidPlay(card, handBefore, trickBefore, this.state.trump)

  // Store challenge result for UI
  this.state.challengeResult = {
    challengerId,
    accusedId: accused.id,
    card,
    wasValid: validation.valid,
    winningTeam: validation.valid ? accused.team : challenger.team
  }

  // Award 4 balls to winning team
  const winningTeam = validation.valid ? accused.team : challenger.team
  this.state.teams[winningTeam].balls += 4

  // End round immediately
  this.state.challengeWindow = false
  this.state.phase = 'round-end'
  
  // Check for game over
  if (this.state.teams[0].balls >= 13 || this.state.teams[1].balls >= 13) {
    this.state.phase = 'game-over'
  }
}
```

### Step 2: Add Challenge Result to Types (src/game/types.ts)

Add to GameState interface:
```typescript
challengeResult: {
  challengerId: string
  accusedId: string
  card: Card
  wasValid: boolean
  winningTeam: 0 | 1
} | null
```

### Step 3: Update State Initialization (src/game/state.ts)

Add `challengeResult: null` to `createInitialState`.

Reset `challengeResult: null` in `startDeal` method.

### Step 4: Create Challenge Result Modal (src/components/ChallengeResultModal.tsx)

New component showing:
- Header: "CHALLENGE!" in retro style
- The challenged card (Card component)
- Result message: "CHEATER CAUGHT!" (red) or "BAD CHALLENGE!" (gold)
- Team names and +4 balls indicator
- Auto-dismisses after 3s or on click

### Step 5: Integrate Modal in GameBoard.tsx

- Import and render ChallengeResultModal when `gameState.challengeResult` exists
- On dismiss, if phase is 'round-end', show the existing round-end UI
- Ensure challenge button only shows for opponent team members

### Step 6: Clear Challenge Result on Round Start

In party/index.ts `startDeal`, add:
```typescript
this.state.challengeResult = null
```

## Testing Checklist

- [ ] Challenge button only visible to opponent team
- [ ] Successful challenge awards 4 balls to challenger, ends round
- [ ] Failed challenge awards 4 balls to accused team, ends round
- [ ] Challenge result modal displays correctly
- [ ] Modal auto-dismisses and proceeds to next round
- [ ] Game over triggers if challenge pushes team to 13+ balls
- [ ] Cannot challenge after trick completes
- [ ] Cannot challenge teammate

## Files to Modify

1. `party/index.ts` - Fix handleChallenge logic
2. `src/game/types.ts` - Add ChallengeResult type
3. `src/game/state.ts` - Initialize challengeResult
4. `src/components/ChallengeResultModal.tsx` - New file
5. `src/components/GameBoard.tsx` - Integrate modal, fix button visibility
