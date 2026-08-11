export type ActiveTab = 'home' | 'conversation' | 'history' | 'tasks' | 'settings' | 'lyrics';

export interface LyricLine {
  originalLine: string;
  translatedLine: string;
  phoneticLine?: string;
}

export interface SongLyricsResult {
  songTitle: string;
  artist: string;
  genre: string;
  sungLanguage: string;
  targetLanguage: string;
  theme: string;
  lineByLine: LyricLine[];
  fullOriginalText: string;
  fullTranslatedText: string;
}

export interface Language {
  code: string;       // e.g. 'hi-IN', 'en-US', 'es-ES'
  name: string;       // e.g. 'Hindi', 'English (US)'
  nativeName: string; // e.g. 'हिंदी', 'English'
  flag: string;       // Emoji flag e.g. '🇮🇳', '🇺🇸'
  isIndian?: boolean; // Highlighted high priority Indian language
  ttsVoiceCode?: string;
}

export interface TranslationTurn {
  id: string;
  speaker: 'user' | 'partner' | 'speaker_a' | 'speaker_b';
  originalText: string;
  translatedText: string;
  sourceLang: string; // language code
  targetLang: string; // language code
  intent: string;     // ultra-short 3-8 word AI summary
  timestamp: string;  // ISO string
  audioDataUrl?: string;
  detectedTasks?: AITaskCandidate[];
}

export interface AITaskCandidate {
  title: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority?: 'IMPORTANT' | 'NORMAL';
  extractedSentence?: string;
}

export interface ConversationSession {
  id: string;
  title: string;
  mode: 'single' | 'conversation';
  sourceLang: string;
  targetLang: string;
  turns: TranslationTurn[];
  createdAt: string;
  updatedAt: string;
  durationSeconds: number;
}

export interface AITask {
  id: string;
  conversationId?: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: 'IMPORTANT' | 'NORMAL';
  status: 'PENDING' | 'DONE';
  extractedFromText?: string;
  reminderIntervals: ('3_DAYS_BEFORE' | '1_DAY_BEFORE' | 'SAME_DAY')[];
  morningAlertShown?: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface DeviceSession {
  deviceId: string;
  deviceName: string;
  os: string;
  browser: string;
  ip: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
  revoked: boolean;
}

export interface UserPlan {
  userId: string;
  planType: 'FREE' | 'PAID_PACK' | 'UNLIMITED';
  totalSessionsAllowed: number;
  usedSessions: number;
  remainingSessions: number;
  maxMinutesPerSession: number;
  purchaseHistory: {
    id: string;
    date: string;
    packName: string;
    amount: number;
    sessionsAdded: number;
  }[];
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  preferredSourceLang: string;
  preferredTargetLang: string;
  encryptionEnabled: boolean;
  autoSpeakTranslation: boolean;
  autoExtractTasks: boolean;
  morningAlertsEnabled: boolean;
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  sourceLangName: string;
  targetLang: string;
  targetLangName: string;
  intent: string;
  detectedTasks: AITaskCandidate[];
  remainingSessions: number;
}
