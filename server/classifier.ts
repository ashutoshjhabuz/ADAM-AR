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
  durationSeconds?: number
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
    if (durationSeconds !== undefined && durationSeconds > 0 && durationSeconds <= 10) {
      return {
        call_type: 'scrap',
        confidence: 0.90,
        evidence: `Silent or unrecorded audio with duration ${durationSeconds}s.`,
        reason: 'Scrap call: no spoken content and short duration.',
        is_scrap: true,
      };
    }
    return {
      call_type: 'scrap',
      confidence: 0.70,
      evidence: 'Audio transcript empty or too short for trading intent.',
      reason: 'Potential scrap call or un-transcribed recording.',
      is_scrap: true,
    };
  }

  const text = transcript.toLowerCase();

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

  // Count Pre-Order hits
  let preOrderHits = 0;
  const matchedPreOrderTerms: string[] = [];
  for (const term of PRE_ORDER_TERMS) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      preOrderHits++;
      matchedPreOrderTerms.push(term);
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

  // Decision Logic:
  // 1. Explicit pre-order cues with buying/selling/order execution intent
  if (preOrderHits > 0 && (preOrderHits >= regularHits || preOrderHits >= 2)) {
    return {
      call_type: 'pre_order',
      confidence: Math.min(0.98, 0.75 + preOrderHits * 0.05),
      evidence: `Pre-order trading markers identified: "${matchedPreOrderTerms.slice(0, 4).join('", "')}"`,
      reason: 'Call contains explicit pre-trade instructions, stock order parameters, or execution confirmation.',
    };
  }

  // 2. Regular call: advisor talking about stock market, recommendation, or issues without buying/selling
  if (regularHits > 0 && preOrderHits === 0) {
    return {
      call_type: 'regular',
      confidence: Math.min(0.95, 0.75 + regularHits * 0.05),
      evidence: `Regular market / advisory markers identified: "${matchedRegularTerms.slice(0, 4).join('", "')}"`,
      reason: 'Regular call: Advisor discussing market trends, recommendations, or customer issues without order placement.',
    };
  }

  if (preOrderHits > 0) {
    return {
      call_type: 'pre_order',
      confidence: 0.80,
      evidence: `Pre-order trading markers: "${matchedPreOrderTerms.join('", "')}"`,
      reason: 'Pre-order order execution parameters detected.',
    };
  }

  // Default to regular call if speech exists but no orders placed
  return {
    call_type: 'regular',
    confidence: 0.70,
    evidence: 'Conversation does not contain buy/sell transaction directives.',
    reason: 'Regular call: general discussion, advisory consultation, or account query.',
  };
}

