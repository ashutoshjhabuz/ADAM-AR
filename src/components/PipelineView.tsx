import React from 'react';
import {
  Activity,
  Play,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import type { PipelineStats } from '../types';

interface PipelineViewProps {
  stats: PipelineStats | null;
  onStartPipeline: () => Promise<void>;
  isLoading: boolean;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  stats,
  onStartPipeline,
  isLoading,
}) => {
  const steps = [
    {
      num: 1,
      title: 'Call Upload',
      desc: 'Audio files & Smartflo metadata ingestion',
      count: `${stats?.calls || 0} calls`,
      active: (stats?.calls || 0) > 0,
    },
    {
      num: 2,
      title: 'Trade Import',
      desc: 'Executed orders from CSV / XLSX',
      count: `${stats?.trades || 0} trades`,
      active: (stats?.trades || 0) > 0,
    },
    {
      num: 3,
      title: 'Groq Whisper Transcription',
      desc: 'whisper-large-v3 primary transcription',
      count: `${stats?.transcribed || 0}/${stats?.calls || 0} transcribed`,
      active: (stats?.transcribed || 0) > 0,
    },
    {
      num: 4,
      title: 'Deterministic Matching',
      desc: 'Client code, symbol, price & qty anchors',
      count: `${stats?.matches || 0} confirmed`,
      active: (stats?.matches || 0) > 0,
    },
    {
      num: 5,
      title: 'Groq Q1–Q5 AI Audit',
      desc: 'openai/gpt-oss-120b structured compliance',
      count: `${stats?.audits || 0} audits`,
      active: (stats?.audits || 0) > 0,
    },
    {
      num: 6,
      title: 'Deterministic Scoring',
      desc: 'Fatal rules (Q1/Q2/Q5) & 5-mark calculation',
      count: `${stats?.scored || 0} scored`,
      active: (stats?.scored || 0) > 0,
    },
    {
      num: 7,
      title: 'Scorecard Dispatch',
      desc: 'Advisor mapping & email dispatch',
      count: `${stats?.scored || 0} available`,
      active: (stats?.scored || 0) > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Control Banner - Classy Black & Yellow */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-400 text-black">
              <Activity className="w-4 h-4" />
            </span>
            <span>Automatic Production Pipeline Automation</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
            AuditEQ executes end-to-end: audio files correlate with telephony metadata and trade logs, run high-accuracy Groq Whisper transcription, deterministic matching, and Q1–Q5 compliance scoring.
          </p>
        </div>

        <button
          onClick={onStartPipeline}
          disabled={isLoading}
          className="px-6 py-2.5 bg-black hover:bg-neutral-900 disabled:opacity-50 text-amber-400 font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-amber-400/30 shrink-0"
        >
          <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>{isLoading ? 'Processing Pipeline…' : 'Start / Refresh Pipeline'}</span>
        </button>
      </div>

      {/* Pipeline Flow Stepper */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          <span>Execution Flow</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s) => (
            <div
              key={s.num}
              className={`p-4 rounded-xl border transition-all ${
                s.active
                  ? 'bg-amber-50/40 border-amber-300 text-neutral-900 shadow-xs'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    s.active ? 'bg-black text-amber-400' : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {s.num}
                </span>
                <span className={`text-[10px] font-mono font-bold ${s.active ? 'text-amber-700' : 'text-neutral-400'}`}>
                  {s.count}
                </span>
              </div>

              <div className={`text-xs font-bold mb-1 ${s.active ? 'text-neutral-900' : 'text-neutral-500'}`}>
                {s.title}
              </div>
              <div className="text-[11px] text-neutral-500 leading-snug">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Monitors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1 text-xs font-semibold">
            <span>Pending Transcription</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{stats?.transcription_pending || 0}</div>
          <div className="text-[11px] text-neutral-400 mt-1">Processed with Groq Whisper Large V3</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1 text-xs font-semibold">
            <span>Deterministic Matches</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950">{stats?.matches || 0}</div>
          <div className="text-[11px] text-emerald-700 mt-1">Ready for Q1–Q5 compliance verification</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1 text-xs font-semibold">
            <span>Finalized Scorecards</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950">{stats?.scored || 0}</div>
          <div className="text-[11px] text-emerald-700 mt-1">Complete call-level compliance scorecards</div>
        </div>
      </div>
    </div>
  );
};
