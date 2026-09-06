// =============================================================
// AuditEQ v18.0.0 — Deterministic Compliance & Evidence Auditor
//
// Hard Audit Eligibility Gate:
// - NO Advisor -> NO audit
// - NO Client ID / UCC -> NO audit
// - NO exact trade -> NO audit
// - NO valid transcript -> NO audit
// - ONLY confirmed PRE-ORDER calls enter audit
// =============================================================

import {
  extractSpokenEvidence,
  type ExtractedCallEvidence,
  type SegmentInfo,
} from './evidence-extractor';
import {
  normalizePhoneNumber,
  normalizeClientCode,
  matchClientCodeInTranscript,
  matchSymbolInTranscript,
  matchPriceInTranscript,
  matchQuantityInTranscript,
  mentionsMarketPriceOrCMP,
  SYMBOL_ALIASES,
} from './normalizer';
import type { CallRecord, TradeRecord } from '../src/types';
import type { UnifiedAuditOutput, AuditQuestionOutput } from './scoring-engine';

export interface AuditEligibilityResult {
  eligible: boolean;
  reason: string;
  gateCode: 'NO_ADVISOR' | 'NO_CLIENT_CODE' | 'NO_EXACT_TRADE' | 'NO_VALID_TRANSCRIPT' | 'NOT_PRE_ORDER' | 'OK';
}

/**
 * Hard Audit Eligibility Gate
 * Strictly enforces that incomplete, unassigned, or non-preorder records NEVER enter audit.
 */
export function verifyAuditEligibility(
  call: CallRecord,
  trade: TradeRecord | null,
  transcript?: string | null
): AuditEligibilityResult {
  // Gate 1: Must be confirmed PRE-ORDER call (REGULAR, SCRAP, REVIEW, FAILED, UNKNOWN never enter audit)
  if (!call.call_type || call.call_type !== 'pre_order') {
    return {
      eligible: false,
      reason: `Call category is "${call.call_type || 'unclassified'}". Only confirmed PRE-ORDER calls enter SEBI regulatory compliance audit.`,
      gateCode: 'NOT_PRE_ORDER',
    };
  }

  // Gate 2: Advisor Name must be present and resolved
  const advisor = (call.caller_name || '').trim();
  if (!advisor || advisor === '—' || advisor.toLowerCase() === 'unknown' || advisor.toLowerCase() === 'unassigned') {
    return {
      eligible: false,
      reason: 'No advisor/caller identity specified in call metadata. Pre-order audits require an identified advisor.',
      gateCode: 'NO_ADVISOR',
    };
  }

  // Gate 3: Client ID / UCC must exist and be resolved
  const clientCode = (call.client || trade?.client || '').trim();
  if (!clientCode || clientCode === '—' || clientCode.toLowerCase() === 'unknown' || clientCode.toLowerCase() === 'unassigned') {
    return {
      eligible: false,
      reason: 'No Client ID / UCC available in call metadata or trade sheet.',
      gateCode: 'NO_CLIENT_CODE',
    };
  }

  // Gate 4: Valid transcript must exist
  const transText = (transcript || call.transcript || '').trim();
  if (!transText || transText.length < 15) {
    return {
      eligible: false,
      reason: 'No valid transcript available for spoken evidence verification.',
      gateCode: 'NO_VALID_TRANSCRIPT',
    };
  }

  // Gate 5: Exact trade must exist and be confirmed
  if (!trade || !trade.id) {
    return {
      eligible: false,
      reason: 'Missing exact trade match. Pre-order calls cannot be audited without a verified trade match.',
      gateCode: 'NO_EXACT_TRADE',
    };
  }

  return {
    eligible: true,
    reason: 'Call satisfies all SEBI compliance audit eligibility gates.',
    gateCode: 'OK',
  };
}

/**
 * Deterministically evaluates Q1–Q5 based ONLY on actual spoken evidence
 * and reference trade data (used for comparison/validation, never as synthetic proof).
 */
