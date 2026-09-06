import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  TrendingUp,
  GitCompare,
  CheckSquare,
  Activity,
  Award,
  Mail,
  FileText,
  Sliders,
  Cpu,
  ScrollText,
  Archive,
  Sparkles,
  Table,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import type { ActiveTab } from '../types';

export type { ActiveTab };

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  stats: {
    transcribed: number;
    calls: number;
    audits: number;
    scored: number;
    failed: number;
  } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, stats }) => {
  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tata' as ActiveTab, label: 'Tata Teleservices', icon: Radio },
    { id: 'calls' as ActiveTab, label: 'Calls', icon: PhoneCall, badge: stats ? `${stats.transcribed}/${stats.calls}` : undefined },
    { id: 'trades' as ActiveTab, label: 'Trades', icon: TrendingUp },
    { id: 'matching' as ActiveTab, label: 'Matching', icon: GitCompare },
    { id: 'audit' as ActiveTab, label: 'Audit', icon: CheckSquare, badge: stats?.audits ? `${stats.audits}` : undefined },
    { id: 'pipeline' as ActiveTab, label: 'Pipeline', icon: Activity },
    { id: 'master_table' as ActiveTab, label: 'Audited Master Grid', icon: Table, badge: stats?.scored ? `${stats.scored}` : undefined, highlight: true },
    { id: 'scorecards' as ActiveTab, label: 'Scorecards', icon: Award, highlight: false },
    { id: 'mail' as ActiveTab, label: 'Mail', icon: Mail },
    { id: 'reports' as ActiveTab, label: 'Reports', icon: FileText },
    { id: 'integrations' as ActiveTab, label: 'Integrations', icon: Sliders },
    { id: 'diagnostics' as ActiveTab, label: 'Diagnostics', icon: Cpu },
    { id: 'logs' as ActiveTab, label: 'Logs', icon: ScrollText },
    { id: 'admin' as ActiveTab, label: 'Admin', icon: ShieldCheck },
    { id: 'maintenance' as ActiveTab, label: 'Archive & Clear', icon: Archive },
  ];

  return (
    <aside className="w-64 bg-[#0a0a0a] text-neutral-100 flex flex-col border-r border-neutral-800 shrink-0 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-neutral-800/80 flex items-center gap-3 bg-neutral-950">
        <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center font-black text-black shadow-[0_4px_16px_rgba(251,191,36,0.4)] tracking-wider transform transition-transform hover:scale-105 active:scale-95 duration-200">
          AR
        </div>
        <div>
          <div className="font-bold text-base tracking-tight flex items-center gap-1.5 text-neutral-100">
            ADAM-AR <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-mono font-semibold border border-amber-400/30">v4.3 Pro</span>
          </div>
          <div className="text-xs text-neutral-400 font-medium">Voice Quality Audit Engine</div>
        </div>
      </div>

      {/* Groq AI Active Pill */}
      <div className="px-4 py-2.5 bg-black border-b border-neutral-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Groq AI Active</span>
        </div>
        <span className="text-[10px] text-neutral-400 font-mono">Whisper + GPT-OSS</span>
      </div>

      {/* 3D Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 perspective-1000">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-amber-400 text-black shadow-[0_6px_16px_rgba(251,191,36,0.35)] -translate-y-0.5 border-b-2 border-amber-600 scale-[1.02]'
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400 hover:translate-x-1 hover:border-l-2 hover:border-amber-400 hover:shadow-md active:translate-y-0.5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'text-black scale-110' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold transition-colors ${
                    isActive
                      ? 'bg-black text-amber-400 shadow-xs'
                      : item.highlight
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-neutral-800 text-[11px] text-neutral-400 bg-neutral-950">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-neutral-200">ADAM-AR Audit</span>
          <span className="font-mono text-amber-400 text-[10px] font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">100% Precision</span>
        </div>
        <div className="text-[10px] text-neutral-400 font-medium">
          Developed and designed by <span className="text-amber-400 font-bold tracking-wide">TAJ</span>
        </div>
      </div>
    </aside>
  );
};
