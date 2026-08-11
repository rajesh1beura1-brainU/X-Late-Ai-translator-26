import React, { useState } from 'react';
import { useXLate } from '../../context/XLateContext';
import { getLanguageByCode } from '../../lib/languages';
import { Mic, Volume2, Save, Trash2, ArrowLeft, Sparkles, User, UserCheck } from 'lucide-react';

export const ConversationView: React.FC = () => {
  const {
    sourceLang,
    targetLang,
    conversationTurns,
    startListening,
    stopListeningAndTranslate,
    isListening,
    isProcessing,
    isLiveTranslating,
    liveTranscript,
    liveTranslation,
    playVoice,
    saveSessionToHistory,
    resetCurrentLiveSession,
    setActiveTab
  } = useXLate();

  const [activeSpeaker, setActiveSpeaker] = useState<'speaker_a' | 'speaker_b'>('speaker_a');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const langA = getLanguageByCode(sourceLang);
  const langB = getLanguageByCode(targetLang);

  const handleSpeakerTap = async (speaker: 'speaker_a' | 'speaker_b') => {
    setActiveSpeaker(speaker);
    if (isListening) {
      await stopListeningAndTranslate();
    } else {
      await startListening(speaker);
    }
  };

  const handleSaveSession = async () => {
    await saveSessionToHistory();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-2xl mx-auto px-4 py-2">
      
      {/* Top Controls Header */}
      <div className="flex items-center justify-between py-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Conversation</span>
        </button>

        <div className="flex items-center gap-2">
          {conversationTurns.length > 0 && (
            <>
              <button
                onClick={handleSaveSession}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveSuccess ? 'Saved!' : 'Save Conversation'}</span>
              </button>
              <button
                onClick={resetCurrentLiveSession}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Real-time Conversation Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {conversationTurns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3 px-6">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h3 className="text-white font-medium text-base mb-1">Two-Person Conversation Mode</h3>
              <p className="text-xs text-slate-400">
                Tap Speaker A ({langA.name}) or Speaker B ({langB.name}) below to speak naturally.
              </p>
            </div>
          </div>
        ) : (
          conversationTurns.map((turn, index) => {
            const isSpeakerA = turn.speaker === 'speaker_a' || turn.speaker === 'user';
            const speakerLang = isSpeakerA ? langA : langB;
            const targetLangObj = isSpeakerA ? langB : langA;

            return (
              <div
                key={turn.id || index}
                className={`flex flex-col gap-2 p-4 rounded-2xl border transition-all ${
                  isSpeakerA
                    ? 'bg-slate-900/90 border-slate-800 items-start'
                    : 'bg-indigo-950/40 border-indigo-900/60 items-end text-right'
                }`}
              >
                {/* Speaker Label */}
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isSpeakerA ? 'bg-cyan-500/20 text-cyan-300' : 'bg-indigo-500/20 text-indigo-300'
                  }`}>
                    {isSpeakerA ? 'A' : 'B'}
                  </div>
                  <span>{isSpeakerA ? `Speaker A (${speakerLang.name})` : `Speaker B (${speakerLang.name})`}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Original Speech */}
                <p className="text-xs text-slate-400 italic">"{turn.originalText}"</p>

                {/* Main Translated Output */}
                <div className="flex items-center gap-3">
                  <p className="text-base font-semibold text-white tracking-wide">
                    {turn.translatedText}
                  </p>
                  <button
                    onClick={() => playVoice(turn.translatedText, turn.targetLang)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Intent Badge */}
                {turn.intent && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-[11px] font-medium mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Intent: {turn.intent}</span>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Real-time Streaming Active Turn Card */}
        {(isListening || liveTranscript || liveTranslation) && (
          <div className={`flex flex-col gap-2 p-4 rounded-2xl border animate-pulse ${
            activeSpeaker === 'speaker_a'
              ? 'bg-cyan-950/30 border-cyan-500/50 items-start'
              : 'bg-indigo-950/40 border-indigo-500/50 items-end text-right'
          }`}>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>{activeSpeaker === 'speaker_a' ? `Speaker A (${langA.name})` : `Speaker B (${langB.name})`} Live Speaking</span>
            </div>

            <p className="text-xs text-slate-300 italic">
              {liveTranscript ? `"${liveTranscript}"` : 'Listening for words...'}
            </p>

            <p className="text-base font-bold text-white tracking-wide">
              {liveTranslation || (isLiveTranslating ? 'Translating live...' : '')}
            </p>
          </div>
        )}
      </div>

      {/* Dual Speaker Mic Bar */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        
        {/* Speaker A Button */}
        <button
          onClick={() => handleSpeakerTap('speaker_a')}
          disabled={isProcessing}
          className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
            isListening && activeSpeaker === 'speaker_a'
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 ring-4 ring-cyan-500/30'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
          }`}
        >
          <Mic className={`w-6 h-6 ${isListening && activeSpeaker === 'speaker_a' ? 'animate-bounce' : 'text-cyan-400'}`} />
          <div className="text-center">
            <p className="text-xs font-bold">{langA.flag} Speaker A</p>
            <p className="text-[10px] opacity-75">{langA.name}</p>
          </div>
        </button>

        {/* Speaker B Button */}
        <button
          onClick={() => handleSpeakerTap('speaker_b')}
          disabled={isProcessing}
          className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
            isListening && activeSpeaker === 'speaker_b'
              ? 'bg-indigo-500 text-white border-indigo-400 ring-4 ring-indigo-500/30'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
          }`}
        >
          <Mic className={`w-6 h-6 ${isListening && activeSpeaker === 'speaker_b' ? 'animate-bounce' : 'text-indigo-400'}`} />
          <div className="text-center">
            <p className="text-xs font-bold">{langB.flag} Speaker B</p>
            <p className="text-[10px] opacity-75">{langB.name}</p>
          </div>
        </button>

      </div>

    </div>
  );
};