export function evaluateEvidenceCompliance(
  call: CallRecord,
  tradesOrResolved: TradeRecord[] | TradeRecord | null,
  transcript: string,
  segments: SegmentInfo[] = [],
  authoritativeClientCode?: string | null
): { audit: UnifiedAuditOutput; evidence: ExtractedCallEvidence } {
  // Authoritative resolved trade (single trade, never arbitrary trades[0] fallback)
  const resolvedTrade: TradeRecord | null = Array.isArray(tradesOrResolved)
    ? (tradesOrResolved.length === 1 ? tradesOrResolved[0] : (tradesOrResolved.find((t) => t && t.id) || null))
    : tradesOrResolved;

  const extracted = extractSpokenEvidence(transcript, segments, resolvedTrade || undefined);

  // -------------------------------------------------------------
  // Q1: Authoritative Phone Number / Customer Authentication
  // RULE: Caller ID / Calling Number vs Registered Number
  // Registered phone number is provided in metadata or in the uploaded trade details sheet
  // If registered identity matches calling CLI: PASS
  // If mismatch: FATAL
  // If either number is missing: REVIEW
  // -------------------------------------------------------------
  const callingRaw = call.calling_number || call.phone_number || '';
  const registeredRaw = call.registered_number || resolvedTrade?.client_number || resolvedTrade?.phone_number || '';

  const cleanCalling = normalizePhoneNumber(callingRaw);
  const cleanRegistered = normalizePhoneNumber(registeredRaw);

  let q1: AuditQuestionOutput;

  if (!cleanRegistered) {
    q1 = {
      status: 'REVIEW',
      evidence: 'Registered phone number not found in call metadata or trade sheet.',
      reason: 'Registered phone number not available for verification.',
      speaker: 'ADVISOR',
      confidence: 0.90,
    };
  } else if (!cleanCalling || cleanCalling.length < 10) {
    q1 = {
      status: 'REVIEW',
      evidence: `Calling telephone line CLI (${callingRaw || 'Missing'}) unavailable.`,
      reason: 'Telephony CLI record missing.',
      speaker: 'ADVISOR',
      confidence: 0.90,
    };
  } else {
    // Both calling and registered number exist -> exact 10-digit comparison
    const calling10 = cleanCalling.slice(-10);
    const registered10 = cleanRegistered.slice(-10);
    const hasSpokenOtpOrAuth = /\b(?:otp\s*(?:is|code|verification|verified|confirmed|entered)?\s*[:\-]?\s*\d{4,6}|verified\s+(?:via\s+)?otp|otp\s+verified|authenticated\s+via\s+otp|security\s*questions?\s*(?:verified|answered|passed))\b/i.test(transcript);

    if (calling10 === registered10) {
      q1 = {
        status: 'PASS',
        evidence: `Calling CLI (${calling10}) matches registered records (${registered10}) exactly.`,
        reason: 'Authorized calling telephone line validated.',
        speaker: 'ADVISOR',
        confidence: 1.0,
      };
    } else if (hasSpokenOtpOrAuth) {
      q1 = {
        status: 'PASS',
        evidence: `Calling line mismatch (${cleanCalling} vs registered ${cleanRegistered}), but verbal OTP/security authorization was successfully authenticated in conversation.`,
        reason: 'Authorized via spoken OTP / security verification.',
        speaker: 'ADVISOR',
        confidence: 0.98,
      };
    } else {
      q1 = {
        status: 'FAIL',
        evidence: `FATAL: Calling CLI (${cleanCalling}) does not match registered contact (${cleanRegistered}) and no spoken OTP/authorization was verified.`,
        reason: 'Unregistered telephone line without authorization match.',
        speaker: 'ADVISOR',
        confidence: 1.0,
      };
    }
  }

  // -------------------------------------------------------------
  // Q2: Client Identification / Spoken UCC Code Confirmation
  // RULE: Expected client code -> spoken candidate -> normalize -> compare
  // If spoken matches expected: PASS
  // If spoken code exists but mismatches expected: FATAL
  // If no client code was spoken: FATAL
  // If ASR uncertain or no expected code: REVIEW
  // -------------------------------------------------------------
  const expectedClientCode = (authoritativeClientCode || call.client || resolvedTrade?.client || '').trim();
  let q2: AuditQuestionOutput;

  if (expectedClientCode) {
    const normExpected = normalizeClientCode(expectedClientCode);
    const transcriptMatch = matchClientCodeInTranscript(expectedClientCode, transcript);

    // Also check if any other client code was detected in dialogue
    const spokenCodeCandidate = extracted.detectedClientCode?.normalized_value || null;

    if (transcriptMatch.matched) {
      q2 = {
        status: 'PASS',
        evidence: `Client UCC code "${expectedClientCode}" verified in spoken conversation.`,
        reason: 'Client identification verbally confirmed prior to order execution.',
        speaker: 'ADVISOR',
        confidence: 0.98,
      };
    } else if (spokenCodeCandidate && spokenCodeCandidate !== normExpected) {
      q2 = {
        status: 'FAIL',
        evidence: `FATAL: Spoken client code "${spokenCodeCandidate}" mismatches expected registered client code "${expectedClientCode}".`,
        reason: 'Spoken client identification contradicts trade registry records.',
        speaker: 'ADVISOR',
        confidence: 0.95,
      };
    } else {
      // Client code was not spoken at all in the call
      q2 = {
        status: 'FAIL',
        evidence: `FATAL: Client code / UCC "${expectedClientCode}" was not spoken or confirmed in the dialogue before order placement.`,
        reason: 'Client code not explicitly confirmed in pre-order call.',
        speaker: 'ADVISOR',
        confidence: 0.95,
      };
    }
  } else {
    q2 = {
      status: 'REVIEW',
      evidence: 'No expected client code available in call or trade records to verify.',
      reason: 'Expected client code missing from metadata.',
      speaker: 'ADVISOR',
      confidence: 0.85,
    };
  }

  // -------------------------------------------------------------
  // Q3: Explicit Order Verification (Stock, Price, Quantity)
  // RULE: Non-fatal (-1 mark). Stock + Qty + Price/CMP required.
  // -------------------------------------------------------------
  let q3: AuditQuestionOutput;

  // Stock symbol check
  let stockMatches = false;
  let stockSpokenDetail = '';
  if (resolvedTrade?.symbol) {
    const symRes = matchSymbolInTranscript(resolvedTrade.symbol, transcript);
    if (symRes.matched) {
      stockMatches = true;
      stockSpokenDetail = symRes.matchedAlias;
    } else {
      const otherStock = extracted.detectedSymbols[0]?.normalized_value;
      stockSpokenDetail = otherStock ? `Spoken: "${otherStock}" (Expected: "${resolvedTrade.symbol}")` : `Not spoken (Expected: "${resolvedTrade.symbol}")`;
    }
  } else {
    // Check known aliases or detected symbols
    const lowerT = transcript.toLowerCase();
    for (const [symKey, aliases] of Object.entries(SYMBOL_ALIASES)) {
      for (const alias of aliases) {
        if (lowerT.includes(alias.toLowerCase())) {
          stockMatches = true;
          stockSpokenDetail = symKey;
          break;
        }
      }
      if (stockMatches) break;
    }
    if (!stockMatches && extracted.detectedSymbols.length > 0) {
      stockMatches = true;
      stockSpokenDetail = String(extracted.detectedSymbols[0].normalized_value);
    }
  }

  // Quantity check
  let qtyMatches = false;
  let qtySpokenDetail = '';
  if (resolvedTrade?.quantity && resolvedTrade.quantity > 0) {
    if (matchQuantityInTranscript(resolvedTrade.quantity, transcript)) {
      qtyMatches = true;
      qtySpokenDetail = `${resolvedTrade.quantity} shares/lots`;
    } else {
      const otherQty = extracted.detectedQuantities[0]?.normalized_value;
      qtySpokenDetail = otherQty ? `Spoken: ${otherQty} (Expected: ${resolvedTrade.quantity})` : `Not spoken (Expected: ${resolvedTrade.quantity})`;
    }
  } else {
    const qtyMatch = transcript.match(/\b(\d+)\s*(?:shares?|lots?|qty|quantity)\b/i);
    if (qtyMatch) {
      qtyMatches = true;
      qtySpokenDetail = `${qtyMatch[1]} shares`;
    } else if (extracted.detectedQuantities.length > 0) {
      qtyMatches = true;
      qtySpokenDetail = `${extracted.detectedQuantities[0].normalized_value} shares`;
    }
  }

  // Price check (explicit price OR verbal CMP)
  let priceMatches = false;
  let priceSpokenDetail = '';
  const isCmp = mentionsMarketPriceOrCMP(transcript) || extracted.hasCmpMention;

  if (isCmp) {
    priceMatches = true;
    priceSpokenDetail = 'Current Market Price (CMP)';
  } else if (resolvedTrade?.price && (matchPriceInTranscript(resolvedTrade.price, transcript) || new RegExp(`\\b${resolvedTrade.price}\\b`).test(transcript))) {
    priceMatches = true;
    priceSpokenDetail = `₹${resolvedTrade.price}`;
  } else if (extracted.detectedPrices.length > 0) {
    priceMatches = true;
    priceSpokenDetail = `₹${extracted.detectedPrices[0].normalized_value}`;
  } else {
    const priceMatch = transcript.match(/\b(?:at|pe|rate|price|rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\b/i);
    if (priceMatch) {
      priceMatches = true;
      priceSpokenDetail = `₹${priceMatch[1]}`;
    }
  }

  const mismatches: string[] = [];
  if (!stockMatches) mismatches.push('Stock symbol');
  if (!qtyMatches) mismatches.push('Quantity');
  if (!priceMatches) mismatches.push('Price/CMP');

  if (mismatches.length === 0) {
    q3 = {
      status: 'PASS',
      evidence: `Stock: ${stockSpokenDetail} | Quantity: ${qtySpokenDetail} | Execution Price: ${priceSpokenDetail}. All order parameters verified.`,
      reason: 'Stock, Quantity, and Price/CMP all confirmed in dialogue.',
      speaker: 'ADVISOR',
      confidence: 1.0,
    };
  } else {
    q3 = {
      status: 'FAIL',
      evidence: `Order verification discrepancy (-1 mark, non-fatal). Mismatches: ${mismatches.join(', ')}. [Stock: ${stockSpokenDetail || 'Missing'}, Qty: ${qtySpokenDetail || 'Missing'}, Price: ${priceSpokenDetail || 'Missing'}].`,
      reason: `Mandatory order attributes (${mismatches.join(', ')}) not fully confirmed.`,
      speaker: 'ADVISOR',
      confidence: 0.95,
    };
  }

  // -------------------------------------------------------------
  // Q4: Customer Acknowledgement (DISABLED BY DEFAULT PER POLICY)
  // Standard regulatory offline audit evaluates Q1, Q2, Q3, Q5 only.
  // Q4 is disabled by default (status: NOT_AUDITED).
  // No fabricated quotes or synthetic passes.
  // -------------------------------------------------------------
  const hasNegativeAck = /\b(?:cancel|don'?t buy|do not buy|nahi\s+cancel|reject|mat\s+(?:karo|bhejo|lagao)|nahi\s+chahiye|mana\s+kiya)\b/i.test(transcript);

  let q4: AuditQuestionOutput;
  if (hasNegativeAck) {
    q4 = {
      status: 'FAIL',
      evidence: 'Customer negative acknowledgement or order cancellation detected in conversation.',
      reason: 'Customer declined or cancelled the trade authorization.',
      speaker: 'CLIENT',
      confidence: 1.0,
    };
  } else {
    q4 = {
      status: 'NOT_AUDITED',
      evidence: 'Q4 Customer Acknowledgement disabled by regulatory default (Auditing Q1, Q2, Q3, Q5 only).',
      reason: 'Control disabled by policy.',
      speaker: 'CLIENT',
      confidence: 1.0,
    };
  }

  // -------------------------------------------------------------
  // Q5: Return Commitment & Guarantee Prohibition
  // RULE: Check if ADVISOR gave guarantee of return, profit, or recovery.
  // Must understand context and negation.
  // If affirmative guarantee found -> FATAL (Score 0).
  // Else -> PASS.
  // -------------------------------------------------------------
  const retItem = extracted.detectedReturnCommitment;
  const lowerT = transcript.toLowerCase();

  // Negation & Risk Disclaimers (e.g. "cannot guarantee", "no returns are guaranteed", "subject to market risks")
  const hasNegationOrRiskDisclaimer =
    /\b(?:cannot|can't|do\s+not|don't|never|no|not)\s+(?:give\s+any\s+)?guarantee\b/i.test(lowerT) ||
    /\bguarantee\s+(?:nahi\s+hai|nahi\s+hota|nahi\s+hoga|nahi\s+de\s+sakte)\b/i.test(lowerT) ||
    /\bsubject\s+to\s+market\s+risks?\b/i.test(lowerT) ||
    /\bno\s+guaranteed\s+(?:returns?|profit)\b/i.test(lowerT) ||
    /\bmarket\s+risk\s+hai\b/i.test(lowerT);

  const hasAffirmativeGuarantee =
    (retItem?.normalized_value === 'FAIL' && !hasNegationOrRiskDisclaimer) ||
    /\bguaranteed\s+(?:\d+%\s+)?(?:return|profit|gain|target|income)\b/i.test(lowerT) ||
    /\b(?:will\s+(?:definitely\s+)?(?:give|get|make|recover|double)|definitely\s+(?:give|get|make|recover|double))\s+(?:profit|return|returns|recovery|gain)\b/i.test(lowerT) ||
    /\b(?:guarantee\s+hai|pakka\s+profit|fixed\s+profit|guaranteed\s+return|guaranteed\s+profit|100%\s+safe\s+double|risk\s*free\s+return)\b/i.test(lowerT) ||
    /\b(?:sure\s+shot\s+profit|definitely\s+double|loss\s+nahi\s+hoga|paisa\s+banega\s+hi\s+banega|recovery\s+hoga\s+hi\s+hoga)\b/i.test(lowerT);

  let q5: AuditQuestionOutput;
  if (hasAffirmativeGuarantee && !hasNegationOrRiskDisclaimer) {
    q5 = {
      status: 'FAIL',
      evidence: `FATAL: Prohibited verbal return or recovery guarantee made by advisor: "${retItem?.exact_quote || 'Guaranteed return/recovery stated'}".`,
      reason: 'Advisor made impermissible verbal return or profit guarantees.',
      speaker: 'ADVISOR',
      confidence: 1.0,
    };
  } else {
    q5 = {
      status: 'PASS',
      evidence: hasNegationOrRiskDisclaimer
        ? 'Advisor properly stated market risk disclaimer. No return or profit guarantee made.'
        : 'Advisor made zero return or profit guarantees. Fully compliant with SEBI regulations.',
      reason: 'No prohibited return commitments identified in advisor dialogue.',
      speaker: 'ADVISOR',
      confidence: 1.0,
    };
  }

  return {
    audit: {
      q1,
      q2,
      q3,
      q4,
      q5,
      model: 'deterministic-audit-v18.0.0',
    },
    evidence: extracted,
  };
}
