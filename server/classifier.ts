import { extractSpokenEvidence } from './evidence-extractor';
import { matchClientCodeInTranscript, matchPriceInTranscript, matchQuantityInTranscript, matchSymbolInTranscript, mentionsMarketPriceOrCMP } from './normalizer';
import type { TradeRecord } from '../src/types';

// =============================================================
// AuditEQ v17.0.30 — Call Intent & Category Classifier Engine
// Categorizes:
// 1. Pre-Order Call: Advisor talking about buying or selling stock
// 2. Regular Call: Market discussion, recommendations, queries, issues
// 3. Scrap Call: Voicemail, disconnect, <= 5-6s calls
// =============================================================

export type CallCategory = 'pre_order' | 'regular' | 'scrap' | 'non_pre_order' | 'review';

export interface PreOrderClassificationResult {
  call_type: CallCategory;
  confidence: number;
  evidence: string;
  reason: string;
  is_scrap?: boolean;
}

/**
 * Pre-order classification is based on the four entities spoken in the call,
 * not on isolated words such as "buy", "quantity", or "target".
 */
export function hasCompletePreOrderEvidence(transcript?: string | null, referenceTrades: TradeRecord[] = []): boolean {
  if (!transcript || transcript.trim().length < 10) return false;

  if (referenceTrades.some((trade) => {
    if (!trade.client || !trade.symbol || !trade.quantity || !trade.price) return false;
    return matchClientCodeInTranscript(trade.client, transcript).matched &&
      matchSymbolInTranscript(trade.symbol, transcript).matched &&
      matchQuantityInTranscript(trade.quantity, transcript) &&
      (matchPriceInTranscript(trade.price, transcript) || mentionsMarketPriceOrCMP(transcript));
  })) return true;

  const evidence = extractSpokenEvidence(transcript);
  const hasClientCode = Boolean(evidence.detectedClientCode);
  const hasStock = evidence.detectedSymbols.length > 0 ||
    /\b(?:nifty|bank\s*nifty|finnifty|sensex|mcx|stock|scrip|script)\b/i.test(transcript) ||
    /\b[A-Z]{2,}(?:[-/]?[A-Z0-9]{2,})?\b/.test(transcript);
  const hasQuantity = evidence.detectedQuantities.length > 0;
  const hasPrice = evidence.hasCmpMention || evidence.detectedPrices.length > 0;
  return hasClientCode && hasStock && hasQuantity && hasPrice;
}

// 1. Pre-order affirmative indicators (indicates order placement instructions before trade)
const PRE_ORDER_TERMS = [
  'buy', 'sell', 'purchase', 'place order', 'order place', 'execute', 'kharid', 'bech',
  'order laga', 'order daal', 'market price', 'limit order', 'shares', 'share', 'quantity', 'qty',
  'lot', 'lots', 'target', 'stop loss', 'sl', 'shall i execute', 'can i place',
  'confirming order', 'punching order', 'placing order', 'client code', 'account code',
  'punch kar do', 'buy kar lijiye', 'sell kar do', 'bhav pe', 'cmp', 'order executed',
];

// 2. Regular advisory / market talk / issues / queries indicators
const REGULAR_CALL_TERMS = [
  'market update', 'market view', 'recommendation', 'advisory', 'research report',
  'nifty', 'bank nifty', 'banknifty', 'sensex', 'bullish', 'bearish', 'trend',
  'portfolio', 'holding', 'holdings', 'balance', 'ledger', 'statement', 'contract note',
  'margin', 'fund transfer', 'payout', 'payin', 'app issue', 'login issue',
  'password reset', 'kyc', 'bank change', 'address update', 'technical issue',
  'any issue', 'how are you', 'calling to follow up', 'general query', 'quarterly result',
  'target price only', 'what is your view', 'should i hold', 'can hold',
];

// 3. Scrap / Voicemail / Disconnect indicators
const SCRAP_VOICEMAIL_TERMS = [
  'please leave a message', 'leave your message', 'after the tone', 'after the beep',
  'record your message', 'subscriber is busy', 'person you are calling', 'not answering',
  'currently unavailable', 'switched off', 'out of coverage area', 'network problem',
  'call disconnected', 'call ended', 'voicemail', 'mailbox is full', 'user is busy',
  'number you have dialed', 'dialed number does not exist', 'call rejected',
];

/**
 * Deterministically analyzes call audio metadata and transcripts to categorize into:
 * - 'pre_order': Buy / sell stock order placement
 * - 'regular': Market talk, advice, issue resolution without order
 * - 'scrap': Voicemail, disconnect, duration <= 5-6s
 */
export function classifyCallIntent(
  transcript?: string | null,
  durationSeconds?: number,
  referenceTrades: TradeRecord[] = []
): PreOrderClassificationResult {
  // Check 1: Duration <= 6 seconds is definitely a SCRAP call per user specification
  if (durationSeconds !== undefined && durationSeconds > 0 && durationSeconds <= 6) {
    return {
      call_type: 'scrap',
      confidence: 0.99,
      evidence: `Call duration is ${durationSeconds}s (less than 6 seconds threshold).`,
      reason: 'Scrap call: short disconnect or failed ring under 6 seconds.',
      is_scrap: true,
    };
  }

  if (!transcript || transcript.trim().length < 10) {
    // If no transcript or very short:
    if (durationSeconds !== undefined && durationSeconds > 0 && durationSeconds <= 6) {
      return {
        call_type: 'scrap',
        confidence: 0.90,
        evidence: `Silent or unrecorded audio with duration ${durationSeconds}s.`,
        reason: 'Scrap call: no spoken content and short duration.',
        is_scrap: true,
      };
    }
    return {
      call_type: 'review',
      confidence: 0.40,
      evidence: 'Transcript is missing or too short for reliable categorization.',
      reason: 'Pending transcription review; calls over 6 seconds are never classified as scrap.',
    };
  }

  const text = transcript.toLowerCase();

  if (hasCompletePreOrderEvidence(transcript, referenceTrades)) {
    return {
      call_type: 'pre_order',
      confidence: 0.99,
      evidence: 'Transcript contains client code, stock/index/contract, quantity/lot, and price/CMP.',
      reason: 'Complete pre-order entity set detected in the spoken transcript.',
    };
  }

  // Check 2: Voicemail / Automated system recording
  for (const vmTerm of SCRAP_VOICEMAIL_TERMS) {
    if (text.includes(vmTerm)) {
      return {
        call_type: 'scrap',
        confidence: 0.96,
        evidence: `Automated telephony / voicemail marker detected: "${vmTerm}".`,
        reason: 'Scrap call: Call reached automated voicemail or disconnected IVR prompt.',
        is_scrap: true,
      };
    }
  }

  // Count Regular Call hits
  let regularHits = 0;
  const matchedRegularTerms: string[] = [];
  for (const term of REGULAR_CALL_TERMS) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      regularHits++;
      matchedRegularTerms.push(term);
    }
  }

  // Any transcript without the complete four-entity set is regular dialogue.
  if (regularHits > 0) {
    return {
      call_type: 'regular',
      confidence: Math.min(0.95, 0.75 + regularHits * 0.05),
      evidence: `Regular market / advisory markers identified: "${matchedRegularTerms.slice(0, 4).join('", "')}"`,
      reason: 'Regular call: Advisor discussing market trends, recommendations, or customer issues without order placement.',
    };
  }

  return {
    call_type: 'regular',
    confidence: 0.70,
    evidence: 'Conversation does not contain buy/sell transaction directives.',
    reason: 'Regular call: general discussion, advisory consultation, or account query.',
  };
}

