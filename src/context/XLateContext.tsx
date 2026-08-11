import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ActiveTab,
  Language,
  TranslationTurn,
  ConversationSession,
  AITask,
  DeviceSession,
  UserPlan,
  UserProfile,
  SongLyricsResult
} from '../types';
import { GLOBAL_LANGUAGES, getLanguageByCode } from '../lib/languages';
import { liveAudioEngine, LiveAudioEngine, getAudioInputDevices } from '../lib/audioEngine';
import { instantLocalTranslate, generateLocalSongLyricsFallback } from '../lib/instantTranslator';
import { encryptData, decryptData } from '../lib/cryptoStorage';
import {
  initOfflineEngine,
  cacheTranslationOffline,
  translateOffline,
  getOfflineLanguagePacks,
  installOfflinePack
} from '../lib/offlineEngine';

interface XLateContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sourceLang: string;
  setSourceLang: (code: string) => void;
  targetLang: string;
  setTargetLang: (code: string) => void;
  swapLanguages: () => void;
  
  // Offline Mode & Libraries
  isOffline: boolean;
  offlinePacks: any[];
  refreshOfflinePacks: () => Promise<void>;
  
  // Live State & Audio Input
  isListening: boolean;
  isProcessing: boolean;
  isLiveTranslating: boolean;
  audioVolume: number;
  liveTranscript: string;
  liveTranslation: string;
  currentTurn: TranslationTurn | null;
  conversationTurns: TranslationTurn[];

  // Audio Device & Low Sound Boost
  audioDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  setSelectedAudioDeviceId: (deviceId: string) => void;
  lowSoundBoostLevel: number;
  setLowSoundBoostLevel: (level: number) => void;
  refreshAudioDevices: () => Promise<void>;
  
  // Device & Auth
  deviceId: string;
  activeDevices: DeviceSession[];
  userProfile: UserProfile | null;
  userPlan: UserPlan | null;
  deviceRevokedMessage: string | null;

  // History & Tasks
  historySessions: ConversationSession[];
  tasks: AITask[];
  morningAlerts: AITask[];

  // Actions
  startListening: (speaker?: 'user' | 'partner' | 'speaker_a' | 'speaker_b') => Promise<void>;
  stopListeningAndTranslate: () => Promise<TranslationTurn | null>;
  translateText: (text: string, speaker?: 'user' | 'partner' | 'speaker_a' | 'speaker_b') => Promise<TranslationTurn | null>;
  playVoice: (text: string, langCode: string) => void;
  saveSessionToHistory: (title?: string) => Promise<ConversationSession>;
  deleteHistorySession: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  buySessionPack: () => Promise<void>;
  refreshCredits: (count?: number) => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  toggleTaskDone: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addTaskManually: (task: Partial<AITask>) => Promise<AITask>;
  currentSongLyrics: SongLyricsResult | null;
  isTranslatingSong: boolean;
  translateSongLyricsFromAudio: (audioBlob: Blob) => Promise<SongLyricsResult | null>;
  translateSongLyricsFromText: (text: string) => Promise<SongLyricsResult | null>;
  ackMorningAlert: (taskId: string) => Promise<void>;
  resetCurrentLiveSession: () => void;
}

const XLateContext = createContext<XLateContextType | null>(null);

