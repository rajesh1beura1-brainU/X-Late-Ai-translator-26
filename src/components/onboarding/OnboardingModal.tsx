import React, { useState } from 'react';
import { Mic, Sparkles, Smartphone, ArrowRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const screens = [
    {
      title: 'Speak Naturally',
      subtitle: 'Speak in any language without technical delays or complex UI.',
      icon: <Mic className="w-12 h-12 text-cyan-400" />,
      color: 'from-cyan-500/20 to-indigo-500/20'
    },
    {
      title: 'Understand Intent',
      subtitle: 'X-Late translates speech and extracts ultra-short AI intent meaning instantly.',
      icon: <Sparkles className="w-12 h-12 text-indigo-400 animate-pulse" />,
      color: 'from-indigo-500/20 to-violet-500/20'
    },
    {
      title: 'Connect & Remind',
      subtitle: 'AI automatically detects commitments, schedules reminders, and syncs calendar.',
      icon: <Smartphone className="w-12 h-12 text-amber-400" />,
      color: 'from-amber-500/20 to-cyan-500/20'
    }
  ];

  const current = screens[step];

  const handleNext = () => {
    if (step < screens.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-6">
        
        {/* Step Visual Card */}
        <div className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${current.color} border border-slate-700/50 flex items-center justify-center shadow-inner`}>
          {current.icon}
        </div>

        {/* Text */}
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
            Step {step + 1} of 3
          </p>
          <h2 className="text-xl font-bold text-white">{current.title}</h2>
          <p className="text-xs text-slate-400 leading-relaxed px-2">{current.subtitle}</p>
        </div>

        {/* Step Indicator Dots */}
        <div className="flex items-center gap-2">
          {screens.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-cyan-400' : 'w-2 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-xs text-white shadow-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span>{step === screens.length - 1 ? 'Start Using X-Late' : 'Next'}</span>
          {step === screens.length - 1 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        </button>

      </div>
    </div>
  );
};
