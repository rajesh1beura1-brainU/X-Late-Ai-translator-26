import React from 'react';
import { useXLate } from '../../context/XLateContext';
import { Headphones, Mic, Volume2, RefreshCw, Zap, Radio, Sparkles, CheckCircle2 } from 'lucide-react';

interface AudioSourceSelectorProps {
  compact?: boolean;
  showBoosterOnly?: boolean;
}

export const AudioSourceSelector: React.FC<AudioSourceSelectorProps> = ({ compact, showBoosterOnly }) => {
  const {
    audioDevices,
    selectedAudioDeviceId,
    setSelectedAudioDeviceId,
    lowSoundBoostLevel,
    setLowSoundBoostLevel,
    refreshAudioDevices
  } = useXLate();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAudioDevices();
    setTimeout(() => setRefreshing(false), 500);
  };

  const isHeadsetConnected = audioDevices.some((d) => {
    const lbl = (d.label || '').toLowerCase();
    return (
      lbl.includes('headset') ||
      lbl.includes('earphone') ||
      lbl.includes('airpods') ||
      lbl.includes('bluetooth') ||
      lbl.includes('wired') ||
      lbl.includes('hands-free')
    );
  });

  const selectedDeviceObj = audioDevices.find((d) => d.deviceId === selectedAudioDeviceId);

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 text-xs">
        {/* Earphone / Mic Indicator & Selector */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Headphones className={`w-3.5 h-3.5 shrink-0 ${isHeadsetConnected ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
          <select
            value={selectedAudioDeviceId}
            onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
            className="bg-slate-900 text-slate-200 text-[11px] font-semibold py-1 px-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 cursor-pointer truncate max-w-[150px]"
          >
            <option value="default">🎙️ Default Input Mic</option>
            {audioDevices.map((dev, i) => {
              const label = dev.label || `Mic Input ${i + 1}`;
              const isHeadset = /headset|earphone|airpods|bluetooth|wired|hands-free/i.test(label);
              return (
                <option key={dev.deviceId || i} value={dev.deviceId}>
                  {isHeadset ? `🎧 ${label}` : `🎙️ ${label}`}
                </option>
              );
            })}
          </select>
        </div>

        {/* Low Sound Boost Level Selector */}
        <div className="flex items-center gap-1 shrink-0">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={lowSoundBoostLevel}
            onChange={(e) => setLowSoundBoostLevel(parseFloat(e.target.value))}
            className="bg-slate-900 text-amber-300 font-bold text-[11px] py-1 px-2 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value={1.0}>1x Normal</option>
            <option value={4.0}>4x Soft Voice</option>
            <option value={6.0}>6x Low Music</option>
            <option value={10.0}>10x Ultra Low</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl space-y-3.5 shadow-lg">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Earphones & Low Sound Booster</span>
              {isHeadsetConnected && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Earphones Detected
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              Select earphone/Bluetooth mic input and boost quiet sound & music
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Scan Audio Inputs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* 1. Input Device Selection */}
      {!showBoosterOnly && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Audio Input Mic Source:</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedAudioDeviceId('default')}
              className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all ${
                selectedAudioDeviceId === 'default'
                  ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Mic className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">System Default Mic</p>
                <p className="text-[10px] text-slate-400">Auto default input</p>
              </div>
            </button>

            {audioDevices.map((dev, idx) => {
              const label = dev.label || `Audio Input ${idx + 1}`;
              const isSelected = selectedAudioDeviceId === dev.deviceId;
              const isHeadset = /headset|earphone|airpods|bluetooth|wired|hands-free/i.test(label);

              return (
                <button
                  key={dev.deviceId || idx}
                  onClick={() => setSelectedAudioDeviceId(dev.deviceId)}
                  className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/50 text-purple-200 ring-1 ring-purple-500/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {isHeadset ? (
                    <Headphones className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                  ) : (
                    <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{label}</p>
                    <p className="text-[10px] text-slate-400">
                      {isHeadset ? 'Earphones / Headset Mic' : 'Audio Input'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Low Sound & Music Pre-Amp Gain Booster Presets */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Low Sound & Music Gain Booster:</span>
          </label>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Active: {lowSoundBoostLevel}x Amplification
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { level: 1.0, label: '1x Normal', desc: 'Standard Mic' },
            { level: 4.0, label: '4x Soft Voice', desc: 'Earphone Boost' },
            { level: 6.0, label: '6x Low Music', desc: 'Distant Songs' },
            { level: 10.0, label: '10x Ultra Low', desc: 'Whisper & Soft' }
          ].map((preset) => (
            <button
              key={preset.level}
              onClick={() => setLowSoundBoostLevel(preset.level)}
              className={`p-2 rounded-2xl border text-center transition-all ${
                lowSoundBoostLevel === preset.level
                  ? 'bg-amber-950/80 border-amber-500 text-amber-200 ring-1 ring-amber-500/40 shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-extrabold">{preset.label}</p>
              <p className="text-[9px] text-slate-400">{preset.desc}</p>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
