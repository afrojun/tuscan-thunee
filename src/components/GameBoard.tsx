import { useState, useEffect } from 'react'
import type { GameState, ClientMessage, Card as CardType, Suit } from '@/game/types'
import { PlayerHand } from './PlayerHand'
import { TrickArea } from './TrickArea'
import { ScoreBoard } from './ScoreBoard'
import { BiddingPanel } from './BiddingPanel'
import { TrumpSelector } from './TrumpSelector'
import { CardBack } from './Card'
import { GameHeader } from './GameHeader'
import { ChallengeResultModal } from './ChallengeResultModal'
import { ChallengeModal } from './ChallengeModal'
import { JodhiButton } from './JodhiButton'
import { TrickResultToast } from './TrickResultToast'

interface GameBoardProps {
  gameState: GameState
  playerId: string
  onAction: (msg: ClientMessage) => void
}

export function GameBoard({ gameState, playerId, onAction }: GameBoardProps) {
  const [dismissedChallengeResult, setDismissedChallengeResult] = useState(false)
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const currentPlayer = gameState.players.find(p => p.id === playerId)
  const isCurrentPlayer = gameState.currentPlayerId === playerId
  const isSpectator = !currentPlayer || currentPlayer.isSpectator
  const playerIndex = gameState.players.findIndex(p => p.id === playerId)
  
  // Reset dismissed state when challenge result changes
  const challengeResultKey = gameState.challengeResult 
    ? `${gameState.challengeResult.accusedId}-${gameState.challengeResult.challengeType}`
    : null
  
  useEffect(() => {
    setDismissedChallengeResult(false)
    setShowChallengeModal(false)
  }, [challengeResultKey])

  const handlePlayCard = (card: CardType) => {
    onAction({ type: 'play-card', card })
  }

  const handleBid = (amount: number) => {
    onAction({ type: 'bid', amount })
  }

  const handlePass = () => {
    onAction({ type: 'pass' })
  }

  const handleSetTrump = (suit: Suit, lastCard?: boolean) => {
    onAction({ type: 'set-trump', suit, lastCard })
  }

  const handleCallThunee = () => {
    onAction({ type: 'call-thunee' })
  }

  const handleChallengePlay = (accusedId: string) => {
    onAction({ type: 'challenge-play', accusedId })
    setShowChallengeModal(false)
  }

  const handleChallengeJodhi = (accusedId: string, suit: Suit) => {
    onAction({ type: 'challenge-jodhi', accusedId, suit })
    setShowChallengeModal(false)
  }

  const handlePreselectTrump = (suit: Suit) => {
    onAction({ type: 'preselect-trump', suit })
  }

  const handleCallJodhi = (suit: Suit) => {
    onAction({ type: 'call-jodhi', suit })
  }

  const canCallJodhi = () => {
    if (!gameState.jodhiWindow || isSpectator || !currentPlayer) return false
    return currentPlayer.team === gameState.lastTrickWinningTeam
  }

  const myCalledJodhiSuits = gameState.jodhiCalls
    .filter(j => j.playerId === playerId)
    .map(j => j.suit)

  // Get opponents for challenge modal
  const opponents = currentPlayer 
    ? gameState.players.filter(p => p.team !== currentPlayer.team)
    : []

  // Get opponent jodhi calls for challenge modal
  const opponentJodhiCalls = gameState.jodhiCalls.filter(j => {
    const player = gameState.players.find(p => p.id === j.playerId)
    return player && currentPlayer && player.team !== currentPlayer.team
  })

  // Get opponent info based on player count
  const getOpponent = (offset: number) => {
    const idx = (playerIndex + offset) % gameState.playerCount
    return gameState.players[idx]
  }

  // For 4 players: show partner at top, opponents at sides
  // For 2 players: show opponent at top
  const topPlayer = gameState.playerCount === 4 ? getOpponent(2) : getOpponent(1)
  const leftPlayer = gameState.playerCount === 4 ? getOpponent(3) : null
  const rightPlayer = gameState.playerCount === 4 ? getOpponent(1) : null

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Game header */}
      <GameHeader gameId={gameState.id} />

      <div className="flex flex-col flex-1 p-2 gap-2 overflow-hidden">
        {/* Spectator banner */}
        {isSpectator && (
          <div className="bg-retro-black/80 text-retro-gold text-center py-1 font-retro text-xs">
            👁️ SPECTATING
          </div>
        )}

        {/* Score board */}
      <ScoreBoard 
        teams={gameState.teams}
        players={gameState.players}
        currentBid={gameState.bidState.currentBid}
        playerCount={gameState.playerCount}
        dealRound={gameState.dealRound}
        phase={gameState.phase}
        jodhiCalls={gameState.jodhiCalls}
        eventLog={gameState.eventLog}
        trump={gameState.trump}
      />

      {/* Top opponent (partner in 4p, opponent in 2p) */}
      <div className="flex flex-col items-center">
        <p className={`font-mono text-xs mb-1 ${
          topPlayer?.id === gameState.currentPlayerId 
            ? 'text-retro-gold animate-turn-pulse' 
            : 'text-retro-cream/60'
        } ${topPlayer && !topPlayer.connected ? 'opacity-50' : ''}`}>
          {topPlayer?.name}
          {topPlayer && !topPlayer.connected && ' 📵'}
          {topPlayer?.id === gameState.currentPlayerId && ' ◄'}
        </p>
        <div className="flex gap-0.5">
          {Array.from({ length: topPlayer?.hand.length ?? 0 }).map((_, i) => (
            <CardBack key={i} small />
          ))}
        </div>
      </div>

      {/* Middle section: side opponents + center area */}
      <div className="flex-1 flex items-center justify-center gap-2 min-h-0">
        {/* Left opponent (4p only) */}
        {leftPlayer && (
          <div className="flex flex-col items-center shrink-0">
            <p className={`font-mono text-xs mb-1 writing-mode-vertical ${
              leftPlayer.id === gameState.currentPlayerId 
                ? 'text-retro-gold animate-turn-pulse' 
                : 'text-retro-cream/60'
            } ${!leftPlayer.connected ? 'opacity-50' : ''}`}>
              {leftPlayer.name}
              {!leftPlayer.connected && ' 📵'}
              {leftPlayer.id === gameState.currentPlayerId && ' ◄'}
            </p>
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: leftPlayer.hand.length }).map((_, i) => (
                <CardBack key={i} small />
              ))}
            </div>
          </div>
        )}

        {/* Center area - trick or action panel */}
        <div className="flex-1 flex items-center justify-center max-w-xs">
          {gameState.phase === 'bidding' && (
            <BiddingPanel
              bidState={gameState.bidState}
              playerId={playerId}
              currentCallerName={gameState.players.find(p => p.id === gameState.bidState.bidderId)?.name ?? null}
              hasPassed={gameState.bidState.passed.has(playerId)}
              onBid={handleBid}
              onPass={handlePass}
              onPreselectTrump={handlePreselectTrump}
            />
          )}

          {gameState.phase === 'calling' && (
            <TrumpSelector
              isCurrentPlayer={isCurrentPlayer}
              onSelectTrump={handleSetTrump}
              onCallThunee={handleCallThunee}
            />
          )}

          {(gameState.phase === 'playing' || gameState.phase === 'trick-complete') && (
            <div className="space-y-2">
              <TrickArea
                trick={gameState.currentTrick}
                players={gameState.players}
                showingResult={gameState.phase === 'trick-complete'}
              />

              {/* Jodhi button - only for winning team after trick */}
              {canCallJodhi() && currentPlayer && (
                <JodhiButton
                  calledJodhiSuits={myCalledJodhiSuits}
                  onCallJodhi={handleCallJodhi}
                  disabled={false}
                />
              )}

              {/* Challenge button - available during play for non-spectators */}
              {!isSpectator && opponents.length > 0 && (
                <div className="text-center">
                  <button
                    onClick={() => setShowChallengeModal(true)}
                    className="btn-danger text-xs"
                  >
                    ⚡ CHALLENGE
                  </button>
                </div>
              )}
            </div>
          )}

          {gameState.phase === 'round-end' && (
            <div className="card-container p-4 text-center space-y-3">
              <p className="font-retro text-xs text-retro-black">ROUND OVER</p>
              <p className="font-mono text-sm text-retro-black">
                T1: {gameState.teams[0].cardPoints} | T2: {gameState.teams[1].cardPoints}
              </p>
              <button
                onClick={() => onAction({ type: 'start' })}
                className="btn-retro text-xs"
              >
                NEXT ROUND
              </button>
            </div>
          )}

          {gameState.phase === 'game-over' && (
            <div className="card-container p-4 text-center space-y-3">
              <p className="font-retro text-sm text-retro-gold">GAME OVER</p>
              <p className="font-mono text-sm text-retro-black">
                {gameState.teams[0].balls >= 13 
                  ? `${gameState.players.filter(p => p.team === 0).map(p => p.name).join(' & ')} WIN!`
                  : `${gameState.players.filter(p => p.team === 1).map(p => p.name).join(' & ')} WIN!`
                }
              </p>
            </div>
          )}
        </div>

        {/* Right opponent (4p only) */}
        {rightPlayer && (
          <div className="flex flex-col items-center shrink-0">
            <p className={`font-mono text-xs mb-1 ${
              rightPlayer.id === gameState.currentPlayerId 
                ? 'text-retro-gold animate-turn-pulse' 
                : 'text-retro-cream/60'
            } ${!rightPlayer.connected ? 'opacity-50' : ''}`}>
              {rightPlayer.name}
              {!rightPlayer.connected && ' 📵'}
              {rightPlayer.id === gameState.currentPlayerId && ' ◄'}
            </p>
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: rightPlayer.hand.length }).map((_, i) => (
                <CardBack key={i} small />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Player's hand - always visible */}
      {currentPlayer && !isSpectator && (
        <div className="shrink-0 pb-2">
          <p className={`text-center font-mono text-xs mb-1 ${
            isCurrentPlayer ? 'text-retro-gold animate-turn-pulse' : 'text-retro-cream/60'
          }`}>
            {currentPlayer.name} {isCurrentPlayer && '(Your turn)'}
          </p>
          <PlayerHand
            cards={currentPlayer.hand}
            onPlayCard={handlePlayCard}
            isCurrentPlayer={isCurrentPlayer && gameState.phase === 'playing'}
            disabled={gameState.phase !== 'playing'}
          />
        </div>
      )}

        {/* Trick result toast */}
        {gameState.lastTrickResult && (
          <TrickResultToast result={gameState.lastTrickResult} />
        )}

        {/* Thunee indicator */}
        {gameState.thuneeCallerId && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                          font-retro text-4xl text-retro-gold animate-pulse pointer-events-none">
            THUNEE!
          </div>
        )}

        {/* Challenge modal */}
        {showChallengeModal && (
          <ChallengeModal
            opponents={opponents}
            jodhiCalls={opponentJodhiCalls}
            onChallengePlay={handleChallengePlay}
            onChallengeJodhi={handleChallengeJodhi}
            onClose={() => setShowChallengeModal(false)}
          />
        )}

        {/* Challenge result modal */}
        {gameState.challengeResult && !dismissedChallengeResult && (
          <ChallengeResultModal
            result={gameState.challengeResult}
            players={gameState.players}
            onDismiss={() => setDismissedChallengeResult(true)}
          />
        )}
      </div>
    </div>
  )
}
