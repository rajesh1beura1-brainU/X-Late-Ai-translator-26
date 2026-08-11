import React, { useState } from 'react';
import { useXLate } from '../../context/XLateContext';
import { FloatingOrb } from './FloatingOrb';
import { ConversationView } from './ConversationView';
import { getLanguageByCode } from '../../lib/languages';
import { AudioSourceSelector } from '../common/AudioSourceSelector';
import { Volume2, Users, Save, CheckSquare, Send, Sparkles, Mic, Radio, ArrowRightLeft, Music } from 'lucide-react';

export const HomeView: React.FC = () => {
  const {
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    swapLanguages,
    isListening,
    isProcessing,
    isLiveTranslating,
    audioVolume,
    liveTranscript,
    liveTranslation,
    currentTurn,
    startListening,
    stopListeningAndTranslate,
    translateText,
    playVoice,
    saveSessionToHistory,
    addTaskManually,
    setActiveTab
  } = useXLate();

  const [mode, setMode] = useState<'single' | 'conversation'>('single');
  const [manualText, setManualText] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addedTaskTitle, setAddedTaskTitle] = useState<string | null>(null);

  const srcLangObj = getLanguageByCode(sourceLang);
  const tgtLangObj = getLanguageByCode(targetLang);

  const handleOrbTap = async () => {
    if (isListening) {
      await stopListeningAndTranslate();
    } else {
      await startListening('user');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const txt = manualText;
    setManualText('');
    await translateText(txt, 'user');
  };

  const handleSaveToHistory = async () => {
    await saveSessionToHistory();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleAddTaskFromTurn = async (candidate: any) => {
    await addTaskManually({
      title: candidate.title,
      description: candidate.description || `Extracted from speech: "${currentTurn?.originalText}"`,
      dueDate: candidate.dueDate || new Date().toISOString().split('T')[0],
      dueTime: candidate.dueTime || '10:00',
      priority: candidate.priority || 'NORMAL'
    });
    setAddedTaskTitle(candidate.title);
    setTimeout(() => setAddedTaskTitle(null), 3000);
  };

  if (mode === 'conversation') {
    return <ConversationView />;
  }

  const activeOriginalWords = liveTranscript || currentTurn?.originalText || '';
  const activeTranslatedText = liveTranslation || currentTurn?.translatedText || '';

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-130px)] max-w-xl mx-auto px-4 py-2 space-y-4">
      
      {/* 1. Top Bar: Language Pair Selector & Mode Switcher */}
      <div className="w-full flex flex-col gap-2 bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl shadow-md">
        <div className="flex items-center justify-between gap-2 text-xs">
          {/* Source Language */}
          <div className="flex-1 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span>{srcLangObj.flag}</span>
            <span className="font-bold text-slate-200 truncate">{srcLangObj.name}</span>
          </div>

          <button
            onClick={swapLanguages}
            className="p-2 rounded-xl bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 transition-colors"
            title="Swap Languages"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>

          {/* Target Language */}
          <div className="flex-1 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span>{tgtLangObj.flag}</span>
            <span className="font-bold text-cyan-300 truncate">{tgtLangObj.name}</span>
          </div>
        </div>

        {/* Mode Switcher Pill */}
        <div className="flex items-center justify-center gap-1 bg-slate-950 p-1 rounded-xl">
          <button
            onClick={() => setMode('single')}
            className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
              mode === 'single' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Speech
          </button>
          <button
            onClick={() => setMode('conversation')}
            className={`flex-1 py-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
              mode === 'conversation' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>2-Person</span>
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className="flex-1 py-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 bg-purple-950/80 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 transition-all shadow-sm"
          >
            <Music className="w-3 h-3 text-purple-400" />
            <span>Song Lyrics</span>
          </button>
        </div>

        {/* Earphone Input & Low Sound Boost Bar */}
        <AudioSourceSelector compact />
      </div>

      {/* 2. HERO SECTION: LIVE TRANSLATION DISPLAY (COVERING MORE FRONT SCREEN WITH BIGGER FONT) */}
      <div className="w-full flex-1 flex flex-col justify-between bg-gradient-to-b from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-cyan-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden space-y-4">
        
        {/* Glow backdrop accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="space-y-3 z-10">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-extrabold tracking-wider uppercase text-cyan-400">
                Live Translation ({tgtLangObj.name})
              </span>
            </div>

            {currentTurn && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => playVoice(currentTurn.translatedText, currentTurn.targetLang)}
                  className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
                  title="Play Audio Voice"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveToHistory}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Save Session"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* MAIN BIGGER FONT TRANSLATED TEXT */}
          <div className="min-h-[110px] flex flex-col items-center justify-center text-center p-2">
            {activeTranslatedText ? (
              <div className="space-y-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-white leading-relaxed tracking-wide drop-shadow-md">
                  "{activeTranslatedText}"
                </p>
                {isLiveTranslating && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-cyan-400 font-medium animate-pulse">
                    <Radio className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Live Translating...</span>
                  </div>
                )}
              </div>
            ) : isProcessing ? (
              <p className="text-xl font-bold text-violet-300 animate-pulse flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-violet-400 animate-spin" />
                <span>Translating live...</span>
              </p>
            ) : (
              <p className="text-lg font-medium text-slate-500 italic">
                {isListening ? "Listening... Speak naturally for instant live translation" : "Tap microphone below to start live translation"}
              </p>
            )}
          </div>

          {/* Intent / Meaning AI Badge */}
          {currentTurn?.intent && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Intent: {currentTurn.intent}</span>
            </div>
          )}

          {/* Auto Commitment Toast */}
          {currentTurn?.detectedTasks && currentTurn.detectedTasks.length > 0 && (
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-400" />
                <span className="text-amber-200 font-medium">{currentTurn.detectedTasks[0].title}</span>
              </div>
              <button
                onClick={() => handleAddTaskFromTurn(currentTurn.detectedTasks![0])}
                className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold text-[11px]"
              >
                {addedTaskTitle ? 'Added!' : '+ Reminder'}
              </button>
            </div>
          )}

          {saveSuccess && (
            <p className="text-xs text-emerald-400 font-bold text-center">
              ✓ Saved to encrypted history!
            </p>
          )}
        </div>

        {/* 3. SPEAKER LIVE WORDS SECTION (POSITIONED DIRECTLY BELOW LIVE TRANSLATION) */}
        <div className="z-10 bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-slate-300">
              <Mic className="w-3.5 h-3.5 text-cyan-400" />
              <span>Speaker Live Words ({srcLangObj.name})</span>
            </span>
            {isListening && (
              <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>Far-Field Mic Active (3.5x Boost)</span>
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-slate-300 italic min-h-[28px]">
            {activeOriginalWords ? `"${activeOriginalWords}"` : "Spoken words will appear here in real time..."}
          </p>
        </div>

      </div>

      {/* 4. MICROPHONE ORB AT MIDDLE BOTTOM */}
      <div className="w-full flex flex-col items-center justify-center space-y-2 pt-1">
        
        <FloatingOrb
          isListening={isListening}
          isProcessing={isProcessing}
          volume={audioVolume}
          onTap={handleOrbTap}
        />

        {/* Text Input Fallback Bar */}
        <form onSubmit={handleManualSubmit} className="w-full max-w-md relative flex items-center">
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={`Or type text in ${srcLangObj.name}...`}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 pr-10 shadow-inner"
          />
          <button
            type="submit"
            disabled={!manualText.trim() || isProcessing}
            className="absolute right-1.5 p-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-40 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

    </div>
  );
};

