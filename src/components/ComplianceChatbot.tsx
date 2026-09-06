import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  ChevronDown,
  RotateCcw,
  Loader2,
  Database,
  Globe,
} from 'lucide-react';
import { api } from '../lib/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const INTERNAL_SUGGESTIONS = [
  'How many calls are audited so far?',
  'Which advisors have fatal violations?',
  'Show Q1 (CLI phone match) pass vs fail count',
  'Summary of recent audited pre-order calls',
];

const GENERAL_SUGGESTIONS = [
  'Explain SEBI pre-order voice recording rules',
  'What is the difference between limit order and market order?',
  'How does STT work in Indian equity trades?',
  'What are the key compliance duties for a stock broker in India?',
];

export const ComplianceChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'internal' | 'general'>('internal');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your **ADAM-AR AI Intelligence Assistant**.\n\nChoose **ADAM-AR Data Mode** to query call recordings, Q1-Q5 scorecards, and trade reconciliations, or switch to **General & Internet Mode** to ask any question from the web or financial markets.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage(textToSend, mode);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.answer || 'I could not retrieve an answer at this moment.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error contacting compliance service: ${(err as Error).message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: mode === 'internal'
          ? 'Conversation reset. Ask any question about ADAM-AR call recordings, trade matching, or audit scorecards.'
          : 'Conversation reset. Ask any question from the internet, markets, regulations, or general knowledge.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const suggestions = mode === 'internal' ? INTERNAL_SUGGESTIONS : GENERAL_SUGGESTIONS;

  return (
    <aside aria-label="ADAM-AR Compliance Assistant" className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="w-[380px] sm:w-[440px] h-[560px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-neutral-950 text-white px-4 py-3 flex flex-col gap-2.5 border-b border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-white">ADAM-AR AI Assistant</h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    {mode === 'internal' ? 'Internal ADAM-AR Data Connected' : 'General & Internet Knowledge Active'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Reset conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Minimize chat"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode Selector Pill Tabs */}
            <div className="grid grid-cols-2 p-1 bg-neutral-900 rounded-xl text-xs gap-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => setMode('internal')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                  mode === 'internal'
                    ? 'bg-amber-400 text-black font-semibold shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span className="text-[11px]">ADAM-AR Data</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('general')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                  mode === 'general'
                    ? 'bg-sky-500 text-white font-semibold shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="text-[11px]">General / Web AI</span>
              </button>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-neutral-50/60">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-neutral-900 text-white rounded-br-none'
                      : 'bg-white text-neutral-800 border border-neutral-200/80 rounded-bl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.text.split('\n').map((line, idx) => {
                      const parts = line.split(/(\*\*.*?\*\*)/g);
                      return (
                        <div key={idx} className={line.startsWith('- ') ? 'ml-2 my-0.5' : 'my-0.5'}>
                          {parts.map((p, i) => {
                            if (p.startsWith('**') && p.endsWith('**')) {
                              return <strong key={i} className="font-semibold text-neutral-950">{p.slice(2, -2)}</strong>;
                            }
                            return p;
                          })}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      msg.sender === 'user' ? 'text-neutral-400' : 'text-neutral-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 text-xs justify-start items-center">
                <div className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl px-3.5 py-2 rounded-bl-none flex items-center gap-2 text-neutral-500 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span className="text-[11px]">
                    {mode === 'internal' ? 'Scanning ADAM-AR database...' : 'Generating answer from AI & web...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          {messages.length <= 2 && (
            <div className="px-3 py-2 bg-white border-t border-neutral-100 flex flex-wrap gap-1.5">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="text-[10px] bg-neutral-100 hover:bg-amber-100 hover:text-amber-900 text-neutral-700 font-medium px-2 py-1 rounded-lg transition-colors text-left cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-neutral-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                mode === 'internal'
                  ? 'Ask about calls, trades, scorecards in ADAM-AR...'
                  : 'Ask any random or web question...'
              }
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-neutral-100 border border-neutral-200 focus:bg-white focus:border-amber-400 rounded-xl text-xs text-neutral-900 focus:outline-hidden transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-black rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Send question"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group px-4 py-2.5 bg-neutral-950 hover:bg-black text-white rounded-full shadow-xl border border-neutral-800 flex items-center gap-2.5 cursor-pointer transition-all hover:scale-105 active:scale-95"
        title="Open ADAM-AR AI Assistant"
      >
        <div className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold">
          <MessageSquare className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-white tracking-wide">ADAM-AR AI</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </button>
    </aside>
  );
};
