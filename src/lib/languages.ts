import { Language } from '../types';

export const INDIAN_LANGUAGES: Language[] = [
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳', isIndian: true },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', isIndian: true },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', isIndian: true },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', isIndian: true },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', isIndian: true },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', isIndian: true },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', isIndian: true },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', isIndian: true },
  { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', isIndian: true },
  { code: 'ur-IN', name: 'Urdu', nativeName: 'اردو', flag: '🇮🇳', isIndian: true },
  { code: 'or-IN', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳', isIndian: true },
  { code: 'as-IN', name: 'Assamese', nativeName: 'অসমীয়া', flag: '🇮🇳', isIndian: true },
  { code: 'mai-IN', name: 'Maithili', nativeName: 'मैथिली', flag: '🇮🇳', isIndian: true },
  { code: 'sat-IN', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', flag: '🇮🇳', isIndian: true },
  { code: 'sa-IN', name: 'Sanskrit', nativeName: 'संस्कृतम्', flag: '🇮🇳', isIndian: true },
  { code: 'ks-IN', name: 'Kashmiri', nativeName: 'कॉशुर', flag: '🇮🇳', isIndian: true },
  { code: 'ne-NP', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵', isIndian: true },
  { code: 'kok-IN', name: 'Konkani', nativeName: 'कोंकणी', flag: '🇮🇳', isIndian: true },
  { code: 'sd-IN', name: 'Sindhi', nativeName: 'سنڌي', flag: '🇮🇳', isIndian: true },
  { code: 'doi-IN', name: 'Dogri', nativeName: 'डोगरी', flag: '🇮🇳', isIndian: true },
  { code: 'mni-IN', name: 'Manipuri (Meitei)', nativeName: 'ꯃꯩꯇꯩꯂꯣꯟ', flag: '🇮🇳', isIndian: true },
  { code: 'brx-IN', name: 'Bodo', nativeName: 'बर\'', flag: '🇮🇳', isIndian: true },
];

export const GLOBAL_LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: '⚡ Auto Detect', flag: '🌐' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh-CN', name: 'Mandarin (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'pl-PL', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'th-TH', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'sw-KE', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
  ...INDIAN_LANGUAGES,
];

export function getLanguageByCode(code: string): Language {
  const found = GLOBAL_LANGUAGES.find(l => l.code.toLowerCase() === code.toLowerCase() || l.code.split('-')[0] === code.split('-')[0]);
  if (found) return found;
  return {
    code,
    name: code.toUpperCase(),
    nativeName: code.toUpperCase(),
    flag: '🌐'
  };
}

export function searchLanguages(query: string): Language[] {
  if (!query.trim()) return GLOBAL_LANGUAGES;
  const q = query.toLowerCase().trim();
  return GLOBAL_LANGUAGES.filter(
    l =>
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
  );
}
