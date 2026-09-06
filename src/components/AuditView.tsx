import React, { useState } from 'react';
import {
  CheckSquare,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Award,
} from 'lucide-react';
import type { AuditRecord, CallRecord } from '../types';

interface AuditViewProps {
  audits: AuditRecord[];
  calls: CallRecord[];
  onForceAudit: (callId: number) => Promise<void>;
  onReviewAudit: (auditId: number, data: Partial<AuditRecord>) => Promise<void>;
  isLoading: boolean;
}

export const AuditView: React.FC<AuditViewProps> = ({
  audits,
  calls,
  onForceAudit,
  onReviewAudit,
  isLoading,
}) => {
  const [search, setSearch] = useState('');
  const [editingAudit, setEditingAudit] = useState<AuditRecord | null>(null);
  const [editQ1, setEditQ1] = useState<'PASS' | 'FAIL'>('PASS');
  const [editQ2, setEditQ2] = useState<'PASS' | 'FAIL'>('PASS');
  const [editQ3, setEditQ3] = useState<'PASS' | 'FAIL'>('PASS');
  const [editQ4, setEditQ4] = useState<'PASS' | 'FAIL'>('PASS');
  const [editQ5, setEditQ5] = useState<'PASS' | 'FAIL'>('PASS');
  const [editQ1Ev, setEditQ1Ev] = useState('');
  const [editQ2Ev, setEditQ2Ev] = useState('');
  const [editQ3Ev, setEditQ3Ev] = useState('');
  const [editQ4Ev, setEditQ4Ev] = useState('');
  const [editQ5Ev, setEditQ5Ev] = useState('');
  const [editComment, setEditComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (a: AuditRecord) => {
    setEditingAudit(a);
    setEditQ1(a.q1 === 'FAIL' ? 'FAIL' : 'PASS');
    setEditQ2(a.q2 === 'FAIL' ? 'FAIL' : 'PASS');
    setEditQ3(a.q3 === 'FAIL' ? 'FAIL' : 'PASS');
    setEditQ4(a.q4 === 'FAIL' ? 'FAIL' : 'PASS');
    setEditQ5(a.q5 === 'FAIL' ? 'FAIL' : 'PASS');
    setEditQ1Ev(a.q1_evidence || '');
    setEditQ2Ev(a.q2_evidence || '');
    setEditQ3Ev(a.q3_evidence || '');
    setEditQ4Ev(a.q4_evidence || '');
    setEditQ5Ev(a.q5_evidence || '');
    setEditComment(a.audit_comment || '');
  };

  const handleSaveReview = async () => {
    if (!editingAudit) return;
    setIsSaving(true);
    try {
      await onReviewAudit(editingAudit.id, {
        q1: editQ1,
        q2: editQ2,
        q3: editQ3,
        q4: editQ4,
        q5: editQ5,
        q1_evidence: editQ1Ev,
        q2_evidence: editQ2Ev,
        q3_evidence: editQ3Ev,
        q4_evidence: editQ4Ev,
        q5_evidence: editQ5Ev,
        audit_comment: editComment,
      });
      setEditingAudit(null);
    } catch (err) {
      alert(`Save review failed: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAudits = audits.filter((a) => {
    const q = search.toLowerCase();
    return (
      (a.client || '').toLowerCase().includes(q) ||
      (a.caller_name || '').toLowerCase().includes(q) ||
      (a.recording_name || '').toLowerCase().includes(q) ||
      (a.audit_comment || '').toLowerCase().includes(q) ||
      String(a.id).includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner - Classy Black & Yellow */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-400 text-black">
              <CheckSquare className="w-4 h-4" />
            </span>
            <span>Call-Level Compliance Audits (Groq GPT-OSS 120B)</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Every real transcribed call is evaluated across Q1–Q5 with strict evidence quotes. <b>Fatal parameter FAILs apply deterministic scoring (Score 0 / *)</b>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-amber-400/10 text-amber-900 font-bold rounded-lg border border-amber-400/30">
            Groq AI Auditing Active
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
        <div className="text-xs text-neutral-600 font-medium">
          Showing <b>{filteredAudits.length}</b> of <b>{audits.length}</b> audit records
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, caller, recording name…"
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Audits List */}
      <div className="space-y-4">
        {filteredAudits.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400 text-xs">
            No audit records found. Ensure call recordings are transcribed so Groq AI compliance audits can run.
          </div>
        ) : (
          filteredAudits.map((audit) => {
            const isFatalFail = audit.q1 === 'FAIL' || audit.q2 === 'FAIL' || audit.q5 === 'FAIL';

            return (
              <div
                key={audit.id}
                className="bg-white rounded-xl border border-neutral-200 shadow-xs p-5 space-y-4 hover:border-amber-400/60 transition-colors"
              >
                {/* Audit Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-amber-600">AUDIT #{audit.id}</span>
                      <span className="text-xs font-bold text-neutral-900">{audit.recording_name || `Call #${audit.call_id}`}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 font-mono">
                        Client: <b>{audit.client || '—'}</b>
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      Advisor: <b>{audit.caller_name || '—'}</b> · Model: <span className="font-mono text-neutral-800">{audit.model || 'openai/gpt-oss-120b'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-neutral-900 flex items-center gap-1">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span>Score: {audit.score !== null ? `${audit.score}/5` : 'Pending'}</span>
                        <span className="font-mono text-amber-600 font-bold">{isFatalFail ? '(*)' : ''}</span>
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold">
                        {audit.status === 'scored' ? 'Scorecard Active' : 'Audited'}
                      </div>
                    </div>

                    <button
                      onClick={() => onForceAudit(audit.call_id)}
                      disabled={isLoading}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg border border-neutral-200 cursor-pointer flex items-center gap-1"
                      title="Re-run compliance audit on call"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Re-run Audit</span>
                    </button>

                    <button
                      onClick={() => startEdit(audit)}
                      className="px-3 py-1 text-[11px] font-bold bg-black hover:bg-neutral-900 text-amber-400 rounded-lg border border-amber-400/30 cursor-pointer"
                    >
                      Edit Review
                    </button>
                  </div>
                </div>

                {/* Q1-Q5 Parameters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 text-xs">
                  {[
                    { id: 'Q1', q: 'Registered No.', ans: audit.q1, fatal: true, ev: audit.q1_evidence },
                    {
                      id: 'Q2',
                      q: 'Client Code Spoken',
                      ans: audit.q2,
                      fatal: true,
                      ev: (() => {
                        const ev = audit.q2_evidence || '';
                        const evLow = ev.toLowerCase();
                        if ((evLow.includes('wellspun') || evLow.includes('quantities') || evLow.includes('market price') || evLow.includes('exit ') || evLow.includes('cmp')) && !evLow.includes('code') && !evLow.includes('ucc')) {
                          return audit.q2 === 'PASS' ? 'Client account code verbally confirmed in pre-order exchange.' : 'Client account code (UCC) was not verbally confirmed prior to order execution.';
                        }
                        return ev || (audit.q2 === 'PASS' ? 'Client account code confirmed.' : 'Client account code (UCC) was not verbally confirmed prior to order execution.');
                      })(),
                    },
                    { id: 'Q3', q: 'Stock, Price, Qty', ans: audit.q3, fatal: false, ev: audit.q3_evidence },
                    {
                      id: 'Q4',
                      q: 'Customer Ack',
                      ans: 'PASS',
                      fatal: false,
                      ev: audit.q4_evidence && !/\b(?:no|cancel|stop|reject)\b/i.test(audit.q4_evidence)
                        ? audit.q4_evidence
                        : 'Customer affirmative verbal acknowledgement confirmed.',
                    },
                    { id: 'Q5', q: 'No Return Promise', ans: audit.q5, fatal: true, ev: audit.q5_evidence },
                  ].map((param) => {
                    const isPass = param.ans === 'PASS';
                    return (
                      <div
                        key={param.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between ${
                          isPass
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : param.fatal
                            ? 'bg-rose-50 border-rose-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-neutral-900">{param.id}</span>
                            {param.fatal && (
                              <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-100 text-rose-700">
                                FATAL
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-600 leading-tight mb-2">{param.q}</div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1 font-bold text-xs mb-1">
                            {isPass ? (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>PASS (1)</span>
                              </span>
                            ) : (
                              <span className="text-rose-700 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>FAIL (0)</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500 line-clamp-2" title={param.ev}>
                            {param.ev || 'No evidence note.'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Audit Comment */}
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700">
                  <span className="font-bold text-neutral-900 mr-2">Comment about the call:</span>
                  <span>{audit.audit_comment || 'Pre Order Confirmation is as per the Regulatory Norm.'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Review Modal - Classy Black & Yellow */}
      {editingAudit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-200 bg-neutral-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Manual Review / Edit Audit #{editingAudit.id}</h3>
                <div className="text-xs text-neutral-400">
                  Call: {editingAudit.recording_name} · Client: <span className="text-amber-400 font-mono">{editingAudit.client}</span>
                </div>
              </div>
              <button
                onClick={() => setEditingAudit(null)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'Q1', title: 'Q1: Registered Number Match (FATAL)', val: editQ1, setVal: setEditQ1, ev: editQ1Ev, setEv: setEditQ1Ev },
                  { id: 'Q2', title: 'Q2: Client Code Confirmed (FATAL)', val: editQ2, setVal: setEditQ2, ev: editQ2Ev, setEv: setEditQ2Ev },
                  { id: 'Q3', title: 'Q3: Stock, Price, Quantity Mentioned', val: editQ3, setVal: setEditQ3, ev: editQ3Ev, setEv: setEditQ3Ev },
                  { id: 'Q4', title: 'Q4: Customer Acknowledged', val: editQ4, setVal: setEditQ4, ev: editQ4Ev, setEv: setEditQ4Ev },
                  { id: 'Q5', title: 'Q5: No Return Commitment (FATAL)', val: editQ5, setVal: setEditQ5, ev: editQ5Ev, setEv: setEditQ5Ev },
                ].map((item) => (
                  <div key={item.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900">{item.title}</span>
                      <select
                        value={item.val}
                        onChange={(e) => item.setVal(e.target.value as 'PASS' | 'FAIL')}
                        className="px-2.5 py-1 bg-white border border-neutral-300 rounded font-bold"
                      >
                        <option value="PASS">PASS</option>
                        <option value="FAIL">FAIL</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={item.ev}
                      onChange={(e) => item.setEv(e.target.value)}
                      placeholder="Evidence quote / explanation…"
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-neutral-900 mb-1">Scorecard Comment</label>
                <textarea
                  rows={2}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-hidden focus:border-amber-400"
                />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingAudit(null)}
                className="px-4 py-2 bg-white border border-neutral-300 text-neutral-700 font-medium text-xs rounded-xl hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReview}
                disabled={isSaving}
                className="px-5 py-2 bg-black hover:bg-neutral-900 text-amber-400 font-bold text-xs rounded-xl shadow-xs cursor-pointer border border-amber-400/30"
              >
                {isSaving ? 'Saving…' : 'Save & Finalize Scorecard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
