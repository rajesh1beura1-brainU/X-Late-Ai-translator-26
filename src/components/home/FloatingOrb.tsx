import React from 'react';
import { Mic, MicOff, Loader2, Radio } from 'lucide-react';

interface FloatingOrbProps {
  isListening: boolean;
  isProcessing: boolean;
  volume: number;
  onTap: () => void;
}

export const FloatingOrb: React.FC<FloatingOrbProps> = ({
  isListening,
  isProcessing,
  volume,
  onTap
}) => {
  // Volume scaling for orb rings
  const scale = 1 + Math.min(volume * 0.8, 0.4);

  return (
    <div className="relative flex flex-col items-center justify-center my-2">
      
      {/* Outer Pulse Wave Rings */}
      <div
        className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
          isListening
            ? 'w-52 h-52 bg-cyan-500/15 animate-ping opacity-75'
            : isProcessing
            ? 'w-48 h-48 bg-indigo-500/20 animate-spin opacity-50'
            : 'w-40 h-40 bg-slate-800/20'
        }`}
        style={{ transform: `scale(${scale})` }}
      />

      <div
        className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
          isListening
            ? 'w-44 h-44 bg-cyan-400/20 blur-xl'
            : isProcessing
            ? 'w-40 h-40 bg-violet-500/25 blur-xl'
            : 'w-36 h-36 bg-indigo-500/10 blur-lg'
        }`}
      />

      {/* Main Interactive Floating Orb Button */}
      <button
        onClick={onTap}
        disabled={isProcessing}
        className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center text-white transition-all duration-300 transform active:scale-95 shadow-2xl ${
          isListening
            ? 'bg-gradient-to-tr from-cyan-500 via-teal-400 to-indigo-600 ring-4 ring-cyan-400/50 shadow-cyan-500/50'
            : isProcessing
            ? 'bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 ring-4 ring-violet-400/50 shadow-violet-500/50'
            : 'bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 hover:from-indigo-900 hover:to-slate-800 ring-2 ring-indigo-500/30 hover:ring-indigo-400/60 shadow-indigo-950/80'
        }`}
      >
        {/* Glow Core */}
        <div className="absolute inset-1.5 rounded-full bg-slate-950/40 backdrop-blur-md flex flex-col items-center justify-center gap-1.5 p-3">
          {isProcessing ? (
            <Loader2 className="w-8 h-8 text-violet-300 animate-spin" />
          ) : isListening ? (
            <Radio className="w-8 h-8 text-cyan-200 animate-pulse" />
          ) : (
            <Mic className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform" />
          )}

          <span className="text-[10px] font-bold uppercase tracking-wider text-center">
            {isListening
              ? 'Listening...'
              : isProcessing
              ? 'Translating...'
              : 'Tap & Speak'}
          </span>
        </div>
      </button>

      {/* Subtitle / Helper Tag */}
      <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-400">
        <span
          className={`w-2 h-2 rounded-full ${
            isListening
              ? 'bg-cyan-400 animate-ping'
              : isProcessing
              ? 'bg-violet-400 animate-pulse'
              : 'bg-emerald-400'
          }`}
        />
        <span>
          {isListening
            ? 'Translating continuously with 1s gap'
            : isProcessing
            ? 'Gemini 3.6 AI extracting intent & meaning'
            : 'One tap to live translate speech'}
        </span>
      </div>

    </div>
  );
};
