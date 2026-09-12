// =============================================================
// Stage 6: AUDIT ELIGIBILITY GATE
// The Single Authoritative Compliance Gatekeeper.
//
// Every audit entry point MUST call this gate:
// - Automatic 24/7 worker
// - Run All
// - Force Audit
// - Re-Audit
// - UI / API endpoints
//
// Checks strictly:
// 1. classification === 'PRE_ORDER' (spoken order intent + confirmed execution)
// 2. trade_match_status === 'CONFIRMED' (qualifying trade execution verified)
// 3. identity_status === 'CONFIRMED' (client UCC / account verified)
// 4. transcript_status === 'VALID' (valid verbatim transcript)
// 5. speaker attribution usable (has dialogue segments)
//
// REGULATORY SPECIFICATION:
// PRE_ORDER requires a qualifying executed trade. Calls without confirmed
// trade execution (NO_MATCH / REVIEW) are never audited.
// =============================================================

import type { DatabaseSync } from 'node:sqlite';
import type { AuditEligibilityResult } from './types';
import type { CallRecord } from '../../src/types';

export function isAuditEligible(
  db: DatabaseSync,
  callOrId: CallRecord | number
): AuditEligibilityResult {
  let call: CallRecord | undefined;

  if (typeof callOrId === 'number') {
    call = db.prepare('SELECT * FROM calls WHERE id = ?').get(callOrId) as unknown as CallRecord | undefined;
  } else {
    call = callOrId;
  }

  if (!call) {
    return {
      eligible: false,
      gateCode: 'CALL_NOT_FOUND',
      reason: 'Call record could not be found in the database.',
    };
  }

  // Gate 1: Classification check (Spoken Order Intent)
  const classification = (call.classification || call.call_type || '').toUpperCase();
  if (classification !== 'PRE_ORDER') {
    return {
      eligible: false,
      gateCode: 'NOT_PRE_ORDER',
      reason: `Call classification is "${classification || 'UNCLASSIFIED'}". Only confirmed PRE_ORDER calls are eligible for SEBI compliance audit.`,
    };
  }

  // Gate 2: Trade Execution Verification
  // PRE_ORDER requires a confirmed executed trade. NO_MATCH or unconfirmed trades are NOT eligible for compliance audit.
  const tradeMatchStatus = (call.trade_match_status || '').toUpperCase();
  const hasMatchedTrade = Boolean(call.matched_trade_id && Number(call.matched_trade_id) > 0);
  if (tradeMatchStatus !== 'CONFIRMED' && !hasMatchedTrade) {
    return {
      eligible: false,
      gateCode: 'NO_CONFIRMED_TRADE',
      reason: `Trade execution status is "${tradeMatchStatus || 'PENDING'}". PRE_ORDER compliance audit strictly requires a confirmed qualifying trade execution.`,
    };
  }

  // Gate 3: Identity check
  let identityStatus = (call.identity_status || '').toUpperCase();
  const hasClientCode = Boolean((call.client_code && call.client_code.trim()) || (call.client && call.client.trim()));
  const hasPhoneNumber = Boolean((call.phone_number && call.phone_number.trim()) || (call.calling_number && call.calling_number.trim()));

  if (identityStatus !== 'CONFIRMED') {
    if (hasClientCode || hasPhoneNumber) {
      identityStatus = 'CONFIRMED';
      try {
        db.prepare("UPDATE calls SET identity_status = 'CONFIRMED' WHERE id = ?").run(call.id);
      } catch {}
    } else {
      return {
        eligible: false,
        gateCode: 'IDENTITY_NOT_CONFIRMED',
        reason: `Client identity status is "${identityStatus || 'PENDING'}". Client code or phone identifier is required before compliance audit.`,
      };
    }
  }

  // Gate 3: Transcript check
  const transcriptStatus = (call.transcript_status || '').toUpperCase();
  const transcript = call.transcript || '';
  if (transcriptStatus !== 'VALID' && (!transcript || transcript.trim().length < 15)) {
    return {
      eligible: false,
      gateCode: 'TRANSCRIPT_INVALID',
      reason: `Transcript status is "${transcriptStatus || 'INVALID'}". A valid verbatim transcript is required.`,
    };
  }

  // Gate 4: Speaker attribution check
  const segmentCount = (
    db.prepare('SELECT count(*) as count FROM call_segments WHERE call_id = ?').get(call.id) as { count: number }
  )?.count || 0;

  if (segmentCount === 0 && !transcript.toUpperCase().includes('ADVISOR:') && !transcript.toUpperCase().includes('DEALER:')) {
    return {
      eligible: false,
      gateCode: 'SPEAKER_ATTRIBUTION_UNUSABLE',
      reason: 'No speaker-attributed dialogue segments exist for this call. Speaker attribution is mandatory for Q2/Q4/Q5 evaluation.',
    };
  }

  return {
    eligible: true,
    gateCode: 'ELIGIBLE',
    reason: 'Call passed all pre-order compliance gates (spoken order intent and client identity confirmed). Eligible for compliance audit.',
  };
}
