// Audio Engine: Web Speech Recognition, MediaRecorder & Text-To-Speech Synthesis

export interface AudioEngineCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onTranscriptPartial?: (text: string) => void;
  onTranscriptFinal?: (text: string, confidence: number) => void;
  onAudioSlice?: (audioBlob: Blob) => void;
  onError?: (error: string) => void;
  onVolumeChange?: (volume: number) => void;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface AudioEngineOptions {
  deviceId?: string;
  gainBoostLevel?: number; // 1.0 (Normal), 3.5 (Enhanced), 6.0 (High Soft Sound), 10.0 (Ultra Low Sound / Soft Music)
  lowSoundEnhancement?: boolean;
  continuous?: boolean;
  interimResults?: boolean;
}

export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  } catch (err) {
    console.warn('Failed to enumerate audio devices:', err);
    return [];
  }
}

const BCP47_LOCALES: Record<string, string> = {
  'hi': 'hi-IN',
  'hi-in': 'hi-IN',
  'bn': 'bn-IN',
  'bn-in': 'bn-IN',
  'ta': 'ta-IN',
  'ta-in': 'ta-IN',
  'te': 'te-IN',
  'te-in': 'te-IN',
  'mr': 'mr-IN',
  'mr-in': 'mr-IN',
  'gu': 'gu-IN',
  'gu-in': 'gu-IN',
  'kn': 'kn-IN',
  'kn-in': 'kn-IN',
  'ml': 'ml-IN',
  'ml-in': 'ml-IN',
  'pa': 'pa-IN',
  'pa-in': 'pa-IN',
  'ur': 'ur-IN',
  'ur-in': 'ur-IN',
  'or': 'or-IN',
  'or-in': 'or-IN',
  'as': 'as-IN',
  'as-in': 'as-IN',
  'ne': 'ne-NP',
  'ne-np': 'ne-NP',
  'sa': 'sa-IN',
  'sa-in': 'sa-IN',
  'ks': 'ks-IN',
  'ks-in': 'ks-IN',
  'sd': 'sd-IN',
  'sd-in': 'sd-IN',
  'en': 'en-IN',
  'en-us': 'en-US',
  'en-gb': 'en-GB'
};

function resolveSpeechLocale(langCode: string): string {
  if (!langCode || langCode === 'auto') {
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('hi') || navLang.includes('in')) return 'hi-IN';
    return 'hi-IN'; // hi-IN in Chrome/Safari handles Hindi, Hinglish, and bilingual Indian English
  }
  const clean = langCode.toLowerCase().trim();
  if (BCP47_LOCALES[clean]) return BCP47_LOCALES[clean];
  if (clean.length === 2) {
    if (clean === 'hi') return 'hi-IN';
    return `${clean}-${clean.toUpperCase()}`;
  }
  return langCode;
}

export class LiveAudioEngine {
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isListening: boolean = false;
  private audioChunks: Blob[] = [];
  private volumeInterval: any = null;
  private speechRecSupported: boolean = false;
  private speechRecFailed: boolean = false;
  private restartTimeout: any = null;
  private lastSpeechRecTimestamp: number = 0;