export const XLateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [sourceLang, setSourceLang] = useState<string>('auto');
  const [targetLang, setTargetLang] = useState<string>('hi-IN');

  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLiveTranslating, setIsLiveTranslating] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [liveTranslation, setLiveTranslation] = useState<string>('');

  const [currentTurn, setCurrentTurn] = useState<TranslationTurn | null>(null);
  const [conversationTurns, setConversationTurns] = useState<TranslationTurn[]>([]);

  const [deviceId, setDeviceId] = useState<string>(() => {
    let id = localStorage.getItem('xlate_device_id');
    if (!id) {
      id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem('xlate_device_id', id);
    }
    return id;
  });

  const [activeDevices, setActiveDevices] = useState<DeviceSession[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [deviceRevokedMessage, setDeviceRevokedMessage] = useState<string | null>(null);

  const [historySessions, setHistorySessions] = useState<ConversationSession[]>([]);
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [morningAlerts, setMorningAlerts] = useState<AITask[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'partner' | 'speaker_a' | 'speaker_b'>('user');

  const [currentSongLyrics, setCurrentSongLyrics] = useState<SongLyricsResult | null>(null);
  const [isTranslatingSong, setIsTranslatingSong] = useState<boolean>(false);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('default');
  const [lowSoundBoostLevel, setLowSoundBoostLevel] = useState<number>(4.0);

  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlinePacks, setOfflinePacks] = useState<any[]>([]);

  const refreshOfflinePacks = async () => {
    try {
      const packs = await getOfflineLanguagePacks();
      setOfflinePacks(packs);
    } catch (err) {
      console.warn('Failed to load offline packs:', err);
    }
  };

  useEffect(() => {
    initOfflineEngine().then(() => {
      refreshOfflinePacks();
    });

    if (typeof window !== 'undefined') {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const refreshAudioDevices = async () => {
    try {
      const devices = await getAudioInputDevices();
      setAudioDevices(devices);
      if (devices.length > 0) {
        const headsetDevice = devices.find(d => {
          const lbl = (d.label || '').toLowerCase();
          return lbl.includes('headset') || lbl.includes('earphone') || lbl.includes('airpods') || lbl.includes('bluetooth') || lbl.includes('wired') || lbl.includes('hands-free');
        });
        if (headsetDevice && headsetDevice.deviceId && selectedAudioDeviceId === 'default') {
          setSelectedAudioDeviceId(headsetDevice.deviceId);
        }
      }
    } catch (err) {
      console.warn('Audio devices fetch notice:', err);
    }
  };

  useEffect(() => {
    refreshAudioDevices();
    if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDevChange = () => refreshAudioDevices();
      navigator.mediaDevices.addEventListener('devicechange', handleDevChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDevChange);
      };
    }
  }, []);

  const liveDebounceTimer = React.useRef<any>(null);

  const getAuthToken = () => {
    return localStorage.getItem('xlate_auth_token') || sessionStorage.getItem('xlate_auth_token') || '';
  };

  const authFetch = React.useCallback((url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers = new Headers(options.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  }, []);

  // Fetch History from API & Local Encrypted Cache
  const fetchHistory = React.useCallback(async () => {
    try {
      const res = await authFetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistorySessions(data);
        const encrypted = await encryptData(data);
        localStorage.setItem('xlate_encrypted_history', encrypted);
      }
    } catch {
      const cached = localStorage.getItem('xlate_encrypted_history');
      if (cached) {
        const decrypted = await decryptData<ConversationSession[]>(cached);
        if (decrypted) setHistorySessions(decrypted);
      }
    }
  }, [authFetch]);

  // Fetch Tasks
  const fetchTasks = React.useCallback(async () => {
    try {
      const res = await authFetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
        const encrypted = await encryptData(data);
        if (encrypted) localStorage.setItem('xlate_encrypted_tasks', encrypted);
      }
    } catch (err: any) {
      console.warn('Fetch tasks fallback to encrypted local cache:', err?.message || err);
      try {
        const cached = localStorage.getItem('xlate_encrypted_tasks');
        if (cached) {
          const decrypted = await decryptData<AITask[]>(cached);
          if (Array.isArray(decrypted)) setTasks(decrypted);
        }
      } catch {
        // Safe fallback
      }
    }
  }, [authFetch]);

  // Fetch Morning Alerts
  const fetchMorningAlerts = React.useCallback(async () => {
    try {
      const res = await authFetch('/api/tasks/morning-alerts');
      if (res.ok) {
        const data = await res.json();
        setMorningAlerts(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.warn('Morning alerts fetch notice:', err?.message || err);
    }
  }, [authFetch]);

  // Initialize Auth Session & Register Device
  useEffect(() => {
    async function initSession() {
      try {
        const savedToken = getAuthToken();
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(savedToken ? { 'Authorization': `Bearer ${savedToken}` } : {})
          },
          body: JSON.stringify({
            deviceId,
            deviceName: 'Mobile Web App',
            os: navigator.platform || 'Web',
            browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser'
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            localStorage.setItem('xlate_auth_token', data.token);
          }
          setUserProfile(data.profile);
          setUserPlan(data.plan);
          setActiveDevices(data.activeDevices || []);
          if (data.revokedOldestDevice) {
            setDeviceRevokedMessage(`Active device limit (2) reached. Oldest device "${data.revokedOldestDevice}" was automatically revoked.`);
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        fetchTasks();
        fetchHistory();
        fetchMorningAlerts();
      }
    }

    initSession();
  }, [deviceId, fetchTasks, fetchHistory, fetchMorningAlerts]);

  const swapLanguages = () => {
    if (sourceLang === 'auto') {
      setSourceLang(targetLang);
      setTargetLang('en-US');
    } else {
      const temp = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(temp);
    }
  };

  const lastProcessedTextRef = React.useRef<string>('');
  const translatorWorkerRef = React.useRef<Worker | null>(null);
  const workerThrottleTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        const worker = new Worker(
          new URL('../workers/translatorWorker.ts', import.meta.url),
          { type: 'module' }
        );
        worker.onmessage = (e: MessageEvent) => {
          const { translatedText } = e.data;
          if (translatedText !== undefined) {
            setLiveTranslation(translatedText);
          }
        };
        translatorWorkerRef.current = worker;
      } catch (err) {
        console.warn('Web Worker fallback to synchronous local translation engine:', err);
      }
    }

    return () => {
      if (translatorWorkerRef.current) {
        translatorWorkerRef.current.terminate();
        translatorWorkerRef.current = null;
      }
      if (workerThrottleTimerRef.current) {
        clearTimeout(workerThrottleTimerRef.current);
      }
    };
  }, []);

  const requestSeqRef = React.useRef<number>(0);
  const apiCooldownUntilRef = React.useRef<number>(0);
  const translationCacheRef = React.useRef<Map<string, TranslationTurn>>(new Map());

  const handleLiveSpeechUpdate = (spokenText: string, speaker: 'user' | 'partner' | 'speaker_a' | 'speaker_b') => {
    if (!spokenText || !spokenText.trim()) return;
    const cleanText = spokenText.trim();
    setLiveTranscript(cleanText);

    const isSpeakerB = speaker === 'speaker_b' || speaker === 'partner';
    const src = isSpeakerB ? targetLang : sourceLang;
    const tgt = isSpeakerB ? sourceLang : targetLang;

    // Offload local dictionary translation to Web Worker off the main UI thread (instant 0ms response)
    if (translatorWorkerRef.current) {
      translatorWorkerRef.current.postMessage({
        id: `tx_${Date.now()}`,
        text: cleanText,
        sourceLang: src,
        targetLang: tgt
      });
    } else {
      const instantTrans = instantLocalTranslate(cleanText, src, tgt);
      if (instantTrans) {
        setLiveTranslation(instantTrans);
      }
    }

    if (liveDebounceTimer.current) {
      clearTimeout(liveDebounceTimer.current);
    }

    const seq = ++requestSeqRef.current;

    // 500ms debounce for AI contextual refinement in background while microphone listens continuously
    liveDebounceTimer.current = setTimeout(async () => {
      // If API is on rate-limit cooldown, skip remote API for live partial updates (instant local worker translation handles partials)
      if (Date.now() < apiCooldownUntilRef.current) return;

      if (cleanText && cleanText !== lastProcessedTextRef.current) {
        lastProcessedTextRef.current = cleanText;
        setIsLiveTranslating(true);
        const turn = await translateText(cleanText, speaker, true, seq);
        if (turn && turn.translatedText && seq === requestSeqRef.current) {
          setLiveTranslation(turn.translatedText);
        }
        setIsLiveTranslating(false);
      }
    }, 500);
  };

  const handleUtteranceFinalized = async (finalText: string, speaker: 'user' | 'partner' | 'speaker_a' | 'speaker_b') => {
    if (!finalText || !finalText.trim()) return;
    const cleanText = finalText.trim();

    const seq = ++requestSeqRef.current;

    if (liveDebounceTimer.current) {
      clearTimeout(liveDebounceTimer.current);
    }

    const turn = await translateText(cleanText, speaker, false, seq);
    if (turn) {
      setCurrentTurn(turn);
      setConversationTurns(prev => [...prev, turn]);
      setLiveTranscript('');
      setLiveTranslation('');
      if (userProfile?.autoSpeakTranslation) {
        LiveAudioEngine.speakText(turn.translatedText, turn.targetLang);
      }
    }
  };

  const processAudioSliceLive = async (blob: Blob, speaker: 'user' | 'partner' | 'speaker_a' | 'speaker_b') => {
    if (!blob || blob.size < 1200) return;
    const isSpeakerB = speaker === 'speaker_b' || speaker === 'partner';
    const src = isSpeakerB ? targetLang : sourceLang;
    const tgt = isSpeakerB ? sourceLang : targetLang;

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64Data = res.split(',')[1];
          resolve(base64Data);
        };
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      const res = await authFetch('/api/translate/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Data,
          mimeType: blob.type || 'audio/webm',
          sourceLang: src,
          targetLang: tgt
        })
      });

      if (res.ok) {
        const data = await res.json();
        const turn: TranslationTurn = {
          id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          speaker,
          originalText: data.originalText,
          translatedText: data.translatedText,
          sourceLang: data.sourceLangCode,
          targetLang: data.targetLangCode,
          intent: data.intent,
          timestamp: new Date().toISOString(),
          detectedTasks: data.detectedTasks
        };
        setCurrentTurn(turn);
        setConversationTurns(prev => [...prev, turn]);
        if (data.remainingSessions !== undefined && userPlan) {
          setUserPlan({ ...userPlan, remainingSessions: data.remainingSessions });
        }
        fetchTasks();
        if (userProfile?.autoSpeakTranslation) {
          LiveAudioEngine.speakText(turn.translatedText, turn.targetLang);
        }
      }
    } catch (err) {
      console.warn('Live audio slice processing warning:', err);
    }
  };

  const startListening = async (speaker: 'user' | 'partner' | 'speaker_a' | 'speaker_b' = 'user') => {
    setActiveSpeaker(speaker);
    setIsListening(true);
    setAudioVolume(0.2);
    setLiveTranscript('');
    setLiveTranslation('');
    lastProcessedTextRef.current = '';

    const isSpeakerB = speaker === 'speaker_b' || speaker === 'partner';
    const listenLang = isSpeakerB ? targetLang : sourceLang;

    await liveAudioEngine.startListening(
      listenLang,
      {
        continuous: true,
        interimResults: true,
        onSpeechStart: () => setIsListening(true),
        onVolumeChange: (vol) => setAudioVolume(vol),
        onTranscriptPartial: (partialText) => {
          handleLiveSpeechUpdate(partialText, speaker);
        },
        onTranscriptFinal: (finalText) => {
          handleUtteranceFinalized(finalText, speaker);
        },
        onAudioSlice: (sliceBlob) => {
          processAudioSliceLive(sliceBlob, speaker);
        },
        onError: (err) => {
          console.warn('Audio engine error:', err);
        }
      },
      {
        deviceId: selectedAudioDeviceId,
        gainBoostLevel: lowSoundBoostLevel
      }
    );
  };

  const stopListeningAndTranslate = async (): Promise<TranslationTurn | null> => {
    setIsListening(false);
    setAudioVolume(0);

    const blob = await liveAudioEngine.stopListening();
    let turn: TranslationTurn | null = null;

    const isSpeakerB = activeSpeaker === 'speaker_b' || activeSpeaker === 'partner';
    const src = isSpeakerB ? targetLang : sourceLang;
    const tgt = isSpeakerB ? sourceLang : targetLang;

    const remainingText = liveTranscript.trim();
    if (remainingText) {
      const remainingTranslation = liveTranslation.trim() || instantLocalTranslate(remainingText, src, tgt) || remainingText;
      turn = {
        id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        speaker: activeSpeaker,
        originalText: remainingText,
        translatedText: remainingTranslation,
        sourceLang: src,
        targetLang: tgt,
        intent: 'Live Speech Translation',
        timestamp: new Date().toISOString(),
        detectedTasks: []
      };

      setCurrentTurn(turn);
      setConversationTurns(prev => [...prev, turn!]);
      setLiveTranscript('');
      setLiveTranslation('');

      if (userProfile?.autoSpeakTranslation && turn.translatedText) {
        LiveAudioEngine.speakText(turn.translatedText, turn.targetLang);
      }
      setIsProcessing(false);
      return turn;
    }

    if (conversationTurns.length > 0) {
      return conversationTurns[conversationTurns.length - 1];
    }

    setIsProcessing(true);
    if (blob && blob.size > 1000) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64Data = res.split(',')[1];
          resolve(base64Data);
        };
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      try {
        const res = await authFetch('/api/translate/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: blob.type || 'audio/webm',
            sourceLang: src,
            targetLang: tgt
          })
        });

        if (res.ok) {
          const data = await res.json();
          turn = {
            id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            speaker: activeSpeaker,
            originalText: data.originalText,
            translatedText: data.translatedText,
            sourceLang: data.sourceLangCode,
            targetLang: data.targetLangCode,
            intent: data.intent,
            timestamp: new Date().toISOString(),
            detectedTasks: data.detectedTasks
          };
          if (data.remainingSessions !== undefined && userPlan) {
            setUserPlan({ ...userPlan, remainingSessions: data.remainingSessions });
          }
        }
      } catch (err) {
        console.error('Audio blob translation error:', err);
      }
    }

    setIsProcessing(false);
    if (turn) {
      setCurrentTurn(turn);
      setConversationTurns(prev => [...prev, turn!]);
      fetchTasks();
      if (userProfile?.autoSpeakTranslation) {
        LiveAudioEngine.speakText(turn.translatedText, turn.targetLang);
      }
    }

    return turn;
  };

  const translateText = async (
    text: string,
    speaker: 'user' | 'partner' | 'speaker_a' | 'speaker_b' = 'user',
    isLiveUpdate: boolean = false,
    requestSeq?: number
  ): Promise<TranslationTurn | null> => {
    if (!text || !text.trim()) return null;
    const cleanInput = text.trim();

    const isSpeakerB = speaker === 'speaker_b' || speaker === 'partner';
    const src = isSpeakerB ? targetLang : sourceLang;
    const tgt = isSpeakerB ? sourceLang : targetLang;

    const recentContext = conversationTurns
      .slice(-3)
      .map(t => `${t.originalText} -> ${t.translatedText}`)
      .join('\n');

    const cacheKey = `${src}->${tgt}:${cleanInput.toLowerCase()}`;

    // 1. Instant Cache Hit Check
    if (translationCacheRef.current.has(cacheKey)) {
      const cachedTurn = translationCacheRef.current.get(cacheKey)!;
      const turn: TranslationTurn = {
        ...cachedTurn,
        id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        speaker,
        timestamp: new Date().toISOString()
      };
      if (requestSeq === undefined || requestSeq === requestSeqRef.current) {
        setLiveTranslation(turn.translatedText);
      }
      if (!isLiveUpdate) {
        setCurrentTurn(turn);
        setIsProcessing(false);
        if (userProfile?.autoSpeakTranslation) {
          LiveAudioEngine.speakText(turn.translatedText, turn.targetLang);
        }
      }
      return turn;
    }

    if (!isLiveUpdate) {
      setIsProcessing(true);
    }

    const offlineRes = await translateOffline(cleanInput, src, tgt);
    const instantLocalResult = offlineRes.translation || instantLocalTranslate(cleanInput, src, tgt) || cleanInput;
    const fallbackTurn: TranslationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      speaker,
      originalText: cleanInput,
      translatedText: instantLocalResult,
      sourceLang: src,
      targetLang: tgt,
      intent: offlineRes.isOfflineMatch ? `Offline (${offlineRes.source})` : 'Live Speech Translation',
      timestamp: new Date().toISOString(),
      detectedTasks: []
    };

    // If device is offline, return offline translation immediately without waiting for fetch network timeout
    if (isOffline) {
      if (requestSeq === undefined || requestSeq === requestSeqRef.current) {
        setLiveTranslation(fallbackTurn.translatedText);
      }
      if (!isLiveUpdate) {
        setCurrentTurn(fallbackTurn);
        setIsProcessing(false);
        if (userProfile?.autoSpeakTranslation) {
          LiveAudioEngine.speakText(fallbackTurn.translatedText, fallbackTurn.targetLang);
        }
      }
      return fallbackTurn;
    }

    try {
      const res = await authFetch('/api/translate/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanInput,
          sourceLang: src,
          targetLang: tgt,
          deviceId,
          context: recentContext
        })
      });

      if (res.status === 429) {
        apiCooldownUntilRef.current = Date.now() + 15000;
      }

      if (res.ok) {
        apiCooldownUntilRef.current = 0;
        const data = await res.json();
        const turn: TranslationTurn = {
          id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          speaker,
          originalText: data.originalText || cleanInput,
          translatedText: data.translatedText || instantLocalResult,
          sourceLang: data.sourceLangCode || src,
          targetLang: data.targetLangCode || tgt,
          intent: data.intent || 'Live Speech Translation',
          timestamp: new Date().toISOString(),
          detectedTasks: data.detectedTasks || []
        };

        translationCacheRef.current.set(cacheKey, turn);
        // Save to IndexedDB offline storage
        cacheTranslationOffline(cleanInput, src, tgt, turn.translatedText);

        if (requestSeq === undefined || requestSeq === requestSeqRef.current) {
          setLiveTranslation(data.translatedText);
        }

        if (data.remainingSessions !== undefined && userPlan) {
          setUserPlan({ ...userPlan, remainingSessions: data.remainingSessions });
        }

        fetchTasks();

        if (!isLiveUpdate) {
          setIsProcessing(false);
        }
        return turn;
      }
    } catch (err) {
      console.warn('Live API request warning:', err);
    }

    if (!isLiveUpdate) {
      setIsProcessing(false);
    }
    return fallbackTurn;
  };

  const playVoice = (text: string, langCode: string) => {
    LiveAudioEngine.speakText(text, langCode);
  };

  const saveSessionToHistory = async (customTitle?: string): Promise<ConversationSession> => {
    const srcLangObj = getLanguageByCode(sourceLang);
    const tgtLangObj = getLanguageByCode(targetLang);

    const title = customTitle || `${currentTurn?.intent || 'Speech Translation'} (${srcLangObj.name} → ${tgtLangObj.name})`;

    const sessionObj: ConversationSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      mode: conversationTurns.length > 1 ? 'conversation' : 'single',
      sourceLang,
      targetLang,
      turns: [...conversationTurns],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      durationSeconds: Math.max(120, conversationTurns.length * 25)
    };

    try {
      const res = await authFetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionObj)
      });
      if (res.ok) {
        const saved = await res.json();
        fetchHistory();
        return saved;
      }
    } catch (err) {
      console.error('Save session error:', err);
    }

    // Local state fallback
    setHistorySessions(prev => [sessionObj, ...prev]);
    return sessionObj;
  };

  const deleteHistorySession = async (id: string) => {
    try {
      await authFetch(`/api/history/${id}`, { method: 'DELETE' });
      fetchHistory();
    } catch (err) {
      console.error('Delete history session error:', err);
      setHistorySessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const clearHistory = async () => {
    try {
      await authFetch('/api/history', { method: 'DELETE' });
      setHistorySessions([]);
    } catch (err) {
      console.error('Clear history error:', err);
    }
  };

  const buySessionPack = async () => {
    try {
      const res = await authFetch('/api/billing/buy-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packName: '$5 Session Pack (20 Sessions)',
          price: 5.00,
          sessionsCount: 20
        })
      });
      if (res.ok) {
        const data = await res.json();
        setUserPlan(data.plan);
      }
    } catch (err) {
      console.error('Buy session pack error:', err);
    }
  };

  const refreshCredits = async (count: number = 100) => {
    try {
      const res = await authFetch('/api/billing/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
      if (res.ok) {
        const data = await res.json();
        setUserPlan(data.plan);
      }
    } catch (err) {
      console.error('Refresh credits error:', err);
    }
  };

  const revokeDevice = async (deviceIdToRevoke: string) => {
    try {
      const res = await authFetch('/api/devices/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIdToRevoke })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDevices(data.activeDevices || []);
      }
    } catch (err) {
      console.error('Revoke device error:', err);
    }
  };

  const toggleTaskDone = async (taskId: string) => {
    const target = tasks.find(t => t.id === taskId);
    const newStatus = target?.status === 'DONE' ? 'PENDING' : 'DONE';

    try {
      const res = await authFetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTasks();
        fetchMorningAlerts();
      }
    } catch (err) {
      console.error('Toggle task error:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await authFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
      fetchMorningAlerts();
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  const addTaskManually = async (task: Partial<AITask>): Promise<AITask> => {
    const res = await authFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    const saved = await res.json();
    fetchTasks();
    return saved;
  };

  const ackMorningAlert = async (taskId: string) => {
    try {
      await authFetch(`/api/tasks/${taskId}/morning-alert-ack`, { method: 'POST' });
      fetchMorningAlerts();
    } catch (err) {
      console.error('Ack morning alert error:', err);
    }
  };

  const translateSongLyricsFromAudio = async (audioBlob: Blob): Promise<SongLyricsResult> => {
    setIsTranslatingSong(true);
    if (isOffline) {
      const fallback = generateLocalSongLyricsFallback('Live Recorded Music Audio', targetLang);
      setCurrentSongLyrics(fallback);
      setIsTranslatingSong(false);
      return fallback;
    }

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.includes(',') ? res.split(',')[1] : res);
        };
        reader.readAsDataURL(audioBlob);
      });

      const res = await authFetch('/api/translate/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: audioBlob.type || 'audio/webm',
          targetLangCode: targetLang
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.lineByLine && data.lineByLine.length > 0) {
          setCurrentSongLyrics(data);
          setIsTranslatingSong(false);
          return data;
        }
      }
    } catch (err) {
      console.error('Song audio translation error:', err);
    }

    const fallback = generateLocalSongLyricsFallback('Live Recorded Music Audio', targetLang);
    setCurrentSongLyrics(fallback);
    setIsTranslatingSong(false);
    return fallback;
  };

  const translateSongLyricsFromText = async (text: string): Promise<SongLyricsResult> => {
    setIsTranslatingSong(true);
    if (isOffline) {
      const fallback = generateLocalSongLyricsFallback(text, targetLang);
      setCurrentSongLyrics(fallback);
      setIsTranslatingSong(false);
      return fallback;
    }

    try {
      const res = await authFetch('/api/translate/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyricsOrText: text,
          targetLangCode: targetLang
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.lineByLine && data.lineByLine.length > 0) {
          setCurrentSongLyrics(data);
          setIsTranslatingSong(false);
          return data;
        }
      }
    } catch (err) {
      console.error('Song text translation error:', err);
    }

    const fallback = generateLocalSongLyricsFallback(text, targetLang);
    setCurrentSongLyrics(fallback);
    setIsTranslatingSong(false);
    return fallback;
  };

  const resetCurrentLiveSession = () => {
    setCurrentTurn(null);
    setLiveTranscript('');
    setLiveTranslation('');
    setConversationTurns([]);
  };

  return (
    <XLateContext.Provider
      value={{
        activeTab,
        setActiveTab,
        sourceLang,
        setSourceLang,
        targetLang,
        setTargetLang,
        swapLanguages,
        isOffline,
        offlinePacks,
        refreshOfflinePacks,
        isListening,
        isProcessing,
        isLiveTranslating,
        audioVolume,
        liveTranscript,
        liveTranslation,
        currentTurn,
        conversationTurns,
        audioDevices,
        selectedAudioDeviceId,
        setSelectedAudioDeviceId,
        lowSoundBoostLevel,
        setLowSoundBoostLevel,
        refreshAudioDevices,
        deviceId,
        activeDevices,
        userProfile,
        userPlan,
        deviceRevokedMessage,
        historySessions,
        tasks,
        morningAlerts,
        startListening,
        stopListeningAndTranslate,
        translateText,
        playVoice,
        saveSessionToHistory,
        deleteHistorySession,
        clearHistory,
        buySessionPack,
        refreshCredits,
        revokeDevice,
        toggleTaskDone,
        deleteTask,
        addTaskManually,
        currentSongLyrics,
        isTranslatingSong,
        translateSongLyricsFromAudio,
        translateSongLyricsFromText,
        ackMorningAlert,
        resetCurrentLiveSession
      }}
    >
      {children}
    </XLateContext.Provider>
  );
};

export const useXLate = () => {
  const ctx = useContext(XLateContext);
  if (!ctx) throw new Error('useXLate must be used within XLateProvider');
  return ctx;
};
