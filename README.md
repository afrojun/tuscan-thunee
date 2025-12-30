# Thunee

A multiplayer South African card game built with React, TypeScript, and PartyKit.

## Features

- 2 or 4 player modes
- Real-time multiplayer via WebSockets
- Timer-based calling system (10s per round)
- Mobile-first responsive design
- Retro 2D aesthetic

## Local Development

```bash
# Install dependencies
bun install

# Terminal 1: Start game server
bun run party

# Terminal 2: Start frontend
bun run dev
```

Open http://localhost:5173 to play.

## Deployment

### 1. Deploy PartyKit Server

```bash
# Login (creates account if needed)
npx partykit login

# Deploy
bun run party:deploy
```

Note your server URL: `tuscan-thunee.YOUR_USERNAME.partykit.dev`

### 2. Deploy Frontend (Vercel)

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel
```

Then add the environment variable in Vercel dashboard:
- Go to Settings → Environment Variables
- Add `VITE_PARTYKIT_HOST` = `tuscan-thunee.YOUR_USERNAME.partykit.dev`
- Redeploy

### Alternative Frontend Hosts

**Cloudflare Pages:**
```bash
bun run build
# Upload dist/ folder in Cloudflare dashboard
# Add VITE_PARTYKIT_HOST in Settings → Environment Variables
```

**Netlify:**
```bash
bun run build
# Drag dist/ folder to Netlify
# Add VITE_PARTYKIT_HOST in Site settings → Environment variables
```

## Game Rules

- 24-card deck: J, 9, A, 10, K, Q in each suit
- Card values: J=30, 9=20, A=11, 10=10, K=3, Q=2
- First to 13 "balls" wins
- Calling phase: 10s timer, anyone can call
- Must follow suit; can "chop" (trump) if void
- Challenge system for invalid plays

## Tech Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Real-time**: PartyKit (WebSocket server)
- **Package Manager**: Bun
