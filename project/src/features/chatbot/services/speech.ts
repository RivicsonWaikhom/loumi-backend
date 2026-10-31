// Web Speech API Voice Helpers for Browser Speech Recognition and Speech Synthesis
// Optimized for Chrome, Edge, Safari, and Brave with natural sentence pacing and duplicate-proof transcription.

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeechRecognitionCallbacks {
  onInterim?: (interimText: string) => void;
  onFinal?: (finalChunk: string, accumulatedFinal: string) => void;
  onError?: (errorMessage: string, errorType: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * SpeechRecognizer
 * Manages a single active browser speech recognition instance per session.
 * Enforces separation of finalized vs interim transcripts to eliminate duplicate word bugs.
 */
export class SpeechRecognizer {
  private recognition: any = null;
  private isListening = false;
  private isStarting = false;
  private sessionId = 0;
  private sessionFinalizedTranscript = '';

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (!isSpeechRecognitionSupported()) return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public start(callbacks: SpeechRecognitionCallbacks, lang: string = 'en-US') {
    if (!isSpeechRecognitionSupported() || !this.recognition) {
      callbacks.onError?.('Speech recognition is not supported in this browser.', 'not-supported');
      return;
    }

    // Prevent double invocation while starting or already listening
    if (this.isListening || this.isStarting) {
      return;
    }

    this.isStarting = true;
    this.sessionId += 1;
    const currentSessionId = this.sessionId;
    this.sessionFinalizedTranscript = '';

    // Re-initialize if previous session had an error
    try {
      this.recognition.lang = lang;
    } catch {
      // Ignore lang set errors
    }

    this.recognition.onstart = () => {
      if (this.sessionId !== currentSessionId) return;
      this.isStarting = false;
      this.isListening = true;
      callbacks.onStart?.();
    };

    this.recognition.onresult = (event: any) => {
      if (this.sessionId !== currentSessionId) return;

      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (!result || !result[0]) continue;
        const transcriptChunk = result[0].transcript || '';

        if (result.isFinal) {
          // Append finalized result once
          const cleanChunk = transcriptChunk.trim();
          if (cleanChunk) {
            this.sessionFinalizedTranscript = this.sessionFinalizedTranscript
              ? `${this.sessionFinalizedTranscript} ${cleanChunk}`
              : cleanChunk;
            callbacks.onFinal?.(cleanChunk, this.sessionFinalizedTranscript);
          }
        } else {
          // Accumulate temporary interim preview
          currentInterim += transcriptChunk;
        }
      }

      // Always pass the current interim preview (can be empty string when all chunks are final)
      callbacks.onInterim?.(currentInterim.trim());
    };

    this.recognition.onerror = (event: any) => {
      if (this.sessionId !== currentSessionId) return;
      this.isStarting = false;
      this.isListening = false;

      const errorType = event.error || 'unknown';
      let message = 'Speech recognition encountered an error.';

      if (errorType === 'not-allowed' || errorType === 'permission-denied') {
        message = 'Microphone permission was denied. Please allow microphone access in your browser address bar.';
      } else if (errorType === 'no-speech') {
        message = 'No speech was detected. Please try speaking again.';
      } else if (errorType === 'network' || errorType === 'service-not-allowed') {
        message = 'Speech recognition service is unavailable (often blocked in privacy-first browsers like Brave). You can continue typing directly below.';
      } else if (errorType === 'audio-capture') {
        message = 'No microphone device was detected. Please check your sound settings.';
      } else if (errorType === 'aborted') {
        // User deliberately stopped or dismissed; do not show error banner
        callbacks.onEnd?.();
        return;
      }

      callbacks.onError?.(message, errorType);
    };

    this.recognition.onend = () => {
      if (this.sessionId !== currentSessionId) return;
      this.isStarting = false;
      this.isListening = false;
      callbacks.onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (err: any) {
      this.isStarting = false;
      this.isListening = false;
      // Handle browser already started state
      if (err.name === 'InvalidStateError') {
        try {
          this.recognition.stop();
        } catch {
          // ignore
        }
      }
      callbacks.onError?.('Could not start microphone session. Please try again.', 'invalid-state');
    }
  }

  public stop() {
    this.isStarting = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListening = false;
  }

  public abort() {
    this.isStarting = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
    }
    this.isListening = false;
  }
}

// -------------------------------------------------------------
// Natural Browser Speech Synthesis with Pacing & 15s Timeout Fix
// -------------------------------------------------------------

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;
let activePlaybackSessionId = 0;

/**
 * Loads and caches available voices across all desktop and mobile browsers.
 */
export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }

    const current = window.speechSynthesis.getVoices();
    if (current && current.length > 0) {
      cachedVoices = current;
      voicesLoaded = true;
      resolve(current);
      return;
    }

    const handleVoicesChanged = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        cachedVoices = voices;
        voicesLoaded = true;
        resolve(voices);
      }
    };

    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

    // Timeout fallback if onvoiceschanged doesn't fire immediately
    setTimeout(() => {
      const fallback = window.speechSynthesis.getVoices();
      if (fallback && fallback.length > 0) {
        cachedVoices = fallback;
        voicesLoaded = true;
        resolve(fallback);
      } else {
        resolve([]);
      }
    }, 300);
  });
}

// Kick off voice preloading early
if (isSpeechSynthesisSupported()) {
  getAvailableVoices();
}

/**
 * Evaluates available English voices and selects the most natural-sounding voice.
 * Prioritizes natural/neural descriptors and Indian English (en-IN), UK English (en-GB), and US English (en-US).
 */
