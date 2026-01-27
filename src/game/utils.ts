// Re-export generic utilities from lib
export { generateGameCode, generatePlayerId } from '@/lib/utils'

export function getTeamForPlayer(playerIndex: number): 0 | 1 {
  // Players 0 and 2 are team 0, players 1 and 3 are team 1
  return (playerIndex % 2) as 0 | 1
}

export function getPartnerIndex(playerIndex: number, _playerCount: 4): number {
  return (playerIndex + 2) % 4
}

export function getNextPlayerIndex(currentIndex: number, playerCount: 2 | 4): number {
  // Counterclockwise (which in a 0,1,2,3 arrangement going down is +1)
  return (currentIndex + 1) % playerCount
}
