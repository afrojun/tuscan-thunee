/**
 * AI module - Server-side AI player logic for Thunee.
 * 
 * This module provides decision-making capabilities for AI players,
 * including bidding, trump selection, and card play strategies.
 */

export { computeAIMove, getNextAIPlayer } from './decisions'
export { decideBid, chooseTrumpSuit, evaluateHand } from './bidding'
export { decidePlay, getValidCards } from './playing'
export type { AIDecision, HandStrength, SuitAnalysis } from './types'
