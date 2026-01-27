# Code Review & Technical Debt

This document captures a critical analysis of the Thunee codebase, identifying strengths, issues, and recommendations for improvement.

## Strengths

### Clean Separation of Concerns
- Game logic (`src/game/`) is cleanly separated from UI components
- Types are centralized in `types.ts` with clear domain modeling
- The `GameEvent` union type with inline documentation for adding new events is excellent

### Real-time Architecture
- PartyKit integration is solid with proper state persistence via `room.storage`
- Server-side timers using `onAlarm()` instead of `setTimeout` is the correct approach
- Reconnection handling with `existingPlayerId` localStorage persistence

### Feature-Complete Game Logic
- Supports 2-player and 4-player modes
- Implements complex rules: Thunee, Jodhi, Khanaak, challenge system
- Proper trick validation with hand reconstruction for challenge verification

### Thoughtful UX Details
- Sound effects for turn notifications, card plays, celebrations
- Deal animation state tracking
- Disconnection indicators
- Spectator support

---

## Issues and Technical Debt

### High Priority

#### 1. No Test Coverage
No `.test.ts` or `.spec.ts` files exist. The game rules and state transitions are complex and bug-prone. Unit tests needed for:
- `isValidPlay()` edge cases
- `getTrickWinner()` with trump scenarios
- `reconstructHandAtPlay()` (critical for challenge validation)
- Jodhi point calculations

#### 2. Exposed Game State (Security)
The entire `GameState` is broadcast to all players including other players' hands via `state.players[i].hand`. A client could inspect WebSocket messages to see opponents' cards.

**Location:** `party/index.ts:96-97`
```typescript
broadcastState() {
  this.broadcast({ type: "state", state: this.state, playerId: "" })
```

**Fix:** Filter state per-player before broadcast.

#### 3. Missing Input Validation
Server trusts client-provided data without validation. No schema validation, no try-catch around JSON.parse, casting directly to `ClientMessage`.

**Location:** `party/index.ts:124-126`
```typescript
onMessage(message: string, sender: Party.Connection) {
  const msg = JSON.parse(message) as ClientMessage
```

**Fix:** Add zod or similar schema validation, wrap in try-catch.

### Medium Priority

#### 4. Server State Machine Complexity
`ThuneeServer` is 1076 lines with no clear state machine abstraction. Phase transitions are scattered throughout. Should be a proper state machine (XState or similar) given the number of phases:
- waiting → dealing-first → bidding → dealing-second → calling → playing → trick-complete → round-end → game-over

#### 5. Race Conditions in Bidding
The bid timer and preselection logic has potential race conditions. If two players bid simultaneously near timer expiry, the alarm could fire between operations.

**Location:** `party/index.ts:378-381`

#### 6. Memory Leak - Unbounded Event Log
`eventLog` grows without bound across rounds. For long games, this could cause memory issues.

**Location:** `party/index.ts:232`
```typescript
// Don't reset eventLog - persist across rounds
```

**Fix:** Implement truncation or archival strategy.

#### 7. No Rate Limiting
No protection against clients spamming messages. A client could flood the server with bid/pass messages.

### Low Priority

#### 8. Inconsistent Win Condition
`rules.ts:checkWinCondition()` hardcodes 13 balls, but server uses 12/13 dynamically based on `isKhanaakGame`. The function is never used.

#### 9. TypeScript Non-null Assertions
Several unsafe `!` assertions throughout the codebase assuming players always exist:
```typescript
const winner = this.state.players.find(p => p.id === winnerId)!
```

#### 10. Duplicated Dealing Logic
`deck.ts:dealCards()` exists but is never used by the server. The dealing math is duplicated in `party/index.ts:243-254` and could diverge.

---

## Missing Features

| Feature | Description |
|---------|-------------|
| Game replay/history | Event log exists but no UI to browse past games |
| Leave game / forfeit | No way to gracefully exit mid-game |
| Kick inactive players | Connected but AFK players stall the game |
| Chat/emotes | Common in multiplayer card games |
| Sound toggle | No way to mute sounds |
| Error boundaries | No React error boundaries; crashes show white screen |

---

## Recommendations

| Priority | Item | Effort |
|----------|------|--------|
| **High** | Add unit tests for game rules | Medium |
| **High** | Filter state before broadcast (hide opponent hands) | Low |
| **High** | Add input validation/schema for client messages | Low |
| **Medium** | Extract state machine from ThuneeServer | High |
| **Medium** | Add rate limiting | Low |
| **Medium** | Implement eventLog truncation | Low |
| **Low** | Use XState or similar for phase management | High |
| **Low** | Add React error boundaries | Low |

---

## Summary

The codebase is functional and implements a complex card game correctly for the happy path. The architecture choices (PartyKit, shared game logic, typed messages) are sound. However, the lack of tests is concerning for a game with intricate rules, and the server leaks sensitive game state.

**For hobby/demo use:** Ready as-is.

**For production use:** Needs hardening around security (state filtering, input validation) and reliability (tests, rate limiting).
