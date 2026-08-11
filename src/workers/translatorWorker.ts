// Web Worker for non-blocking sub-millisecond translation processing
import { instantLocalTranslate } from '../lib/instantTranslator';

export interface TranslatorWorkerInput {
  id: string;
  text: string;
  sourceLang: string;
  targetLang: string;
}

export interface TranslatorWorkerOutput {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

self.onmessage = (event: MessageEvent<TranslatorWorkerInput>) => {
  const { id, text, sourceLang, targetLang } = event.data;
  if (!text) {
    self.postMessage({ id, originalText: '', translatedText: '', sourceLang, targetLang });
    return;
  }

  const translatedText = instantLocalTranslate(text, sourceLang, targetLang);

  const response: TranslatorWorkerOutput = {
    id,
    originalText: text,
    translatedText,
    sourceLang,
    targetLang
  };

  self.postMessage(response);
};
