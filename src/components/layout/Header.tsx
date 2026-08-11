import React, { useState } from 'react';
import { useXLate } from '../../context/XLateContext';
import { GLOBAL_LANGUAGES, searchLanguages, getLanguageByCode } from '../../lib/languages';
import { ArrowRightLeft, Sparkles, Smartphone, ShieldCheck, Zap, ChevronDown, Check } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    swapLanguages,
    userPlan,
    activeDevices,
    setActiveTab
  } = useXLate();

  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const srcObj = getLanguageByCode(sourceLang);
  const tgtObj = getLanguageByCode(targetLang);

  const filteredLangs = searchLanguages(searchQuery);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Live Indicator */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-lg tracking-tight text-white">X-Late</h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                  AI LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Live Speech → Live Translation → Live Meaning</p>
            </div>
          </div>

          {/* Quick Stats Badges for Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
            >
              <Zap className="w-3 h-3 text-indigo-400" />
              <span>{userPlan ? `${userPlan.remainingSessions} Left` : '5 Free'}</span>
            </button>
          </div>
        </div>

        {/* Language Selector Pair */}
        <div className="flex items-center justify-center gap-2 w-full md:w-auto bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          
          {/* Source Language Selector */}
          <div className="relative flex-1 md:flex-none">
            <button
              onClick={() => {
                setShowSourceDropdown(!showSourceDropdown);
                setShowTargetDropdown(false);
              }}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-all w-full md:w-44 border border-slate-700/50"
            >
              <span className="truncate flex items-center gap-1.5">
                <span>{srcObj.flag}</span>
                <span className="text-white font-semibold">{srcObj.name}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showSourceDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 max-h-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden flex flex-col">
                <input
                  type="text"
                  placeholder="Search languages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 mb-2 focus:outline-none focus:border-cyan-500"
                />
                <div className="overflow-y-auto flex-1 space-y-0.5">
                  {filteredLangs.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSourceLang(lang.code);
                        setShowSourceDropdown(false);
                        setSearchQuery('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors ${
                        sourceLang === lang.code
                          ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                        {lang.isIndian && (
                          <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded">IN</span>
                        )}
                      </span>
                      {sourceLang === lang.code && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Swap Button */}
          <button
            onClick={swapLanguages}
            title="Swap Languages"
            className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-200 border border-slate-700/50 hover:border-indigo-500/40 transition-all active:scale-95"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>

          {/* Target Language Selector */}
          <div className="relative flex-1 md:flex-none">
            <button
              onClick={() => {
                setShowTargetDropdown(!showTargetDropdown);
                setShowSourceDropdown(false);
              }}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-indigo-950/50 hover:bg-indigo-900/50 text-indigo-200 text-xs font-medium transition-all w-full md:w-44 border border-indigo-500/30"
            >
              <span className="truncate flex items-center gap-1.5">
                <span>{tgtObj.flag}</span>
                <span className="text-indigo-100 font-semibold">{tgtObj.name}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            {showTargetDropdown && (
              <div className="absolute top-full right-0 mt-2 w-64 max-h-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden flex flex-col">
                <input
                  type="text"
                  placeholder="Search target language..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 mb-2 focus:outline-none focus:border-indigo-500"
                />
                <div className="overflow-y-auto flex-1 space-y-0.5">
                  {filteredLangs.filter(l => l.code !== 'auto').map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTargetLang(lang.code);
                        setShowTargetDropdown(false);
                        setSearchQuery('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors ${
                        targetLang === lang.code
                          ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                        {lang.isIndian && (
                          <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded">IN</span>
                        )}
                      </span>
                      {targetLang === lang.code && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Desktop Info & Device Limit Indicator */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>{activeDevices.length}/2 Active Devices</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/30 to-violet-600/30 border border-indigo-500/30 text-indigo-200 hover:text-white text-xs font-medium transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{userPlan ? `${userPlan.remainingSessions} Sessions` : '5 Free'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
