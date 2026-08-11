import React, { useState, useRef, useEffect } from 'react';
import { useXLate } from '../../context/XLateContext';
import { getLanguageByCode, GLOBAL_LANGUAGES } from '../../lib/languages';
import { AudioSourceSelector } from '../common/AudioSourceSelector';
import {
  Music,
  Mic,
  Volume2,
  Copy,
  Sparkles,
  Radio,
  Play,
  Check,
  Search,
  RefreshCw,
  Globe,
  Save,
  ChevronDown,
  Disc,
  Headphones,
  Zap
} from 'lucide-react';

interface SampleSong {
  id: string;
  title: string;
  artist: string;
  sungLanguageCode: string;
  sungLanguageName: string;
  flag: string;
  sampleLyrics: string;
  previewColor: string;
}

const SAMPLE_SONGS: SampleSong[] = [
  {
    id: 'kesariya',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    sungLanguageCode: 'hi-IN',
    sungLanguageName: 'Hindi',
    flag: '🇮🇳',
    previewColor: 'from-amber-600 to-orange-500',
    sampleLyrics: `Mujhko kitna pyar hai tumse
Kaise tumko main bataun
Kesariya tera ishq hai piya
Rang jaun jo main hath lagaun`
  },
  {
    id: 'despacito',
    title: 'Despacito',
    artist: 'Luis Fonsi ft. Daddy Yankee',
    sungLanguageCode: 'es-ES',
    sungLanguageName: 'Spanish',
    flag: '🇪🇸',
    previewColor: 'from-rose-600 to-amber-500',
    sampleLyrics: `Pasito a pasito, suave suavecito
Nos vamos pegando, poquito a poquito
Cuando me besas con esa destreza
Veo que eres delicadeza`
  },
  {
    id: 'lavie',
    title: 'La Vie En Rose',
    artist: 'Édith Piaf',
    sungLanguageCode: 'fr-FR',
    sungLanguageName: 'French',
    flag: '🇫🇷',
    previewColor: 'from-pink-600 to-purple-600',
    sampleLyrics: `Quand il me prend dans ses bras
Il me parle tout bas
Je vois la vie en rose
Il me dit des mots d'amour`
  },
  {
    id: 'sukiyaki',
    title: 'Ue o Muke Arukou (Sukiyaki)',
    artist: 'Kyu Sakamoto',
    sungLanguageCode: 'ja-JP',
    sungLanguageName: 'Japanese',
    flag: '🇯🇵',
    previewColor: 'from-red-500 to-rose-700',
    sampleLyrics: `Ue o mukite arukou
Namida ga koborenai you ni
Omoidasu haru no hi
Hitori bocchi no yoru`
  },
  {
    id: 'shapeofyou',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    sungLanguageCode: 'en-US',
    sungLanguageName: 'English',
    flag: '🇺🇸',
    previewColor: 'from-cyan-600 to-blue-600',
    sampleLyrics: `The club isn't the best place to find a lover
So the bar is where I go
Me and my friends at the table doing shots
Drinking fast and then we talk slow`
  }
];

