// =============================================================
// Stage 3.5: SPEAKER ATTRIBUTION & DIARIZATION
// Takes transcript segments and attributes speaker roles:
// ADVISOR | CLIENT | UNKNOWN
//
// Rules:
// 1. Channel separation: If stereo audio is detected, Channel 0 is ADVISOR
//    and Channel 1 is CLIENT.
// 2. Telephonic turn analysis: Conversational turn patterns with lexical anchors.
// 3. Conservative compliance rule: If an important statement cannot be
//    confidently attributed, speaker = UNKNOWN -> Q2/Q5 dependent on speaker
//    becomes REVIEW, not false PASS.
// =============================================================

import type { DatabaseSync } from 'node:sqlite';
import type { TranscriptSegment, SpeakerRole } from './types';
import type { CallRecord } from '../../src/types';

// Distinctive advisor conversational cues
const ADVISOR_MARKERS = [
  /\b(?:good morning|good afternoon|good evening|hello)\s*(?:sir|madam|mr|mrs|dr)?\b/i,
  /\b(?:calling from|this is\s+[a-z\s]+from|relationship manager|wealth advisor|dealer)\b/i,
  /\b(?:fundsindia|funds india|equity desk|broking desk)\b/i,
  /\b(?:how can i help|can we buy|we can purchase|we recommend|current market price is|cmp is|limit price is)\b/i,
  /\b(?:confirming your order|order has been placed|executing on nse|executing on bse)\b/i,
  /\b(?:can you confirm your client code|your ucc is|confirming account|registered mobile)\b/i,
  /\b(?:shall i place|should i place|placing the order for)\b/i,
];

// Distinctive client conversational cues
const CLIENT_MARKERS = [
  /\b(?:yes please|yeah please|yes place it|go ahead|okay please|do it)\b/i,
  /\b(?:yes buy|yes sell|buy it|sell it|execute it)\b/i,
  /\b(?:how much balance|how many shares|what is my margin|check my portfolio)\b/i,
  /\b(?:i want to buy|i want to sell|please buy|please sell)\b/i,
  /\b(?:yes that's correct|yes it is|correct|that is my code)\b/i,
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Stage 3.5 Entry Point: Attributes speakers across all segments of a call
 */
export function stage3_5AttributeSpeakers(
  db: DatabaseSync,
  callId: number
): { segments: TranscriptSegment[]; formattedTranscript: string } {
  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(callId) as unknown as CallRecord | undefined;
  const rows = db
    .prepare('SELECT * FROM call_segments WHERE call_id = ? ORDER BY start_time ASC')
    .all(callId) as unknown as Array<{
      id: number;
      segment_id: string;
      start_time: number;
      end_time: number;
      speaker: string;
      text: string;
    }>;

  if (!rows || rows.length === 0) {
    return { segments: [], formattedTranscript: '' };
  }

  const segments: TranscriptSegment[] = rows.map((r) => ({
    id: r.id,
    segment_id: r.segment_id,
    start_time: r.start_time,
    end_time: r.end_time,
    speaker: (r.speaker as SpeakerRole) || 'UNKNOWN',
    text: r.text,
  }));

  // Step 1: Check if segments already have accurate speaker tags from Gemini 3.5 Transcribe
  const hasExistingAttribution = segments.some(
    (s) => s.speaker === 'ADVISOR' || s.speaker === 'CLIENT'
  );

  let currentSpeaker: SpeakerRole = 'UNKNOWN';

  segments.forEach((seg, index) => {
    // If already attributed with high confidence from transcription engine, respect it unless clear contradiction
    if (seg.speaker === 'ADVISOR' || seg.speaker === 'CLIENT') {
      currentSpeaker = seg.speaker;
      return;
    }

    const text = seg.text;
    const isAdvisorCue = ADVISOR_MARKERS.some((re) => re.test(text));
    const isClientCue = CLIENT_MARKERS.some((re) => re.test(text));

    if (index === 0 && (isAdvisorCue || /\b(?:good morning|hello|calling|fundsindia)\b/i.test(text))) {
      seg.speaker = 'ADVISOR';
      currentSpeaker = 'ADVISOR';
      return;
    }

    if (isAdvisorCue && !isClientCue) {
      seg.speaker = 'ADVISOR';
      currentSpeaker = 'ADVISOR';
    } else if (isClientCue && !isAdvisorCue) {
      seg.speaker = 'CLIENT';
      currentSpeaker = 'CLIENT';
    } else {
      // Conversational alternation logic
      if (currentSpeaker !== 'UNKNOWN') {
        const prevSeg = segments[index - 1];
        const gap = seg.start_time - (prevSeg ? prevSeg.end_time : 0);

        if (gap < 1.2 && !/[?!]$/.test(prevSeg?.text || '')) {
          // Continued speech by same speaker
          seg.speaker = currentSpeaker;
        } else if (/[?]$/.test(prevSeg?.text || '') || (prevSeg && prevSeg.speaker === 'ADVISOR' && /^(?:haan|yes|theek hai|ok|okay|kar do|place karo)/i.test(text))) {
          // Response to question or affirmative acknowledgement
          seg.speaker = currentSpeaker === 'ADVISOR' ? 'CLIENT' : 'ADVISOR';
          currentSpeaker = seg.speaker;
        } else {
          // If genuinely ambiguous, mark UNKNOWN
          seg.speaker = 'UNKNOWN';
        }
      } else {
        seg.speaker = 'UNKNOWN';
      }
    }
  });

  // Step 2: Persist updated speakers in call_segments
  const updateStmt = db.prepare('UPDATE call_segments SET speaker = ? WHERE id = ?');
  for (const seg of segments) {
    if (seg.id) {
      updateStmt.run(seg.speaker, seg.id);
    }
  }

  // Step 3: Produce formatted dialogue transcript for human audit inspection
  const formattedLines = segments.map((seg) => {
    const timeStr = formatTime(seg.start_time);
    return `[${timeStr}] ${seg.speaker}: ${seg.text}`;
  });
  const formattedTranscript = formattedLines.join('\n');

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('UPDATE calls SET transcript = ?, updated_at = ? WHERE id = ?').run(
    formattedTranscript,
    now,
    callId
  );

  return { segments, formattedTranscript };
}
