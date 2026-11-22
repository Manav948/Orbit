/**
 * ttsService.ts
 *
 * Text-to-Speech (TTS) Service using Windows WebView2's native SpeechSynthesis API.
 * Provides voice playback, pause, resume, stop, system voice listing, rate control,
 * and automatic speech response support without blocking the user interface.
 */

export interface TtsState {
  isSpeaking: boolean;
  isPaused: boolean;
  currentText: string | null;
}

class TextToSpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoiceUri: string | null = null;
  private speechRate: number = 1.0;
  private autoSpeakEnabled: boolean = false;
  private listeners: Array<(state: TtsState) => void> = [];

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    try {
      this.voices = this.synth.getVoices();
    } catch {
      this.voices = [];
    }
  }

  public isSupported(): boolean {
    return !!(typeof window !== "undefined" && "speechSynthesis" in window);
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.synth) {
      this.loadVoices();
    }
    return this.voices;
  }

  public setVoice(voiceUri: string) {
    this.selectedVoiceUri = voiceUri;
  }

  public setRate(rate: number) {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  public setAutoSpeak(enabled: boolean) {
    this.autoSpeakEnabled = enabled;
  }

  public isAutoSpeakEnabled(): boolean {
    return this.autoSpeakEnabled;
  }

  public getState(): TtsState {
    return {
      isSpeaking: !!(this.synth && this.synth.speaking && !this.synth.paused),
      isPaused: !!(this.synth && this.synth.paused),
      currentText: this.currentUtterance ? this.currentUtterance.text : null,
    };
  }

  public onStateChange(listener: (state: TtsState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /**
   * Speak clean plain text (markdown symbols stripped for natural voice readout).
   */
  public speak(text: string, onEnd?: () => void): boolean {
    if (!this.synth || !this.isSupported()) return false;

    // Stop any ongoing speech
    this.stop();

    // Clean markdown formatting (e.g. **, #, urls, bullet dashes) for pleasant auditory experience
    const cleanText = text
      .replace(/[*_#`~[\]]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    if (!cleanText) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = this.speechRate;

      if (this.selectedVoiceUri) {
        const found = this.voices.find((v) => v.voiceURI === this.selectedVoiceUri || v.name === this.selectedVoiceUri);
        if (found) {
          utterance.voice = found;
        }
      }

      utterance.onstart = () => this.notify();
      utterance.onpause = () => this.notify();
      utterance.onresume = () => this.notify();

      utterance.onend = () => {
        this.currentUtterance = null;
        this.notify();
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        console.warn("[TTS] Utterance error:", e);
        this.currentUtterance = null;
        this.notify();
        if (onEnd) onEnd();
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
      this.notify();
      return true;
    } catch (err) {
      console.warn("[TTS] Failed to execute speech synthesis:", err);
      return false;
    }
  }

  public pause() {
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.notify();
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
      this.notify();
    }
  }

  public stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // ignore
      }
      this.currentUtterance = null;
      this.notify();
    }
  }
}

export const ttsService = new TextToSpeechService();

