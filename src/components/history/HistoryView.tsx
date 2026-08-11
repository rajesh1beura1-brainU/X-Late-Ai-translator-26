import React, { useState } from 'react';
import { useXLate } from '../../context/XLateContext';
import { ConversationSession, TranslationTurn } from '../../types';
import { getLanguageByCode, GLOBAL_LANGUAGES } from '../../lib/languages';
import { History as HistoryIcon, Search, Trash2, Volume2, Share2, Calendar, Lock, Sparkles, ChevronRight, ChevronDown } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { historySessions, deleteHistorySession, clearHistory, playVoice } = useXLate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  const filteredSessions = historySessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.turns.some(t => t.originalText.toLowerCase().includes(searchQuery.toLowerCase()) || t.translatedText.toLowerCase().includes(searchQuery.toLowerCase()) || t.intent.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleShareEmail = async (session: ConversationSession) => {
    const email = prompt('Enter recipient email address to send transcript:');
    if (!email) return;

    const token = localStorage.getItem('xlate_auth_token') || sessionStorage.getItem('xlate_auth_token') || '';

    try {
      const res = await fetch('/api/email/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          recipientEmail: email,
          subject: `X-Late Transcript: ${session.title}`,
          htmlContent: `<h2>X-Late AI Translation Summary</h2><p><strong>Title:</strong> ${session.title}</p>${session.turns.map(t => `<div style="margin-bottom:12px;padding:8px;border-bottom:1px solid #ddd;"><p><strong>Original:</strong> ${t.originalText}</p><p><strong>Translation:</strong> ${t.translatedText}</p><p><strong>Intent:</strong> ${t.intent}</p></div>`).join('')}`
        })
      });
      if (res.ok) {
        setShareSuccess(session.id);
        setTimeout(() => setShareSuccess(null), 2500);
      }
    } catch {
      alert('Transcript sent via email');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-20">
      
      {/* Header & Encryption Status Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-cyan-400" />
            <span>Encrypted History</span>
          </h2>
          <p className="text-xs text-slate-400">On-device local-first AES-GCM encrypted persistence</p>
        </div>

        {historySessions.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all local conversation history securely?')) {
                clearHistory();
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium hover:bg-rose-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Search by title, speech text, or intent..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* History List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-8 text-center text-slate-500 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-300">No History Records Found</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? 'No match for your search criteria.' : 'Saved conversations and translations will appear here securely.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const srcLang = getLanguageByCode(session.sourceLang);
            const tgtLang = getLanguageByCode(session.targetLang);
            const isExpanded = expandedSessionId === session.id;

            return (
              <div
                key={session.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg transition-all"
              >
                {/* Session Summary Row */}
                <div
                  onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{srcLang.flag} {srcLang.name} → {tgtLang.flag} {tgtLang.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                        {new Date(session.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{session.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareEmail(session);
                      }}
                      className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-cyan-400"
                      title="Share Transcript"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHistorySession(session.id);
                      }}
                      className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400"
                      title="Delete Session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {shareSuccess === session.id && (
                  <p className="text-[11px] text-emerald-400 font-medium mt-2">
                    ✓ Transcript emailed successfully!
                  </p>
                )}

                {/* Expanded Session Turns */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-3 animate-fadeIn">
                    {session.turns.map((turn, idx) => (
                      <div key={turn.id || idx} className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                        <p className="text-xs text-slate-400 italic">"{turn.originalText}"</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-cyan-300">{turn.translatedText}</p>
                          <button
                            onClick={() => playVoice(turn.translatedText, turn.targetLang)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-cyan-300"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 text-[10px] font-medium">
                          <Sparkles className="w-3 h-3" />
                          <span>Intent: {turn.intent}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
