import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Mail,
  Send,
  Link2,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  FileText,
  UserCheck,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import type { MissingCallRecord } from '../types';

interface MissingCallsWorkQueueProps {
  onCallLinked?: () => void;
}

export const MissingCallsWorkQueue: React.FC<MissingCallsWorkQueueProps> = ({ onCallLinked }) => {
  const [records, setRecords] = useState<MissingCallRecord[]>([]);
  const [stats, setStats] = useState({
    total_missing: 0,
    pending_dispatch: 0,
    dispatched: 0,
    exempt: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedTradeIds, setSelectedTradeIds] = useState<number[]>([]);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Link Call Modal State
  const [linkingTrade, setLinkingTrade] = useState<MissingCallRecord | null>(null);
  const [inputCallId, setInputCallId] = useState('');
  const [linkNotes, setLinkNotes] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Exempt Modal State
  const [exemptingTrade, setExemptingTrade] = useState<MissingCallRecord | null>(null);
  const [exemptReason, setExemptReason] = useState('Executed via Client Mobile App (Non-telephonic)');
  const [isExempting, setIsExempting] = useState(false);

  // Dispatching single trade confirmation state
  const [sendingTradeId, setSendingTradeId] = useState<number | null>(null);

  const fetchQueueData = async () => {
    setIsLoading(true);
    try {
      const res = await api.getMissingCallsWorkQueue();
      if (res.ok) {
        setRecords(res.records || []);
        setStats(res.stats || { total_missing: 0, pending_dispatch: 0, dispatched: 0, exempt: 0 });
      }
    } catch (err: unknown) {
      setActionMessage({ text: `Failed to load queue: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterStatus === 'pending' && (r.notification_sent > 0 || r.confirmation_status === 'confirmed_exempt')) {
        return false;
      }
      if (filterStatus === 'dispatched' && r.notification_sent === 0) {
        return false;
      }
      if (filterStatus === 'exempt' && r.confirmation_status !== 'confirmed_exempt') {
        return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (r.client || '').toLowerCase().includes(q) ||
        (r.symbol || '').toLowerCase().includes(q) ||
        (r.advisor_name || '').toLowerCase().includes(q) ||
        (r.dealer || '').toLowerCase().includes(q) ||
        (r.client_number || '').includes(q) ||
        String(r.id).includes(q)
      );
    });
  }, [records, filterStatus, search]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTradeIds(filteredRecords.map((r) => r.id));
    } else {
      setSelectedTradeIds([]);
    }
  };

  const handleToggleSelect = (tradeId: number) => {
    setSelectedTradeIds((prev) =>
      prev.includes(tradeId) ? prev.filter((id) => id !== tradeId) : [...prev, tradeId]
    );
  };

  const handleSendSingleConfirmation = async (trade: MissingCallRecord) => {
    setSendingTradeId(trade.id);
    setActionMessage(null);
    try {
      const res = await api.sendMissingCallConfirmation(trade.id);
      if (res.ok) {
        setActionMessage({
          text: `CALL_MAIL_CONFIRMATION dispatched for Trade #${trade.id} (${trade.symbol} - ${trade.client}).`,
          type: 'success',
        });
        await fetchQueueData();
      }
    } catch (err: unknown) {
      setActionMessage({ text: `Error sending confirmation: ${(err as Error).message}`, type: 'error' });
    } finally {
      setSendingTradeId(null);
    }
  };

  const handleBulkDispatch = async () => {
    if (selectedTradeIds.length === 0) return;
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await api.bulkSendMissingCallConfirmations(selectedTradeIds);
      if (res.ok) {
        setActionMessage({
          text: `Successfully dispatched missing call confirmations for ${res.sent_count} trade(s).`,
          type: 'success',
        });
        setSelectedTradeIds([]);
        await fetchQueueData();
      }
    } catch (err: unknown) {
      setActionMessage({ text: `Bulk dispatch error: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingTrade || !inputCallId) return;

    setIsLinking(true);
    try {
      const res = await api.linkCallToTrade(linkingTrade.id, parseInt(inputCallId, 10), linkNotes);
      if (res.ok) {
        setActionMessage({
          text: `Trade #${linkingTrade.id} successfully linked to Call #${inputCallId}. Verification audit scheduled.`,
          type: 'success',
        });
        setLinkingTrade(null);
        setInputCallId('');
        setLinkNotes('');
        await fetchQueueData();
        if (onCallLinked) onCallLinked();
      }
    } catch (err: unknown) {
      setActionMessage({ text: `Failed to link call: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsLinking(false);
    }
  };

  const handleExemptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exemptingTrade || !exemptReason.trim()) return;

    setIsExempting(true);
    try {
      const res = await api.exemptTradeFromCall(exemptingTrade.id, exemptReason.trim());
      if (res.ok) {
        setActionMessage({
          text: `Trade #${exemptingTrade.id} marked as exempt: "${exemptReason}".`,
          type: 'success',
        });
        setExemptingTrade(null);
        await fetchQueueData();
      }
    } catch (err: unknown) {
      setActionMessage({ text: `Failed to record exemption: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsExempting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-400 text-black">
              <ShieldAlert className="w-4 h-4 text-black" />
            </span>
            <h2 className="text-base font-bold text-neutral-900">
              Trade-First Audit: Missing Call Confirmations Queue
            </h2>
          </div>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
            SEBI Regulatory Mandate: Every executed dealer/advisor trade must be preceded by an authentic pre-order confirmation call recording. Unmatched trades must receive official email confirmation requests or regulatory exemption justification.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchQueueData}
            disabled={isLoading}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-colors cursor-pointer border border-neutral-300 flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {selectedTradeIds.length > 0 && (
            <button
              onClick={handleBulkDispatch}
              disabled={isLoading}
              className="px-4 py-2 bg-black hover:bg-neutral-900 text-amber-400 font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer flex items-center gap-2 border border-amber-400/30"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>Dispatch CALL_MAIL_CONFIRMATION ({selectedTradeIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilterStatus('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-neutral-100 border-neutral-300 ring-2 ring-neutral-500/20'
              : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-700">Total Unmatched Trades</span>
            <ShieldAlert className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-xl font-black text-neutral-900 mt-1">{stats.total_missing}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Executed trades lacking verified calls</div>
        </div>

        <div
          onClick={() => setFilterStatus('pending')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterStatus === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Pending Dispatch</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-950 mt-1">{stats.pending_dispatch}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Confirmation email not yet triggered</div>
        </div>

        <div
          onClick={() => setFilterStatus('dispatched')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterStatus === 'dispatched'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800">Confirmation Dispatched</span>
            <Mail className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-950 mt-1">{stats.dispatched}</div>
          <div className="text-[11px] text-blue-700 mt-0.5">Alerts dispatched to compliance &amp; advisor</div>
        </div>

        <div
          onClick={() => setFilterStatus('exempt')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterStatus === 'exempt'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Regulatory Exemptions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-950 mt-1">{stats.exempt}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Documented app / written authorizations</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-800 focus:outline-hidden focus:border-amber-400"
            >
              <option value="all">All Missing Trades ({records.length})</option>
              <option value="pending">Pending Dispatch ({stats.pending_dispatch})</option>
              <option value="dispatched">Confirmation Dispatched ({stats.dispatched})</option>
              <option value="exempt">Exempt ({stats.exempt})</option>
            </select>
            <span className="text-xs text-neutral-400">Showing {filteredRecords.length} record(s)</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client, symbol, advisor, or ID…"
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111115] text-neutral-200 font-semibold border-b border-neutral-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={filteredRecords.length > 0 && selectedTradeIds.length === filteredRecords.length}
                    onChange={handleSelectAll}
                    className="rounded border-neutral-600 text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 text-amber-400">Trade Ref</th>
                <th className="py-2.5 px-3">Advisor / Dealer</th>
                <th className="py-2.5 px-3">Client UCC &amp; CLI</th>
                <th className="py-2.5 px-3">Symbol &amp; Side</th>
                <th className="py-2.5 px-3 text-right">Qty &amp; Price</th>
                <th className="py-2.5 px-3">Trade Date</th>
                <th className="py-2.5 px-3">Confirmation Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-400">
                    No trades missing pre-order calls found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((t) => {
                  const isSelected = selectedTradeIds.includes(t.id);
                  const isDispatched = t.notification_sent > 0 || t.confirmation_status === 'confirmation_sent';
                  const isExempt = t.confirmation_status === 'confirmed_exempt';

                  return (
                    <tr key={t.id} className={`hover:bg-amber-50/30 transition-colors ${isSelected ? 'bg-amber-50/50' : ''}`}>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(t.id)}
                          className="rounded border-neutral-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-600">
                        #{t.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-neutral-900">{t.advisor_name || 'Unassigned'}</div>
                        <div className="text-[10px] text-neutral-400">{t.dealer || t.team || '—'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-900 border border-neutral-200">
                          {t.client || '—'}
                        </span>
                        <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                          CLI: {t.client_number || t.phone_number || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-neutral-900">{t.symbol || '—'}</div>
                        <span
                          className={`font-mono font-bold text-[9px] px-1 py-0.2 rounded inline-block mt-0.5 ${
                            t.side === 'BUY' || t.side === 'B'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {t.side || 'BUY'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-neutral-900">{t.quantity ? t.quantity.toLocaleString() : '—'}</div>
                        <div className="text-amber-600 font-semibold">{t.price ? `₹${t.price.toFixed(2)}` : '—'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500 font-mono text-[11px]">
                        {t.trade_date || '—'} {t.trade_time || ''}
                      </td>
                      <td className="py-2.5 px-3">
                        {isExempt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Exempt ({t.notes || 'Documented'})</span>
                          </span>
                        ) : isDispatched ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Mail className="w-3 h-3 text-blue-600" />
                              <span>Dispatched ({t.notification_sent}x)</span>
                            </span>
                            {t.notification_date && (
                              <div className="text-[10px] text-neutral-400 font-mono">{t.notification_date.slice(0, 16)}</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Dispatch</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleSendSingleConfirmation(t)}
                            disabled={sendingTradeId === t.id}
                            className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-black font-bold rounded-lg text-[10px] transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="Trigger CALL_MAIL_CONFIRMATION email"
                          >
                            <Send className="w-3 h-3 text-black" />
                            <span>{sendingTradeId === t.id ? 'Sending…' : 'Send Mail'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setLinkingTrade(t);
                              setInputCallId('');
                              setLinkNotes('');
                            }}
                            className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg text-[10px] border border-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
                            title="Manually link a call recording ID"
                          >
                            <Link2 className="w-3 h-3 text-neutral-500" />
                            <span>Link Call</span>
                          </button>

                          <button
                            onClick={() => {
                              setExemptingTrade(t);
                              setExemptReason('Executed via Client Mobile App (Non-telephonic)');
                            }}
                            className="px-2 py-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 font-medium rounded-lg text-[10px] border border-neutral-200 transition-colors cursor-pointer"
                            title="Mark as exempt from pre-order call"
                          >
                            Exempt
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Link Call Recording */}
      {linkingTrade && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-neutral-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-500" />
                <span>Link Call Recording to Trade #{linkingTrade.id}</span>
              </h3>
              <button
                onClick={() => setLinkingTrade(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1">
              <div><b>Client:</b> {linkingTrade.client} · <b>Phone:</b> {linkingTrade.client_number || linkingTrade.phone_number || '—'}</div>
              <div><b>Execution:</b> {linkingTrade.side} {linkingTrade.quantity} {linkingTrade.symbol} @ ₹{linkingTrade.price}</div>
              <div><b>Advisor:</b> {linkingTrade.advisor_name || 'Unassigned'} · <b>Date:</b> {linkingTrade.trade_date}</div>
            </div>

            <form onSubmit={handleLinkSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Call Recording ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={inputCallId}
                  onChange={(e) => setInputCallId(e.target.value)}
                  placeholder="e.g. 104"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Compliance Linking Remarks</label>
                <textarea
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  placeholder="Optional rationale for manual correlation…"
                  rows={2}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setLinkingTrade(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLinking || !inputCallId}
                  className="px-5 py-2 bg-black hover:bg-neutral-900 disabled:opacity-50 text-amber-400 font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5 border border-amber-400/30"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{isLinking ? 'Linking…' : 'Confirm Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Regulatory Exemption */}
      {exemptingTrade && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-neutral-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Record Exemption for Trade #{exemptingTrade.id}</span>
              </h3>
              <button
                onClick={() => setExemptingTrade(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-neutral-600">
              Select or describe the regulatory justification for why this trade execution did not require a telephonic pre-order confirmation call:
            </div>

            <form onSubmit={handleExemptSubmit} className="space-y-3">
              <div className="space-y-2">
                {[
                  'Executed via Client Mobile App (Non-telephonic)',
                  'Direct Web Trading Portal Execution (Self-Directed)',
                  'Physical Written / Signed Order Form on Record',
                  'Exchange Algorithmic Rebalancing / Systematic Investment',
                  'Client Discretionary Institutional Mandate',
                ].map((preset) => (
                  <label key={preset} className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-50 border border-neutral-200 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="exemptReasonPreset"
                      checked={exemptReason === preset}
                      onChange={() => setExemptReason(preset)}
                      className="text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span className="text-neutral-800">{preset}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Custom Exemption Note</label>
                <textarea
                  value={exemptReason}
                  onChange={(e) => setExemptReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setExemptingTrade(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExempting || !exemptReason.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isExempting ? 'Saving…' : 'Record Exemption'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