  public isSpeechRecognitionSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  public async startListening(langCode: string, callbacks: AudioEngineCallbacks, options?: AudioEngineOptions) {
    this.isListening = true;
    this.speechRecFailed = false;
    callbacks.onSpeechStart?.();

    const selectedDeviceId = options?.deviceId;
    const gainBoostLevel = options?.gainBoostLevel ?? 4.0; // Default 4.0x, up to 10.0x for low sound & soft music

    // 1. Earphone-aware & High-sensitivity microphone stream tailored for low sound, soft voice & live music
    try {
      const audioConstraints: MediaTrackConstraints = {
        deviceId: (selectedDeviceId && selectedDeviceId !== 'default') ? { ideal: selectedDeviceId } : undefined,
        echoCancellation: false,       // Do NOT suppress background music or soft speaker audio!
        autoGainControl: true,         // Maximum hardware AGC for low dB speech / earphone mic
        noiseSuppression: false,       // Do NOT suppress quiet speech formants or music vocals
        channelCount: 1,
        sampleRate: 48000,
        // Chromium & Android vendor far-field mic flags
        googAutoGainControl: true,
        googEchoCancellation: false,
        googNoiseSuppression: false,
        googHighpassFilter: false
      } as any;

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Stage 1: Highpass Filter (cuts rumbles below 65Hz while preserving soft voices & bass notes)
      const highpass = this.audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 65;

      // Stage 2: Peaking Vocal/Music EQ Node (boosts 2.2 kHz human vocal & singing presence)
      const vocalEq = this.audioContext.createBiquadFilter();
      vocalEq.type = 'peaking';
      vocalEq.frequency.value = 2200;
      vocalEq.Q.value = 1.2;
      vocalEq.gain.value = gainBoostLevel > 5 ? 8 : 5; // +5dB to +8dB boost for low sound/music

      // Stage 3: Multi-factor Pre-amp Gain node for low sound / whispering / faint music lyrics
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = gainBoostLevel;

      // Stage 4: Dynamics Compressor Node - boosts quiet sound (-62dB threshold) without clipping close voice
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = gainBoostLevel > 5 ? -62 : -52;
      compressor.knee.value = 14;
      compressor.ratio.value = 18;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.15;

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;

      // Connect DSP chain to destination stream for MediaRecorder
      const destination = this.audioContext.createMediaStreamDestination();

      source.connect(highpass);
      highpass.connect(vocalEq);
      vocalEq.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(this.analyser);
      compressor.connect(destination);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let lastVolumeDetectedTime = Date.now();
      let currentVolumeNormalized = 0;

      this.volumeInterval = setInterval(() => {
        if (!this.analyser || !this.isListening) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // High-sensitivity logarithmic scale for responsive UI feedback even with whispered/distant speech
        currentVolumeNormalized = Math.min(1, Math.pow(avg / 20, 0.7));
        if (currentVolumeNormalized > 0.02) {
          lastVolumeDetectedTime = Date.now();
        }
        callbacks.onVolumeChange?.(currentVolumeNormalized);
      }, 80);

      // Media recorder for streaming audio slices and backup blob using amplified stream
      this.audioChunks = [];
      let currentSliceChunks: Blob[] = [];
      let headerChunk: Blob | null = null;
      this.lastSpeechRecTimestamp = Date.now();

      let mimeType = '';
      const possibleTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      for (const t of possibleTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          if (!headerChunk) {
            headerChunk = e.data;
          }
          this.audioChunks.push(e.data);
          currentSliceChunks.push(e.data);

          // Trigger fallback audio slice processing if Web Speech API hasn't produced final results recently,
          // or if speech recognition failed, ensuring distant phone speaker voices are sent to Gemini
          const timeSinceLastRec = Date.now() - this.lastSpeechRecTimestamp;
          const speechActive = (Date.now() - lastVolumeDetectedTime) < 1500;

          if (this.speechRecFailed || !this.speechRecSupported || (speechActive && timeSinceLastRec > 2200)) {
            if (currentSliceChunks.length >= 3) {
              const chunksToInclude = (headerChunk && currentSliceChunks[0] !== headerChunk)
                ? [headerChunk, ...currentSliceChunks]
                : currentSliceChunks;
              const sliceBlob = new Blob(chunksToInclude, { type: e.data.type || 'audio/webm' });
              currentSliceChunks = [];
              if (sliceBlob.size > 1200) {
                callbacks.onAudioSlice?.(sliceBlob);
              }
            }
          }
        }
      };
      this.mediaRecorder.start(800); // 800ms timeslices
    } catch (err: any) {
      console.warn('Microphone stream initialization warning:', err);
      callbacks.onError?.('Microphone access error: ' + (err.message || 'Permission denied'));
    }

    // 2. Web Speech API Recognition
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      this.speechRecSupported = true;
      try {
        this.recognition = new SpeechRec();
        this.recognition.continuous = callbacks.continuous !== false;
        this.recognition.interimResults = callbacks.interimResults !== false;
        
        // Sanitize locale tag
        this.recognition.lang = resolveSpeechLocale(langCode);

        let lastHandledFinalIndex = -1;

        this.recognition.onresult = (event: any) => {
          this.lastSpeechRecTimestamp = Date.now();
          let interimTranscript = '';
          let newlyFinalizedText = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              if (i > lastHandledFinalIndex) {
                newlyFinalizedText += transcript + ' ';
                lastHandledFinalIndex = i;
              }
            } else {
              interimTranscript += transcript;
            }
          }

          if (interimTranscript.trim()) {
            callbacks.onTranscriptPartial?.(interimTranscript.trim());
          }

          if (newlyFinalizedText.trim()) {
            callbacks.onTranscriptFinal?.(newlyFinalizedText.trim(), 0.98);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Speech recognition error event:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            this.speechRecFailed = true;
          }
        };

        this.recognition.onend = () => {
          // If still in listening mode, auto restart speech recognition continuously!
          if (this.isListening && !this.speechRecFailed) {
            this.restartTimeout = setTimeout(() => {
              if (this.isListening && this.recognition) {
                try {
                  this.recognition.start();
                } catch (e) {
                  // Ignore if already active
                }
              }
            }, 100);
          } else {
            callbacks.onSpeechEnd?.();
          }
        };

        this.recognition.start();
      } catch (err) {
        console.warn('Failed to start Web Speech Recognition:', err);
        this.speechRecFailed = true;
      }
    } else {
      console.warn('SpeechRecognition API not natively available; using direct streaming audio fallback.');
      this.speechRecSupported = false;
      this.speechRecFailed = true;
    }
  }

  public stopListening(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.isListening = false;
      if (this.volumeInterval) clearInterval(this.volumeInterval);
      if (this.restartTimeout) clearTimeout(this.restartTimeout);

      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch {}
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.cleanupStream();
          resolve(blob);
        };
        this.mediaRecorder.stop();
      } else {
        this.cleanupStream();
        resolve(null);
      }
    });
  }

  private cleanupStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  // Voice Playback using SpeechSynthesis API
  public static speakText(text: string, langCode: string = 'en-US', onEnd?: () => void) {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode === 'auto' ? 'en-US' : langCode;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to pick matching voice
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(utterance.lang.toLowerCase()));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    if (onEnd) utterance.onend = onEnd;

    window.speechSynthesis.speak(utterance);
  }
}

export const liveAudioEngine = new LiveAudioEngine();

