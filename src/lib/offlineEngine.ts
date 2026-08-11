import { openDB, IDBPDatabase } from 'idb';
import { instantLocalTranslate } from './instantTranslator';

const DB_NAME = 'xlate-offline-db';
const DB_VERSION = 1;

interface OfflineDictionaryPack {
  langCode: string;
  name: string;
  wordCount: number;
  sizeMb: string;
  installed: boolean;
  dictionary: Record<string, string>;
}

// Global default offline packs available for instant installation
const PRELOADED_OFFLINE_PACKS: Record<string, Record<string, string>> = {
  'hi': {
    'namaste': 'hello', 'dhanyawad': 'thank you', 'alvida': 'goodbye', 'haan': 'yes', 'nahi': 'no',
    'kaise ho': 'how are you', 'kya': 'what', 'kahan': 'where', 'kab': 'when', 'kyun': 'why',
    'paani': 'water', 'khaana': 'food', 'madad': 'help', 'theek hai': 'okay', 'aaj': 'today', 'kal': 'tomorrow',
    'नमस्ते': 'hello', 'धन्यवाद': 'thank you', 'अलविदा': 'goodbye', 'हाँ': 'yes', 'नहीं': 'no',
    'आप कैसे हैं': 'how are you', 'पानी': 'water', 'खाना': 'food', 'मदद': 'help', 'शुभ प्रभात': 'good morning'
  },
  'es': {
    'hola': 'hello', 'gracias': 'thank you', 'adios': 'goodbye', 'adiós': 'goodbye', 'si': 'yes', 'sí': 'yes', 'no': 'no',
    'como estas': 'how are you', 'cómo estás': 'how are you', 'por favor': 'please', 'de nada': 'you are welcome',
    'buenos dias': 'good morning', 'buenas noches': 'good night', 'agua': 'water', 'comida': 'food', 'ayuda': 'help'
  },
  'fr': {
    'bonjour': 'hello', 'merci': 'thank you', 'au revoir': 'goodbye', 'oui': 'yes', 'non': 'no',
    's\'il vous plaît': 'please', 'comment allez-vous': 'how are you', 'ça va': 'how are you', 'eau': 'water', 'aide': 'help'
  },
  'de': {
    'hallo': 'hello', 'danke': 'thank you', 'tschüss': 'goodbye', 'ja': 'yes', 'nein': 'no',
    'bitte': 'please', 'wie geht es dir': 'how are you', 'wasser': 'water', 'hilfe': 'help'
  },
  'ja': {
    'こんにちは': 'hello', 'ありがとう': 'thank you', 'さようなら': 'goodbye', 'はい': 'yes', 'いいえ': 'no',
    'おねがいします': 'please', 'みず': 'water', 'たすけて': 'help', 'konnichiwa': 'hello', 'arigatou': 'thank you'
  },
  'zh': {
    '你好': 'hello', '谢谢': 'thank you', '再见': 'goodbye', '是': 'yes', '不': 'no',
    '请': 'please', '水': 'water', '帮助': 'help', 'nihao': 'hello', 'xiexie': 'thank you'
  }
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('language-packs')) {
          db.createObjectStore('language-packs', { keyPath: 'langCode' });
        }
        if (!db.objectStoreNames.contains('translation-cache')) {
          db.createObjectStore('translation-cache', { keyPath: 'cacheKey' });
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Initialize offline database & store default packs
 */
export async function initOfflineEngine(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('language-packs', 'readonly');
    const store = tx.objectStore('language-packs');
    const existingCount = await store.count();

    if (existingCount === 0) {
      const writeTx = db.transaction('language-packs', 'readwrite');
      const writeStore = writeTx.objectStore('language-packs');

      for (const [code, dict] of Object.entries(PRELOADED_OFFLINE_PACKS)) {
        await writeStore.put({
          langCode: code,
          name: `${code.toUpperCase()} Language Pack`,
          wordCount: Object.keys(dict).length,
          sizeMb: '1.2 MB',
          installed: true,
          dictionary: dict
        });
      }
      await writeTx.done;
    }
  } catch (err) {
    console.warn('Offline engine init notice:', err);
  }
}

/**
 * Cache an AI server translation for offline instant replay
 */
export async function cacheTranslationOffline(
  text: string,
  sourceLang: string,
  targetLang: string,
  translation: string
): Promise<void> {
  try {
    const db = await getDB();
    const cacheKey = `${sourceLang}:${targetLang}:${text.trim().toLowerCase()}`;
    await db.put('translation-cache', {
      cacheKey,
      text,
      sourceLang,
      targetLang,
      translation,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('Failed to cache translation offline:', err);
  }
}

/**
 * Perform hybrid offline translation using IndexedDB cache & offline dictionaries
 */
export async function translateOffline(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<{ translation: string; isOfflineMatch: boolean; source: 'cache' | 'dictionary' | 'instant' }> {
  if (!text || !text.trim()) {
    return { translation: '', isOfflineMatch: false, source: 'dictionary' };
  }

  const cleanText = text.trim().toLowerCase();
  const cacheKey = `${sourceLang}:${targetLang}:${cleanText}`;

  // 1. Check IndexedDB cached translations first
  try {
    const db = await getDB();
    const cached = await db.get('translation-cache', cacheKey);
    if (cached && cached.translation) {
      return { translation: cached.translation, isOfflineMatch: true, source: 'cache' };
    }
  } catch (err) {
    console.warn('Offline cache lookup error:', err);
  }

  // 2. Check IndexedDB language pack dictionaries
  try {
    const db = await getDB();
    const tgtCode = targetLang.split('-')[0];
    const pack = await db.get('language-packs', tgtCode);
    if (pack && pack.dictionary && pack.dictionary[cleanText]) {
      return { translation: pack.dictionary[cleanText], isOfflineMatch: true, source: 'dictionary' };
    }
  } catch (err) {
    console.warn('Offline dictionary lookup error:', err);
  }

  // 3. Fallback to instant local translator engine
  const instantResult = instantLocalTranslate(text, sourceLang, targetLang);
  return {
    translation: instantResult || text,
    isOfflineMatch: instantResult !== text,
    source: 'instant'
  };
}

/**
 * List all available & installed offline language packs
 */
export async function getOfflineLanguagePacks(): Promise<OfflineDictionaryPack[]> {
  try {
    const db = await getDB();
    return await db.getAll('language-packs');
  } catch (err) {
    console.warn('Failed to fetch offline language packs:', err);
    return [];
  }
}

/**
 * Install or update an offline language pack
 */
export async function installOfflinePack(langCode: string, name: string, dict: Record<string, string>): Promise<boolean> {
  try {
    const db = await getDB();
    await db.put('language-packs', {
      langCode,
      name,
      wordCount: Object.keys(dict).length,
      sizeMb: `${(Object.keys(dict).length * 0.05).toFixed(1)} MB`,
      installed: true,
      dictionary: dict
    });
    return true;
  } catch (err) {
    console.error('Failed to install offline language pack:', err);
    return false;
  }
}
