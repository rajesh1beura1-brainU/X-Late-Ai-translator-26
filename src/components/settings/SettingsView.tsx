import React, { useState } from 'react';
import { useXLate } from '../../context/XLateContext';
import { getLanguageByCode, GLOBAL_LANGUAGES } from '../../lib/languages';
import { AudioSourceSelector } from '../common/AudioSourceSelector';
import confetti from 'canvas-confetti';
import { Smartphone, Zap, ShieldCheck, Lock, Globe, Mail, Calendar, Key, RefreshCw, CheckCircle2, AlertTriangle, Trash2, Wifi, WifiOff, Download, Database } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    deviceId,
    activeDevices,
    revokeDevice,
    userPlan,
    buySessionPack,
    refreshCredits,
    userProfile,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    deviceRevokedMessage,
    isOffline,
    offlinePacks,
    refreshOfflinePacks
  } = useXLate();

  const [buyLoading, setBuyLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const handleBuyPack = async () => {
    setBuyLoading(true);
    await buySessionPack();
    setBuyLoading(false);
    setPurchaseSuccess(true);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => setPurchaseSuccess(false), 3000);
  };

  const handleRefreshCredits = async () => {
    setRefreshLoading(true);
    await refreshCredits(100);
    setRefreshLoading(false);
    setRefreshSuccess(true);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setRefreshSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-6 pb-20">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <span>System Settings & Audio Inputs</span>
        </h2>
        <p className="text-xs text-slate-400">Earphone mic selection, low sound amplification, and device security</p>
      </div>

      {/* Audio Input Device & Earphone Mic / Low Sound Booster Settings */}
      <AudioSourceSelector />

      {/* Offline Mode & IndexedDB Libraries Status Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Offline Translation Engine</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  isOffline ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {isOffline ? 'Offline Mode Active' : 'Online Sync Ready'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                IndexedDB offline translation libraries & local caching
              </p>
            </div>
          </div>
          {isOffline ? <WifiOff className="w-5 h-5 text-amber-400" /> : <Wifi className="w-5 h-5 text-emerald-400" />}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold text-slate-400">Installed Offline Packs:</span>
            <button
              onClick={refreshOfflinePacks}
              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Status</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {offlinePacks.length > 0 ? (
              offlinePacks.map((pack: any) => (
                <div
                  key={pack.langCode}
                  className="bg-slate-950 border border-purple-500/30 rounded-2xl p-2.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white uppercase">{pack.langCode}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{pack.name}</p>
                  <p className="text-[10px] text-cyan-400 font-bold">{pack.wordCount} words ({pack.sizeMb})</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 col-span-3">Loading offline dictionaries into IndexedDB...</p>
            )}
          </div>
          <p className="text-[11px] text-slate-400 pt-1 italic">
            💡 Offline libraries allow instant translation without internet using local IndexedDB word maps.
          </p>
        </div>
      </div>

      {/* Auto Revocation Alert Toast */}
      {deviceRevokedMessage && (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-2xl p-4 flex items-center gap-3 text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{deviceRevokedMessage}</span>
        </div>
      )}

      {/* 1. DEVICE MANAGEMENT (STRICT MAX 2 DEVICES RULE - CRITICAL REQUIREMENT) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Device Session Management</h3>
              <p className="text-[11px] text-slate-400">Strict limit: MAX 2 ACTIVE DEVICES per account</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {activeDevices.length} / 2 Active
          </span>
        </div>

        <div className="space-y-2.5">
          {activeDevices.map((device) => {
            const isThisDevice = device.deviceId === deviceId;

            return (
              <div
                key={device.deviceId}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  isThisDevice
                    ? 'bg-cyan-950/30 border-cyan-500/40 ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{device.deviceName}</span>
                    {isThisDevice && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300">
                        This Device
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {device.os} • {device.browser} • IP: {device.ip}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Last active: {new Date(device.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {!isThisDevice && (
                  <button
                    onClick={() => revokeDevice(device.deviceId)}
                    className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PRICING MODEL & SESSION PACKS ($5 PACK - CRITICAL REQUIREMENT) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Live Translation Sessions</h3>
              <p className="text-[11px] text-slate-400">Configurable backend entitlement packs</p>
            </div>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {userPlan ? `${userPlan.remainingSessions} Sessions Left` : '5 Free'}
          </span>
        </div>

        {/* Free vs Paid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-300">TESTING CREDITS</h4>
              <p className="text-xs text-slate-400">100 live translation credits refreshed for testing.</p>
            </div>
            <button
              onClick={handleRefreshCredits}
              disabled={refreshLoading}
              className="w-full mt-2 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 font-bold text-xs text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshLoading ? 'animate-spin' : ''}`} />
              <span>{refreshLoading ? 'Refreshing...' : 'Refresh 100 Credits'}</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white">$5 SESSION PACK</h4>
              <span className="text-xs font-extrabold text-amber-400">$5.00</span>
            </div>
            <p className="text-xs text-slate-300">Adds +20 live translation sessions (20 mins each).</p>
            <button
              onClick={handleBuyPack}
              disabled={buyLoading}
              className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-xs text-white shadow-lg hover:opacity-90 transition-opacity"
            >
              {buyLoading ? 'Processing...' : 'Purchase $5 Pack (+20 Sessions)'}
            </button>
          </div>
        </div>

        {purchaseSuccess && (
          <p className="text-xs text-emerald-400 font-bold text-center animate-fadeIn">
            ✓ Purchase successful! +20 sessions added to your account balance.
          </p>
        )}

        {refreshSuccess && (
          <p className="text-xs text-cyan-400 font-bold text-center animate-fadeIn">
            ✓ Successfully refreshed 100 live translation credits!
          </p>
        )}
      </div>

      {/* 3. DEFAULT LANGUAGE PAIR SELECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Globe className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Default Languages</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Default Source</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              {GLOBAL_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Default Target</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              {GLOBAL_LANGUAGES.filter(l => l.code !== 'auto').map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. PRIVACY & SECURITY ARCHITECTURE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-lg">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Lock className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Privacy & On-Device Security</h3>
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">Local-First AES-GCM Encrypted Storage</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Conversations are encrypted on-device. Raw voice audio is never retained on servers.
          </p>
        </div>
      </div>

    </div>
  );
};