export function selectBestEnglishVoice(
  voices: SpeechSynthesisVoice[],
  preferredLocale?: string
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // Filter to English voices
  const englishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  if (englishVoices.length === 0) {
    return voices[0] || null;
  }

  // If a preferred locale is requested and available, restrict candidates to that locale
  let candidates = englishVoices;
  if (preferredLocale) {
    const localeMatched = englishVoices.filter((v) =>
      v.lang.toLowerCase().replace('_', '-').includes(preferredLocale.toLowerCase().replace('_', '-'))
    );
    if (localeMatched.length > 0) {
      candidates = localeMatched;
    }
  }

  // Scoring function based on natural quality markers
  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase().replace('_', '-');

    // Indian English preferred for Loumi Manipur farmers
    if (lang === 'en-in') {
      score += 25;
    } else if (lang === 'en-gb') {
      score += 20;
    } else if (lang === 'en-us') {
      score += 15;
    }

    // Natural / High-quality speech engines (Microsoft Natural, Google, Apple Neural)
    if (name.includes('natural')) score += 35;
    if (name.includes('neural')) score += 30;
    if (name.includes('online')) score += 20;
    if (name.includes('enhanced')) score += 20;
    if (name.includes('premium')) score += 20;
    if (name.includes('google')) score += 15;
    if (name.includes('geeta') || name.includes('veena') || name.includes('rishi')) score += 15; // Indian English voices
    if (name.includes('hazel') || name.includes('susan') || name.includes('george')) score += 10;
    if (name.includes('zira') || name.includes('jenny')) score += 10;

    // Deprioritize known harsh legacy synthetic voices
    if (name.includes('david desktop') || name.includes('espeak')) score -= 25;

    return score;
  };

  const sorted = [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return sorted[0] || candidates[0];
}

/**
 * Splits formatted markdown/agricultural text into clean sentence units.
 * Eliminates markdown tokens, citations, and filenames for fluent spoken audio.
 */
export function prepareTextForSpeech(text: string): string[] {
  let clean = text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italics
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove links [title](url) -> title
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Clean bullet points
    .replace(/^\s*[-•*]\s+/gm, '')
    // Replace citations like (diseases_of_pineapple1.pdf, Page 1) -> (Page 1)
    .replace(/\([\w\-+\s]+\.pdf,\s*(Page\s*\d+)\)/gi, 'from $1')
    // Normalize extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  // Split into sentence chunks on punctuation delimiters (. ! ? \n)
  const rawSentences = clean.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [clean];
  const chunks: string[] = [];

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    // If a sentence is very long (> 200 chars), split by commas to ensure Chrome 15s safety
    if (trimmed.length > 200) {
      const subParts = trimmed.split(/,\s+/);
      let buffer = '';
      for (const part of subParts) {
        if ((buffer + part).length > 180) {
          if (buffer) chunks.push(buffer.trim() + ',');
          buffer = part;
        } else {
          buffer = buffer ? `${buffer}, ${part}` : part;
        }
      }
      if (buffer) chunks.push(buffer.trim());
    } else {
      chunks.push(trimmed);
    }
  }

  return chunks;
}

export interface VoicePlaybackOptions {
  preferredLocale?: string;
  rate?: number; // default 0.98
  pitch?: number; // default 1.0
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Speaks the given text using natural sentence-by-sentence queueing.
 * Prevents overlapping speech and eliminates the 15-second speech cutoff in Chrome.
 */
export async function speakText(text: string, options?: VoicePlaybackOptions) {
  if (!isSpeechSynthesisSupported()) {
    options?.onError?.('Speech synthesis is not supported on this browser.');
    return;
  }

  // Cancel any currently playing speech immediately
  stopSpeaking();

  const chunks = prepareTextForSpeech(text);
  if (chunks.length === 0) {
    options?.onEnd?.();
    return;
  }

  activePlaybackSessionId += 1;
  const currentSessionId = activePlaybackSessionId;

  // Retrieve best available voice
  let voices = cachedVoices;
  if (!voicesLoaded || voices.length === 0) {
    voices = await getAvailableVoices();
  }
  const voice = selectBestEnglishVoice(voices, options?.preferredLocale);

  let currentChunkIndex = 0;
  let hasStarted = false;

  const playNextChunk = () => {
    // If playback was cancelled or another speak command started, halt
    if (activePlaybackSessionId !== currentSessionId) {
      return;
    }

    if (currentChunkIndex >= chunks.length) {
      options?.onEnd?.();
      return;
    }

    const chunkText = chunks[currentChunkIndex];
    currentChunkIndex += 1;

    const utterance = new SpeechSynthesisUtterance(chunkText);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'en-US';
    }

    // Natural pacing for agricultural advisory
    utterance.rate = options?.rate !== undefined ? options.rate : 0.98;
    utterance.pitch = options?.pitch !== undefined ? options.pitch : 1.0;

    utterance.onstart = () => {
      if (activePlaybackSessionId !== currentSessionId) return;
      if (!hasStarted) {
        hasStarted = true;
        options?.onStart?.();
      }
    };

    utterance.onend = () => {
      if (activePlaybackSessionId !== currentSessionId) return;
      // Slight natural pause between sentences (50ms)
      setTimeout(playNextChunk, 50);
    };

    utterance.onerror = (e) => {
      if (activePlaybackSessionId !== currentSessionId) return;
      // If cancelled intentionally, ignore error
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      options?.onError?.(e);
      options?.onEnd?.();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      options?.onError?.(err);
      options?.onEnd?.();
    }
  };

  playNextChunk();
}

/**
 * Stops any active speech synthesis audio immediately and cancels pending utterances.
 */
export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    activePlaybackSessionId += 1;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}
