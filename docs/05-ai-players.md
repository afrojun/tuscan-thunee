# AI Players

This document describes the server-side AI player implementation for Thunee.

## Overview

AI players run entirely on the PartyKit server, requiring no additional infrastructure. They can fill empty seats in the lobby, enabling solo practice or games with fewer humans.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PartyKit Server                     │
│  ┌───────────────┐      ┌───────────────────────┐   │
│  │ ThuneeServer  │─────▶│     party/ai/         │   │
│  │               │      │  ┌─────────────────┐  │   │
│  │ maybeSchedule │      │  │ decisions.ts    │  │   │
│  │ AITurn()      │      │  │ (orchestration) │  │   │
│  │               │      │  └────────┬────────┘  │   │
│  │ executeAI     │      │           │           │   │
│  │ Turn()        │      │  ┌────────┴────────┐  │   │
│  └───────────────┘      │  │                 │  │   │
│                         │  ▼                 ▼  │   │
│                         │ bidding.ts   playing.ts   │
│                         └───────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Module Structure

| File | Purpose |
|------|---------|
| `party/ai/types.ts` | AI decision types and interfaces |
| `party/ai/bidding.ts` | Hand evaluation and bidding strategy |
| `party/ai/playing.ts` | Card play decisions |
| `party/ai/decisions.ts` | Routes to appropriate strategy by game phase |
| `party/ai/index.ts` | Public exports |

## How It Works

### Adding AI Players

1. Human clicks "Add AI Player" in lobby
2. Client sends `{ type: 'add-ai' }` message
3. Server creates player with `isAI: true`, `connected: true`
4. AI gets a unique name (Bot Alice, Bot Bob, etc.)

### AI Turn Scheduling

The server checks if an AI needs to act after every state change:

```typescript
maybeScheduleAITurn() {
  const aiPlayer = getNextAIPlayer(this.state)
  if (!aiPlayer) return
  
  // During bidding, execute immediately (can't use alarm)
  if (this.state.phase === 'bidding') {
    this.executeAIBiddingTurn(aiPlayer)
    return
  }
  
  // Other phases: schedule with 500ms delay for natural feel
  this.pendingAlarmType = 'ai-turn'
  await this.room.storage.setAlarm(Date.now() + 500)
}
```

**Important:** PartyKit only allows one alarm at a time. During the bidding phase, AI decisions execute immediately to avoid canceling the bidding timer.

### Decision Flow

```
getNextAIPlayer(state) → computeAIMove(state, playerId) → AIDecision
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              computeBidding   computeCalling  computePlaying
                 Move()          Move()          Move()
```

## AI Strategies

### Bidding (`party/ai/bidding.ts`)

**Hand Evaluation:**
- Counts high cards: Jacks (30pts), Nines (20pts), Aces (11pts)
- Analyzes each suit for trump potential
- Calculates strength score per suit

**Bidding Logic:**
- Pass with weak hands (< 2 high cards)
- Bid based on max willingness:
  - 2+ Jacks: bid up to 40
  - 1 Jack + strong suit: bid up to 30
  - 3+ high cards: bid up to 25
  - 2 high cards: bid up to 20
- Never overbid (passes if current bid ≥ max)
- Always bids with 2+ Jacks (no random passing)

**Trump Selection:**
- Chooses suit with highest strength score
- Prioritizes suits with J, 9, A
- Considers "last card" trump for weak hands

### Card Play (`party/ai/playing.ts`)

**Leading a Trick:**
- Avoids leading trump early
- Leads from longest non-trump suit
- Leads Jack if holding one in the suit

**Following a Trick:**
- Must follow suit if possible (game rule)
- If partner is winning: play lowest card
- If can beat current winner: play lowest winning card
- Late game (tricks ≥ 4): more aggressive winning
- If can't win: discard lowest card

**Trumping:**
- When void in lead suit and opponent winning
- Uses lowest trump that wins
- Considers trick point value before trumping

## UI Integration

### Lobby Component

```tsx
// Add AI button (shows when joined but not full)
{hasJoined && currentPlayers < expectedPlayers && (
  <button onClick={onAddAI}>+ ADD AI PLAYER</button>
)}

// AI indicator in player list
{p.name} {p.isAI && <span>🤖</span>}
```

### Game Page

```tsx
const handleAddAI = () => {
  send({ type: 'add-ai' })
}
```

## Edge Cases

### Bidding Timer Conflict

PartyKit only supports one alarm. The bidding phase uses an alarm for the timer. To avoid conflicts:
- AI bidding decisions execute immediately via `executeAIBiddingTurn()`
- `maybeScheduleAITurn()` skips alarm scheduling during bidding phase

### Disconnected Players

Currently, if a human disconnects:
- Game pauses waiting for them
- AI does NOT take over automatically
- Human can reconnect to resume

**Future enhancement:** AI could play for disconnected humans.

### All Humans Leave

If all humans disconnect during a game with AI:
- AI continues playing (alarms still fire)
- State is preserved
- Humans can rejoin later

This is low-resource (no WebSocket connections) but could be improved by pausing AI when no humans are connected.

## Testing

Tests are in `party/ai/*.test.ts`:

| Test File | Coverage |
|-----------|----------|
| `bidding.test.ts` | Hand evaluation, bid decisions, trump selection |
| `playing.test.ts` | Valid cards, play decisions, partner awareness |
| `decisions.test.ts` | Phase routing, AI player detection |

Run tests:
```bash
bun test party/ai/
```

## Future Improvements

| Feature | Description |
|---------|-------------|
| Difficulty levels | Easy/Medium/Hard with different strategies |
| AI takeover | Play for disconnected humans |
| Pause when alone | Don't run AI if no humans watching |
| Personality | Different AI "personalities" (aggressive, conservative) |
| Learning | Track opponent patterns within a game |
