import type { TtsSettings } from '@/types';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function loadVoices(timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      resolve(window.speechSynthesis.getVoices());
    };
    const onVoices = () => finish();
    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    window.setTimeout(finish, timeoutMs);
  });
}

export function createUtterance(text: string, settings: TtsSettings, voice?: SpeechSynthesisVoice): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  utterance.volume = settings.volume;
  utterance.lang = voice?.lang || 'es-ES';
  if (voice) utterance.voice = voice;
  return utterance;
}

export function cancelSpeech(sourceId?: string): void {
  if (speechSupported()) window.speechSynthesis.cancel();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('openhub:tts-cancel', { detail: sourceId }));
  }
}
