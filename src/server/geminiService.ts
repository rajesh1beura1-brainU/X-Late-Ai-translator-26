import { GoogleGenAI, Type } from '@google/genai';
import { getLanguageByCode } from '../lib/languages.js';
import { instantLocalTranslate, generateLocalSongLyricsFallback } from '../lib/instantTranslator.js';
import { AITaskCandidate, SongLyricsResult } from '../types.js';

export interface GeminiTranslationResult {
  originalText: string;
  translatedText: string;
  sourceLangCode: string;
  sourceLangName: string;
  targetLangCode: string;
  targetLangName: string;
  intent: string;
  detectedTasks: AITaskCandidate[];
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is missing.');
      }
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return this.ai;
  }

  // Robust content generation helper with automatic model fallback and retry for 503/429/400
  private async generateWithFallback(params: {
    contents: any;
    config?: any;
  }): Promise<any> {
    const client = this.getClient();
    // Standard supported models in Gemini API SDK (@google/genai)
    const modelsToTry = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: params.contents,
            config: params.config
          });
          return response;
        } catch (err: any) {
          lastError = err;
          const errStr = String(err?.message || JSON.stringify(err) || '');
          const isRateLimit = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED');
          const isTransient =
            errStr.includes('503') ||
            errStr.includes('high demand') ||
            errStr.includes('UNAVAILABLE') ||
            isRateLimit;

          if (isRateLimit) {
            // Do not retry same rate-limited model; move to next model in modelsToTry
            break;
          }

          if (isTransient && attempt < 1) {
            // Wait 200ms before retrying same model for transient server busy errors
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }

          if (isTransient) break;

          // If error is 400 or model-specific invalid argument, log and try next model
          console.warn(`Gemini model ${model} failed (${errStr}). Trying next model...`);
          break;
        }
      }
    }
    throw lastError || new Error('All Gemini model fallbacks exhausted.');
  }

  public async translateAndExtractIntent(
    inputText: string,
    sourceLangCode: string,
    targetLangCode: string,
    context?: string
  ): Promise<GeminiTranslationResult> {
    const sourceLangObj = getLanguageByCode(sourceLangCode);
    const targetLangObj = getLanguageByCode(targetLangCode);

    const contextBlock = context && context.trim()
      ? `\nPrevious conversation context in this session:\n"${context.trim()}"\n`
      : '';

    const prompt = `You are X-Late AI Live Speech Translator Engine.${contextBlock}
Current input text to translate: "${inputText}"
Source language expected: "${sourceLangObj.name}" (${sourceLangCode}) [Note: If source language is Auto-Detect, identify the actual spoken source language accurately].
Target language required: "${targetLangObj.name}" (${targetLangCode}).

Your tasks:
1. Transcribe/Clean the original speech input if necessary. (Note: Pay special attention to Hindi, Hinglish, or Romanized Hindi speech like 'kaise ho', 'ticket book karna hai', 'railway station kahan hai' - convert to accurate Hindi Devanagari script or standard clean text).
2. Translate the input accurately and naturally into "${targetLangObj.name}", maintaining semantic continuity with any previous context provided.
3. Extract INTENT / MEANING: Produce an ULTRA-SHORT summary (strictly 3 to 8 words maximum) describing the communicative intent or core meaning of the speech.
   Examples of valid intent strings:
   - "Asking for airport taxi location"
   - "Inquiring about hotel room price"
   - "Confirming Friday 10 AM meeting"
   - "Requesting medical assistance"
   - "Expressing gratitude and farewell"
4. Detect Tasks & Commitments: Identify if the speech contains any explicit action items, appointments, dates, times, or commitments (e.g. "I will call you on Friday at 10 AM"). Extract any tasks with title, due date (YYYY-MM-DD), time, and priority ('IMPORTANT' or 'NORMAL'). If no task is present, return an empty array.

Strict Rules:
- High accuracy for Hindi, Hinglish, and Indian regional phrases/dialects.
- Intent MUST be 3 to 8 words. No fluff. No hallucination beyond what was said.
- Provide output strictly conforming to the JSON schema.`;

    try {
      const response = await this.generateWithFallback({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING },
              translatedText: { type: Type.STRING },
              detectedSourceLangCode: { type: Type.STRING },
              detectedSourceLangName: { type: Type.STRING },
              intent: { type: Type.STRING },
              detectedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    dueTime: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['IMPORTANT', 'NORMAL'] },
                    extractedSentence: { type: Type.STRING }
                  },
                  required: ['title']
                }
              }
            },
            required: ['originalText', 'translatedText', 'intent']
          }
        }
      });

      const responseText = response.text || '{}';
      const parsed = JSON.parse(responseText);

      return {
        originalText: parsed.originalText || inputText,
        translatedText: parsed.translatedText || inputText,
        sourceLangCode: parsed.detectedSourceLangCode || sourceLangCode,
        sourceLangName: parsed.detectedSourceLangName || sourceLangObj.name,
        targetLangCode,
        targetLangName: targetLangObj.name,
        intent: parsed.intent || 'General communication',
        detectedTasks: Array.isArray(parsed.detectedTasks) ? parsed.detectedTasks : []
      };
    } catch (err: any) {
      const errStr = String(err?.message || err || '');
      const isQuota = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED');
      console.warn(`Gemini Live Translation info: ${isQuota ? 'Quota limit hit, using instant local fallback' : 'Using instant local fallback'}`);
      // Instant failover response using local translator
      const fallbackTranslation = instantLocalTranslate(inputText, sourceLangCode, targetLangCode) || inputText;
      return {
        originalText: inputText,
        translatedText: fallbackTranslation,
        sourceLangCode,
        sourceLangName: sourceLangObj.name,
        targetLangCode,
        targetLangName: targetLangObj.name,
        intent: 'General communication',
        detectedTasks: []
      };
    }
  }

  // Audio file / blob multi-modal translation
  public async translateAudioBlob(
    audioBase64: string,
    mimeType: string,
    sourceLangCode: string,
    targetLangCode: string
  ): Promise<GeminiTranslationResult> {
    const sourceLangObj = getLanguageByCode(sourceLangCode);
    const targetLangObj = getLanguageByCode(targetLangCode);

    // 1. Sanitize base64 string (remove data URL headers if present & whitespace & pad)
    let cleanBase64 = (audioBase64 || '').trim();
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');
    while (cleanBase64.length % 4 !== 0) {
      cleanBase64 += '=';
    }

    if (!cleanBase64 || cleanBase64.length < 100) {
      return {
        originalText: 'Audio recording',
        translatedText: 'Audio recording',
        sourceLangCode,
        sourceLangName: sourceLangObj.name,
        targetLangCode,
        targetLangName: targetLangObj.name,
        intent: 'Speech communication',
        detectedTasks: []
      };
    }

    // 2. Sanitize MIME type (remove parameter suffixes like ';codecs=opus' which cause Gemini API 400 INVALID_ARGUMENT errors)
    let cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (cleanMimeType === 'audio/x-wav') cleanMimeType = 'audio/wav';
    if (!cleanMimeType || cleanMimeType === 'audio/unknown' || cleanMimeType === 'application/octet-stream') {
      cleanMimeType = 'audio/webm';
    }

    const prompt = `You are X-Late AI Live Speech Audio Translator Engine.
Listen to the attached audio clip carefully.
1. Transcribe the audio accurately in its native language (Pay high attention to Hindi, Hinglish, or regional Indian dialects; transcribe accurately into Devanagari script for Hindi).
2. Translate the speech naturally and accurately into target language: "${targetLangObj.name}" (${targetLangCode}).
3. Extract INTENT / MEANING: Produce an ULTRA-SHORT summary (3 to 8 words) describing the core intent.
4. Extract any actionable tasks/commitments with due dates if mentioned.`;

    try {
      const response = await this.generateWithFallback({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: cleanMimeType
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING },
              translatedText: { type: Type.STRING },
              detectedSourceLangCode: { type: Type.STRING },
              detectedSourceLangName: { type: Type.STRING },
              intent: { type: Type.STRING },
              detectedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    dueTime: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['IMPORTANT', 'NORMAL'] }
                  },
                  required: ['title']
                }
              }
            },
            required: ['originalText', 'translatedText', 'intent']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        originalText: parsed.originalText || 'Transcribed speech audio',
        translatedText: parsed.translatedText || 'Translated speech audio',
        sourceLangCode: parsed.detectedSourceLangCode || sourceLangCode,
        sourceLangName: parsed.detectedSourceLangName || sourceLangObj.name,
        targetLangCode,
        targetLangName: targetLangObj.name,
        intent: parsed.intent || 'Speech communication',
        detectedTasks: Array.isArray(parsed.detectedTasks) ? parsed.detectedTasks : []
      };
    } catch (err: any) {
      console.warn('Gemini audio blob translation warning:', err?.message || String(err));
      return {
        originalText: 'Audio recording',
        translatedText: 'Audio translation unavailable',
        sourceLangCode,
        sourceLangName: sourceLangObj.name,
        targetLangCode,
        targetLangName: targetLangObj.name,
        intent: 'Speech communication',
        detectedTasks: []
      };
    }
  }

  public async translateSongLyrics(params: {
    audioBase64?: string;
    mimeType?: string;
    lyricsOrText?: string;
    targetLangCode: string;
    targetLangName?: string;
  }): Promise<SongLyricsResult> {
    const targetLangObj = getLanguageByCode(params.targetLangCode);
    const targetLangName = params.targetLangName || targetLangObj.name;

    const lyricsPrompt = `You are X-Late AI Live Music & Song Lyrics Translation Engine.
Analyze the input (live song audio clip or song lyrics text).
Your goals:
1. Identify the song title, artist, genre, and original sung language if possible (otherwise state 'Live Music Track').
2. Transcribe or clean up the sung lyrics in its native script.
3. Translate the song lyrics line-by-line into the user's desired target language: "${targetLangName}" (${params.targetLangCode}). Preserve the poetic emotion, rhyme, and rhythm where possible.
4. Provide a phonetic pronunciation / transliteration (e.g. Romanized lyrics) for each line so the user can sing along in the target or native script!
5. Summarize the overarching theme / emotional mood of the song in 1 brief sentence.

Provide output strictly adhering to JSON schema.`;

    let contents: any;
    if (params.audioBase64) {
      let cleanBase64 = (params.audioBase64 || '').trim();
      if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];
      cleanBase64 = cleanBase64.replace(/\s/g, '');
      while (cleanBase64.length % 4 !== 0) cleanBase64 += '=';

      let cleanMimeType = (params.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
      if (cleanMimeType === 'audio/x-wav') cleanMimeType = 'audio/wav';

      contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: cleanMimeType
              }
            },
            { text: lyricsPrompt }
          ]
        }
      ];
    } else {
      contents = `${lyricsPrompt}\n\nSong Lyrics or Title Input:\n"${params.lyricsOrText || ''}"`;
    }

    try {
      const response = await this.generateWithFallback({
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              songTitle: { type: Type.STRING },
              artist: { type: Type.STRING },
              genre: { type: Type.STRING },
              sungLanguage: { type: Type.STRING },
              theme: { type: Type.STRING },
              lineByLine: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    originalLine: { type: Type.STRING },
                    translatedLine: { type: Type.STRING },
                    phoneticLine: { type: Type.STRING }
                  },
                  required: ['originalLine', 'translatedLine']
                }
              },
              fullOriginalText: { type: Type.STRING },
              fullTranslatedText: { type: Type.STRING }
            },
            required: ['songTitle', 'lineByLine', 'theme']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      const lineByLine = Array.isArray(parsed.lineByLine) ? parsed.lineByLine : [];
      
      const fullOriginal = parsed.fullOriginalText || lineByLine.map((l: any) => l.originalLine).join('\n');
      const fullTranslated = parsed.fullTranslatedText || lineByLine.map((l: any) => l.translatedLine).join('\n');

      return {
        songTitle: parsed.songTitle || 'Live Song Translation',
        artist: parsed.artist || 'Unknown Artist',
        genre: parsed.genre || 'Song',
        sungLanguage: parsed.sungLanguage || 'Auto-Detected',
        targetLanguage: targetLangName,
        theme: parsed.theme || 'Musical expression',
        lineByLine,
        fullOriginalText: fullOriginal,
        fullTranslatedText: fullTranslated
      };
    } catch (err: any) {
      console.warn('Gemini song lyrics translation warning, generating local lyrics fallback:', err?.message || String(err));
      return generateLocalSongLyricsFallback(
        params.lyricsOrText || 'Live Music Track',
        params.targetLangCode,
        targetLangName
      );
    }
  }
}

export const geminiService = new GeminiService();