export const LyricsTranslatorView: React.FC = () => {
  const {
    targetLang,
    setTargetLang,
    playVoice,
    currentSongLyrics,
    isTranslatingSong,
    translateSongLyricsFromAudio,
    translateSongLyricsFromText,
    saveSessionToHistory,
    selectedAudioDeviceId,
    lowSoundBoostLevel
  } = useXLate();

  const [isMicListening, setIsMicListening] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [showControlsDrawer, setShowControlsDrawer] = useState(false);

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const targetLangObj = getLanguageByCode(targetLang);

  // Auto-scroll lyrics container when active line changes
  useEffect(() => {
    if (activeLineIndex !== null && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  // Handle live song mic listening with earphone support & low sound gain booster
  const startLiveSongCapture = async () => {
    try {
      const audioConstraints: MediaTrackConstraints = {
        deviceId: (selectedAudioDeviceId && selectedAudioDeviceId !== 'default') ? { ideal: selectedAudioDeviceId } : undefined,
        echoCancellation: false,
        autoGainControl: true,
        noiseSuppression: false,
        channelCount: 1,
        sampleRate: 48000
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      activeStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      const vocalEq = audioCtx.createBiquadFilter();
      vocalEq.type = 'peaking';
      vocalEq.frequency.value = 2200;
      vocalEq.gain.value = lowSoundBoostLevel > 5 ? 8 : 5;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = lowSoundBoostLevel;

      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = lowSoundBoostLevel > 5 ? -62 : -52;
      compressor.knee.value = 14;
      compressor.ratio.value = 18;

      const destination = audioCtx.createMediaStreamDestination();

      source.connect(vocalEq);
      vocalEq.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(destination);

      audioChunksRef.current = [];
      let selectedMimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        const candidateTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/aac',
          'audio/ogg;codecs=opus'
        ];
        const supported = candidateTypes.find(t => MediaRecorder.isTypeSupported(t));
        if (supported) selectedMimeType = supported;
      }

      const mediaRecorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(destination.stream, mediaRecorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }
        if (audioBlob.size > 100) {
          await translateSongLyricsFromAudio(audioBlob);
        } else {
          await translateSongLyricsFromText('Live Music Track');
        }
      };

      mediaRecorder.start(1000);
      setIsMicListening(true);
    } catch (err) {
      console.error('Error starting live song microphone:', err);
      alert('Microphone access is required to capture live background music.');
    }
  };

  const stopLiveSongCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsMicListening(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || isTranslatingSong) return;
    const term = searchInput.trim();
    setActiveSampleId(null);
    await translateSongLyricsFromText(term);
  };

  const handleSelectSample = async (sample: SampleSong) => {
    setActiveSampleId(sample.id);
    setSearchInput(`${sample.title} - ${sample.artist}`);
    await translateSongLyricsFromText(`${sample.title} by ${sample.artist}\n\nLyrics:\n${sample.sampleLyrics}`);
  };

  const handleCopyTranslatedLyrics = () => {
    if (!currentSongLyrics) return;
    navigator.clipboard.writeText(currentSongLyrics.fullTranslatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToHistory = async () => {
    if (!currentSongLyrics) return;
    await saveSessionToHistory(`Song: ${currentSongLyrics.songTitle} (${currentSongLyrics.artist})`);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReTranslateForNewTarget = async (newLangCode: string) => {
    setTargetLang(newLangCode);
    if (currentSongLyrics) {
      const srcText = currentSongLyrics.fullOriginalText || `${currentSongLyrics.songTitle} by ${currentSongLyrics.artist}`;
      await translateSongLyricsFromText(srcText);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-xl mx-auto px-3 py-2 space-y-3 relative overflow-hidden">

      {/* ==================================================================== */}
      {/* 1. PRIMARY STAGE: DEDICATED SCREEN FOR LYRICS ONLY (TOP ~70% HEIGHT) */}
      {/* ==================================================================== */}
      <div className="flex-1 bg-gradient-to-b from-slate-950 via-purple-950/40 to-slate-950 border-2 border-purple-500/30 rounded-3xl p-4 flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Ambient Background Glow Mesh */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Floating Top Header Bar Inside Lyrics Stage */}
        <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg animate-pulse">
              <Disc className={`w-4 h-4 ${isMicListening ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-xs font-black text-white tracking-wider uppercase flex items-center gap-1.5">
                <span>{currentSongLyrics ? currentSongLyrics.songTitle : 'Live Karaoke Stage'}</span>
              </h2>
              <p className="text-[11px] text-purple-300/80 font-medium truncate max-w-[180px]">
                {currentSongLyrics ? `Artist: ${currentSongLyrics.artist}` : 'AI Lyrics Translator'}
              </p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-1.5">
            {/* Target Language Dropdown Badge */}
            <div className="relative bg-slate-900/90 border border-purple-500/40 rounded-xl px-2 py-1 flex items-center gap-1">
              <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
              <select
                value={targetLang}
                onChange={(e) => handleReTranslateForNewTarget(e.target.value)}
                className="bg-transparent text-cyan-300 text-[11px] font-extrabold focus:outline-none cursor-pointer pr-4 appearance-none"
              >
                {GLOBAL_LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-cyan-400 absolute right-1 pointer-events-none" />
            </div>

            {currentSongLyrics && (
              <>
                <button
                  onClick={handleCopyTranslatedLyrics}
                  className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-purple-600 text-slate-300 hover:text-white transition-colors border border-slate-800"
                  title="Copy Full Translated Lyrics"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleSaveToHistory}
                  className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition-colors border border-slate-800"
                  title="Save to History"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Emotion / Poetic Theme Tagline */}
        {currentSongLyrics?.theme && (
          <div className="mt-2 bg-purple-950/40 border border-purple-500/20 rounded-xl px-3 py-1 flex items-center justify-between text-[11px] text-purple-200 z-10 shrink-0">
            <span className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
              <strong className="shrink-0">Meaning:</strong>
              <span className="italic truncate">{currentSongLyrics.theme}</span>
            </span>
            <span className="text-[10px] text-cyan-400 font-bold shrink-0 ml-2">
              Sung in {currentSongLyrics.sungLanguage}
            </span>
          </div>
        )}

        {savedSuccess && (
          <p className="text-[11px] text-emerald-400 font-bold text-center mt-1 z-10">
            ✓ Saved lyrics translation to encrypted history!
          </p>
        )}

        {/* DEDICATED LYRICS CONTAINER (MAIN SCREEN AREA) */}
        <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-purple-900/60 scrollbar-track-transparent z-10" ref={lyricsContainerRef}>
          {isTranslatingSong ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 text-center my-auto">
              <Disc className="w-12 h-12 text-purple-400 animate-spin" />
              <p className="text-sm font-bold text-white tracking-wide">
                Translating Song Lyrics into {targetLangObj.name}...
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                Synchronizing rhythm, poetic meaning, and phonetics...
              </p>
            </div>
          ) : currentSongLyrics ? (
            currentSongLyrics.lineByLine.map((line, idx) => {
              const isActive = activeLineIndex === idx;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveLineIndex(idx);
                    playVoice(line.translatedLine, targetLang);
                  }}
                  className={`group rounded-2xl p-3.5 space-y-1.5 transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-slate-900/90 border-cyan-400/80 shadow-lg shadow-cyan-500/20 scale-[1.01]'
                      : 'bg-slate-950/60 border-slate-800/60 hover:bg-slate-900/50 hover:border-purple-500/40'
                  }`}
                >
                  {/* Original Sung Line */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-purple-400 text-[10px]">🎵</span>
                      <span className="text-slate-300 italic">"{line.originalLine}"</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLineIndex(idx);
                        playVoice(line.translatedLine, targetLang);
                      }}
                      className="p-1 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                      title="Speak line"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Phonetic Pronunciation (Romanized Sing Along) */}
                  {line.phoneticLine && (
                    <p className="text-[11px] text-amber-300/90 italic font-mono pl-4">
                      🔤 {line.phoneticLine}
                    </p>
                  )}

                  {/* Translated Line in User's Desired Language (PROMINENT DISPLAY) */}
                  <p className={`text-base sm:text-lg font-black leading-snug pl-4 ${
                    isActive ? 'text-cyan-300' : 'text-white'
                  }`}>
                    "{line.translatedLine}"
                  </p>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 my-auto py-12">
              <div className="p-4 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-400 shadow-xl animate-pulse">
                <Music className="w-10 h-10" />
              </div>
              <p className="text-xs text-slate-400 max-w-xs">
                Tap the microphone below to listen to live playing music, or pick a sample track!
              </p>
            </div>
          )}
        </div>

        {/* Read All Audio Voice Floating Button at bottom of Lyrics Stage */}
        {currentSongLyrics && !isTranslatingSong && (
          <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between shrink-0 z-10">
            <span className="text-[11px] text-slate-400 font-medium">
              {currentSongLyrics.lineByLine.length} lines translated
            </span>
            <button
              onClick={() => playVoice(currentSongLyrics.fullTranslatedText, targetLang)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs shadow-md transition-all scale-95 hover:scale-100"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Read Full Lyrics</span>
            </button>
          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* 2. SECONDARY CONTROLS & FUNCTION DECK (POSITIONED CLEANLY BELOW)    */}
      {/* ==================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-3xl shadow-xl space-y-2.5 shrink-0">
        
        {/* Primary Row: Big Mic Button & Search Input */}
        <div className="flex items-center gap-2">
          {/* Live Mic Capture Button */}
          <button
            onClick={isMicListening ? stopLiveSongCapture : startLiveSongCapture}
            className={`relative p-3 rounded-2xl transition-all duration-300 shadow-lg flex items-center justify-center shrink-0 ${
              isMicListening
                ? 'bg-rose-600 hover:bg-rose-500 text-white scale-105 ring-2 ring-rose-400'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
            }`}
            title={isMicListening ? 'Stop Listening' : 'Listen to Live Music'}
          >
            {isMicListening ? (
              <Radio className="w-5 h-5 animate-spin text-white" />
            ) : (
              <Mic className="w-5 h-5 text-purple-100" />
            )}
          </button>

          {/* Search or Paste Song Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search song title or paste lyrics..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 pr-9 shadow-inner"
            />
            <button
              type="submit"
              disabled={!searchInput.trim() || isTranslatingSong}
              className="absolute right-1 p-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors"
            >
              {isTranslatingSong ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Toggle Audio Controls Drawer Button */}
          <button
            onClick={() => setShowControlsDrawer(!showControlsDrawer)}
            className={`p-2.5 rounded-2xl border text-xs font-bold transition-colors shrink-0 ${
              showControlsDrawer
                ? 'bg-purple-950 border-purple-500/50 text-purple-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Earphone & Low Sound Audio Settings"
          >
            <Headphones className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {/* Listening Indicator Notice */}
        {isMicListening && (
          <p className="text-[11px] text-purple-300 font-bold animate-pulse text-center flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            <span>Listening to Live Music near microphone... Tap mic to finalize translation!</span>
          </p>
        )}

        {/* Quick Sample Song Hits Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider shrink-0">
            Hits:
          </span>
          {SAMPLE_SONGS.map((song) => (
            <button
              key={song.id}
              onClick={() => handleSelectSample(song)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
                activeSampleId === song.id
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-purple-500/50'
              }`}
            >
              <span>{song.flag}</span>
              <span>{song.title}</span>
            </button>
          ))}
        </div>

        {/* Expandable Earphone & Low Sound Audio Booster Panel */}
        {showControlsDrawer && (
          <div className="pt-2 border-t border-slate-800/80">
            <AudioSourceSelector compact />
          </div>
        )}

      </div>

    </div>
  );
};
