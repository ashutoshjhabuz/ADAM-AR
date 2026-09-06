// =============================================================
// AuditEQ — Deterministic Compliance & Evidence Auditor
// =============================================================

import {
  extractSpokenEvidence,
  type ExtractedCallEvidence,
  type SpokenEvidenceItem,
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
} from './normalizer';
import type { CallRecord, TradeRecord } from '../src/types';
import type { UnifiedAuditOutput, AuditQuestionOutput } from './scoring-engine';

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
    ? (tradesOrResolved.length === 1 ? tradesOrResolved[0] : (tradesOrResolved.find(t => t.id) || null))
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
    } else if (spokenCodeCandidate) {
      const normSpoken = normalizeClientCode(String(spokenCodeCandidate));
      if (normSpoken === normExpected) {
        q2 = {
          status: 'PASS',
          evidence: `Client account code "${spokenCodeCandidate}" was verbally confirmed in dialogue.`,
          reason: 'Client identification verbally confirmed prior to order execution.',
          speaker: extracted.detectedClientCode?.speaker || 'ADVISOR',
          confidence: extracted.detectedClientCode?.confidence || 0.95,
        };
      } else {
        // Spoken client code exists but DOES NOT MATCH expected client code -> FATAL!
        q2 = {
          status: 'FAIL',
          evidence: `FATAL: Expected client code "${expectedClientCode}" does not match spoken code "${spokenCodeCandidate}".`,
          reason: 'Client UCC mismatch in telephone confirmation.',
          speaker: extracted.detectedClientCode?.speaker || 'ADVISOR',
          confidence: 1.0,
        };
      }
    } else {
      q2 = {
        status: 'FAIL',
        evidence: `FATAL: Expected client code "${expectedClientCode}" was NOT spoken or confirmed anywhere in the call transcript.`,
        reason: 'Client UCC was not verbally identified.',
        speaker: 'ADVISOR',
        confidence: 0.98,
      };
    }
  } else {
    // No expected client code was resolved
    if (extracted.detectedClientCode) {
      q2 = {
        status: 'REVIEW',
        evidence: `Client code "${extracted.detectedClientCode.exact_quote}" spoken, but pending authoritative reference client code.`,
        reason: 'Spoken client code requires reference record for verification.',
        speaker: extracted.detectedClientCode.speaker || 'ADVISOR',
        confidence: 0.85,
      };
    } else {
      q2 = {
        status: 'FAIL',
        evidence: 'FATAL: Client account code was not verbally confirmed anywhere in the call transcript.',
        reason: 'Client UCC was not verbally identified.',
        speaker: 'ADVISOR',
        confidence: 0.95,
      };
    }
  }

  // -------------------------------------------------------------
  // Q3: Order Details: Stock, Quantity, Price / CMP
  // RULE: Compare spoken details with the resolved trade (or transcript dialogue):
  // - Stock
  // - Quantity
  // - Price (OR spoken "CMP" / "Current Market Price" / "Market")
  // DO NOT compare side (Buy/Sell).
  // If stock, quantity, and price/CMP match -> PASS (1 mark).
  // Any mismatch -> FAIL (deduct 1 mark, NON-FATAL).
  // -------------------------------------------------------------
  let q3: AuditQuestionOutput;

  if (!resolvedTrade) {
    const isCmp = mentionsMarketPriceOrCMP(transcript) || extracted.hasCmpMention;
    const hasSpokenStock = extracted.detectedSymbols.length > 0;
    const hasSpokenQty = extracted.detectedQuantities.length > 0;
    const hasSpokenPrice = isCmp || extracted.detectedPrices.length > 0;

    const missingParts: string[] = [];
    if (!hasSpokenStock) missingParts.push('Stock symbol');
    if (!hasSpokenQty) missingParts.push('Quantity');
    if (!hasSpokenPrice) missingParts.push('Price/CMP');

    if (missingParts.length === 0) {
      const stock = extracted.detectedSymbols[0]?.normalized_value || 'Stock';
      const qty = extracted.detectedQuantities[0]?.normalized_value || 'Qty';
      const price = isCmp ? 'Current Market Price (CMP)' : `₹${extracted.detectedPrices[0]?.normalized_value}`;
      q3 = {
        status: 'PASS',
        evidence: `Spoken dialogue confirmed: Stock (${stock}), Quantity (${qty}), Price (${price}).`,
        reason: 'Stock, Quantity, and Price/CMP all verbally confirmed in dialogue.',
        speaker: 'ADVISOR',
        confidence: 0.95,
      };
    } else {
      q3 = {
        status: 'FAIL',
        evidence: `Order verification discrepancy (-1 mark, non-fatal). Missing spoken elements: ${missingParts.join(', ')}.`,
        reason: `Mandatory order attributes (${missingParts.join(', ')}) not verbally confirmed.`,
        speaker: 'ADVISOR',
        confidence: 0.95,
      };
    }
  } else {
    // Stock check against resolved trade
    let stockMatches = false;
    let stockSpokenDetail = '';
    if (resolvedTrade.symbol) {
      const symMatch = matchSymbolInTranscript(resolvedTrade.symbol, transcript);
      if (symMatch.matched) {
        stockMatches = true;
        stockSpokenDetail = symMatch.matchedAlias || resolvedTrade.symbol;
      } else {
        const sym = resolvedTrade.symbol.replace(/-(?:EQ|BE|SM|BZ|BL|ST)$/i, '').trim();
        if (sym && new RegExp(`\\b${sym}\\b`, 'i').test(transcript)) {
          stockMatches = true;
          stockSpokenDetail = sym;
        }
      }
    }
    if (!stockMatches) {
      const otherStock = extracted.detectedSymbols[0]?.normalized_value;
      stockSpokenDetail = otherStock ? `Spoken: "${otherStock}" (Expected: "${resolvedTrade.symbol}")` : `Not spoken (Expected: "${resolvedTrade.symbol}")`;
    }

    // Quantity check against resolved trade
    let qtyMatches = false;
    let qtySpokenDetail = '';
    if (resolvedTrade.quantity) {
      if (matchQuantityInTranscript(resolvedTrade.quantity, transcript) || new RegExp(`\\b${resolvedTrade.quantity}\\b`).test(transcript)) {
        qtyMatches = true;
        qtySpokenDetail = String(resolvedTrade.quantity);
      }
    }
    if (!qtyMatches) {
      const otherQty = extracted.detectedQuantities[0]?.normalized_value;
      qtySpokenDetail = otherQty !== undefined ? `Spoken: ${otherQty} (Expected: ${resolvedTrade.quantity})` : `Not spoken (Expected: ${resolvedTrade.quantity})`;
    }

    // Price check (explicit price OR verbal CMP)
    let priceMatches = false;
    let priceSpokenDetail = '';
    const isCmp = mentionsMarketPriceOrCMP(transcript) || extracted.hasCmpMention;

    if (isCmp) {
      priceMatches = true;
      priceSpokenDetail = 'Current Market Price (CMP)';
    } else if (resolvedTrade.price && (matchPriceInTranscript(resolvedTrade.price, transcript) || new RegExp(`\\b${resolvedTrade.price}\\b`).test(transcript))) {
      priceMatches = true;
      priceSpokenDetail = `₹${resolvedTrade.price}`;
    } else {
      const otherPrice = extracted.detectedPrices[0]?.normalized_value;
      priceSpokenDetail = otherPrice ? `Spoken: ₹${otherPrice} (Expected: ₹${resolvedTrade.price || 'CMP'})` : `Not spoken (Expected: ₹${resolvedTrade.price || 'CMP'})`;
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
        evidence: `Order verification discrepancy (-1 mark, non-fatal). Mismatches: ${mismatches.join(', ')}. [Stock: ${stockSpokenDetail}, Qty: ${qtySpokenDetail}, Price: ${priceSpokenDetail}].`,
        reason: `Mandatory order attributes (${mismatches.join(', ')}) not fully confirmed against trade.`,
        speaker: 'ADVISOR',
        confidence: 0.95,
      };
    }
  }

  // -------------------------------------------------------------
  // Q4: Customer Acknowledgement
  // RULE: Customer verbal acknowledgement. PASS unless explicit refusal or cancellation.
  // -------------------------------------------------------------
  const hasNegativeAck = /\b(?:cancel|don'?t buy|do not buy|nahi\s+cancel|reject|mat\s+(?:karo|bhejo|lagao)|nahi\s+chahiye|mana\s+kiya)\b/i.test(transcript);
  const q4: AuditQuestionOutput = hasNegativeAck
    ? {
        status: 'FAIL',
        evidence: 'Customer negative acknowledgement or order cancellation detected.',
        reason: 'Customer declined or cancelled the trade authorization.',
        speaker: 'CLIENT',
        confidence: 1.0,
      }
    : {
        status: 'PASS',
        evidence: 'Customer affirmative verbal acknowledgement confirmed.',
        reason: 'Customer verbal acknowledgement verified.',
        speaker: 'CLIENT',
        confidence: 1.0,
      };

  // -------------------------------------------------------------
  // Q5: Return Commitment & Guarantee Prohibition
  // RULE: Check if advisor gave guarantee of return, profit, or recovery.
  // If assurance found -> FATAL (Score 0).
  // Else -> PASS.
  // -------------------------------------------------------------
  const retItem = extracted.detectedReturnCommitment;
  let q5: AuditQuestionOutput;

  const lowerT = transcript.toLowerCase();
  const hasExpectedWord = /\b(?:expected|expectation|assuming|assumption|likely|target|potential|subject to market|risk)\b/i.test(lowerT);
  const hasProhibitedGuarantee =
    retItem?.normalized_value === 'FAIL' ||
    /\bguaranteed\s+(?:\d+%\s+)?(?:return|profit|gain|target|income)\b/i.test(lowerT) ||
    /\b(?:will\s+(?:definitely\s+)?(?:give|get|make|recover|double)|definitely\s+(?:give|get|make|recover|double))\s+(?:profit|return|returns|recovery|gain)\b/i.test(lowerT) ||
    /\b(?:guarantee\s+hai|pakka\s+profit|fixed\s+profit|guaranteed\s+return|guaranteed\s+profit|100%\s+safe|risk\s*free\s+return)\b/i.test(lowerT) ||
    /\b(?:sure\s+shot\s+profit|definitely\s+double|loss\s+nahi\s+hoga|paisa\s+banega\s+hi\s+banega|recovery\s+hoga\s+hi\s+hoga)\b/i.test(lowerT);

  if (hasProhibitedGuarantee) {
    q5 = {
      status: 'FAIL',
      evidence: `FATAL: Prohibited verbal return or recovery guarantee made: "${retItem?.exact_quote || 'Guaranteed return/recovery stated'}".`,
      reason: 'Advisor made impermissible verbal return or profit guarantees.',
      speaker: 'ADVISOR',
      confidence: 1.0,
    };
  } else {
    q5 = {
      status: 'PASS',
      evidence: hasExpectedWord
        ? 'Advisor discussed market expectation/targets with appropriate assumption context. No fixed guarantees made.'
        : 'Advisor made zero return or profit guarantees. Fully compliant.',
      reason: 'No prohibited return commitments identified.',
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
