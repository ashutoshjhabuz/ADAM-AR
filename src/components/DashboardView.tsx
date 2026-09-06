import React from 'react';
import {
  PhoneCall,
  TrendingUp,
  GitCompare,
  CheckSquare,
  Award,
  AlertCircle,
  Play,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Table,
} from 'lucide-react';
import type { PipelineStats } from '../types';
import type { ActiveTab } from './Sidebar';

interface DashboardViewProps {
  stats: PipelineStats | null;
  onNavigate: (tab: ActiveTab) => void;
  onStartPipeline: () => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onNavigate,
  onStartPipeline,
  isLoading,
}) => {
  const totalCalls = stats?.calls || 0;
  const transcribed = stats?.transcribed || 0;
  const trades = stats?.trades || 0;
  const matches = stats?.matches || 0;
  const audits = stats?.audits || 0;
  const scored = stats?.scored || 0;
  const pendingTranscription = stats?.transcription_pending || 0;
  const failedJobs = stats?.failed || 0;
  const avgScore = stats?.avg_score || 0;

  const progressPercent = trades > 0 ? Math.min(100, Math.round((scored / trades) * 100)) : totalCalls > 0 ? Math.min(100, Math.round((transcribed / totalCalls) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Hero Pipeline Status Banner - Classy Black & Yellow */}
      <div className="bg-[#0b0b0e] text-white rounded-2xl p-6 shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
          <div>
            <div className="text-xs font-bold text-amber-400 tracking-wider uppercase mb-1">
              Production Pipeline · High-Accuracy Groq Whisper Engine
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Calls &rarr; Trades &rarr; Transcribe &rarr; Match &rarr; Q1–Q5 Audit &rarr; Scorecard
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Groq Whisper powers speech-to-text verbatim transcription with audio conditioning; Groq GPT-OSS executes strict pre-order quality auditing. Valid audits synchronize directly across scorecards and editable master records.
            </p>
          </div>

          <button
            onClick={onStartPipeline}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Play className="w-4 h-4 fill-black text-black" />
            <span>Start / Refresh Pipeline</span>
          </button>
        </div>

        {/* Real-time Progress Bar */}
        <div className="mt-6 relative z-10">
          <div className="flex items-center justify-between text-xs text-neutral-300 mb-1.5 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Pipeline Automation Progress</span>
            </div>
            <span className="font-mono text-amber-400 font-bold">{progressPercent}% Scored &amp; Finalized</span>
          </div>
          <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-neutral-400 gap-2">
          <div>
            Queue Status: <span className="text-amber-400 font-mono font-bold">{stats?.queued || 0} queued</span> ·{' '}
            <span className="text-neutral-200 font-mono font-medium">{stats?.processing || 0} processing</span> ·{' '}
            <span className="text-neutral-200 font-mono font-medium">{pendingTranscription} pending transcription</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Manual Gate on Valid Audits</span>
          </div>
        </div>
      </div>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Calls Card */}
        <div
          onClick={() => onNavigate('calls')}
          className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Call Recordings</span>
            <PhoneCall className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{totalCalls.toLocaleString()}</div>
          <div className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
            <span>Transcribed: <b className="text-neutral-800">{transcribed}</b></span>
            {pendingTranscription > 0 && (
              <span className="text-amber-600 font-bold">{pendingTranscription} pending</span>
            )}
          </div>
        </div>

        {/* Trades Card */}
        <div
          onClick={() => onNavigate('trades')}
          className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Trading Records</span>
            <TrendingUp className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{trades.toLocaleString()}</div>
          <div className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
            <span>Matched: <b className="text-neutral-800">{matches}</b></span>
            <span className="text-neutral-400">CSV/XLSX</span>
          </div>
        </div>

        {/* Audits Card */}
        <div
          onClick={() => onNavigate('audit')}
          className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">AI Audits (Q1–Q5)</span>
            <CheckSquare className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{audits.toLocaleString()}</div>
          <div className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
            <span>Model: <b className="text-neutral-800">GPT-OSS 120B</b></span>
            <span className="text-amber-600 font-bold">Automatic</span>
          </div>
        </div>

        {/* Scorecards Card */}
        <div
          onClick={() => onNavigate('scorecards')}
          className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-neutral-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Scorecards Generated</span>
            <Award className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{scored.toLocaleString()}</div>
          <div className="text-xs text-neutral-600 mt-1 flex items-center justify-between">
            <span>Avg Score: <b>{avgScore}/5</b></span>
            <span className="font-bold text-amber-600">Finalized</span>
          </div>
        </div>
      </div>

      {/* System Status & Attention Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span>System Health &amp; Subsystems</span>
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              Optimal
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
              <span className="text-neutral-600">Groq Whisper Transcription</span>
              <span className="font-semibold text-neutral-900 flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>whisper-large-v3 (Primary)</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
              <span className="text-neutral-600">Groq GPT-OSS Compliance Auditing</span>
              <span className="font-semibold text-neutral-900 flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>openai/gpt-oss-120b (Structured)</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
              <span className="text-neutral-600">Deterministic Matcher (Client/Symbol/Price/Qty)</span>
              <span className="font-semibold text-neutral-900">{matches} Confirmed Matches</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-600">Scoring Engine &amp; Fatal Rules (Q1/Q2/Q5)</span>
              <span className="font-bold text-amber-600">Deterministic 5-Mark Calculation</span>
            </div>
          </div>
        </div>

        {/* Attention & Action Panel */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Attention &amp; Quick Actions</span>
            </h3>
          </div>

          {failedJobs > 0 ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-4">
              <b>{failedJobs} failed item(s)</b> requiring inspection. Check Diagnostics or Logs for detail.
            </div>
          ) : (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-700 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No blocking pipeline failures. All valid AI audits advance directly to scorecards.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <button
              onClick={() => onNavigate('calls')}
              className="p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-800 font-semibold flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Upload Calls (ZIP / MP3)</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('trades')}
              className="p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-800 font-semibold flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Import Trades (CSV/XLSX)</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('master_table')}
              className="p-3 bg-black hover:bg-neutral-900 text-amber-400 border border-amber-400/30 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5" />
                <span>Audited Master Grid</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>

            <button
              onClick={() => onNavigate('mail')}
              className="p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-800 font-semibold flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Dispatch Scorecard Mail</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Operating Sequence Guide */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          <span>Recommended Standard Operating Sequence</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { step: '1. Calls', desc: 'Upload audio/ZIP', done: totalCalls > 0 },
            { step: '2. Trades', desc: 'Import CSV/XLSX', done: trades > 0 },
            { step: '3. Transcribe', desc: 'Groq Whisper', done: transcribed > 0 },
            { step: '4. Match', desc: 'Deterministic links', done: matches > 0 },
            { step: '5. AI Audit', desc: 'Groq GPT-OSS 120b', done: audits > 0 },
            { step: '6. Score', desc: 'Fatal & 5-mark rules', done: scored > 0 },
            { step: '7. Master Grid', desc: 'Live editable table', done: scored > 0 },
            { step: '8. Dispatch', desc: 'Advisor email delivery', done: (stats?.scorecard_coverage || 0) > 0 },
          ].map((s, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-center transition-all ${
                s.done
                  ? 'bg-amber-50/60 border-amber-300 text-neutral-900 font-semibold'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-400'
              }`}
            >
              <div className={`text-xs font-bold ${s.done ? 'text-black' : 'text-neutral-500'}`}>
                {s.step}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
