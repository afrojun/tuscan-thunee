# Thunee - Multiplayer Card Game

## Commands

```bash
# Install dependencies
bun install

# Run frontend dev server (localhost:5173)
bun run dev

# Run PartyKit game server (localhost:1999)
bun run party

# Quick test: Click "🤖 Quick Test (4P vs AI)" on home page to instantly start a 4-player game with 3 AI opponents

# Type check
bun run check

# Build for production
bun run build

# Deploy PartyKit to production
bun run party:deploy
```

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS (retro 2D aesthetic)
- **Real-time**: PartyKit (WebSocket game server)
- **Package Manager**: Bun

## Project Structure

```
src/
├── components/     # React UI components
│   ├── Card.tsx           # Card display (face/back)
│   ├── PlayerHand.tsx     # Fan layout of player's cards
│   ├── GameBoard.tsx      # Main game view
│   ├── BiddingPanel.tsx   # Timer-based calling UI
│   ├── TrumpSelector.tsx  # Trump suit selection
│   ├── ScoreBoard.tsx     # Team scores display
│   ├── TrickArea.tsx      # Current trick display
│   ├── Lobby.tsx          # Game lobby/join screen
│   └── GameHeader.tsx     # Leave button + game code
├── game/           # Shared game logic
│   ├── types.ts           # TypeScript types
│   ├── deck.ts            # Card deck utilities
│   ├── rules.ts           # Game rule validation
│   ├── state.ts           # State creation/serialization
│   └── utils.ts           # Helper functions
├── hooks/
│   └── usePartySocket.ts  # PartyKit WebSocket hook
├── pages/
│   ├── Home.tsx           # Create/join game
│   └── Game.tsx           # Game session page
└── index.css       # Tailwind + custom styles

party/
└── index.ts        # PartyKit server (game state machine)
```

## Game Rules (Thunee)

- South African trick-taking card game
- 2 or 4 players (4 players in teams of 2)
- 24-card deck: J, 9, A, 10, K, Q in each suit
- Card values: J=30, 9=20, A=11, 10=10, K=3, Q=2
- First to 13 "balls" wins
- Calling phase: 10s timer, anyone can call, resets on new call
- Must follow suit; can "chop" (trump) if void
- Game allows intentional invalid plays (cheating) with challenge system

## Conventions

- Mobile-first responsive design
- Use Tailwind utility classes
- Game terminology: "call" not "bid", "balls" for game points
- Card backs: red/white crosshatch pattern
- Cards in fan layout with rotation
- Timer uses PartyKit alarm API (not setTimeout)

## Environment Variables

```bash
# For production deployment
VITE_PARTYKIT_HOST=your-app.partykit.dev
```

## Deployment

### PartyKit Server

```bash
npx partykit login
bun run party:deploy
```

Server URL will be: `tuscan-thunee.USERNAME.partykit.dev`

### Frontend (Vercel recommended)

```bash
vercel
```

Set `VITE_PARTYKIT_HOST` in Vercel dashboard → Settings → Environment Variables, then redeploy.

### Other Frontend Hosts

- **Cloudflare Pages**: `bun run build`, upload `dist/`
- **Netlify**: `bun run build`, drag `dist/` to dashboard

All require setting `VITE_PARTYKIT_HOST` env var to the PartyKit server URL.
