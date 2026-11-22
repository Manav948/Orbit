/**
 * voiceService.ts
 *
 * Windows WebView2 Speech Recognition Service.
 * Evaluates browser Web Speech API availability dynamically, provides microphone
 * start/stop controls, interim and final transcript streaming, and graceful error handling.
 */

// Typing for Web Speech API
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

type SpeechRecognitionConstructor = new () => IWindowSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface VoiceRecognitionStatus {
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
}

class VoiceRecognitionService {
  private recognition: IWindowSpeechRecognition | null = null;
  private isListening = false;
  private statusListeners: Array<(status: VoiceRecognitionStatus) => void> = [];

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === "undefined") return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const instance = new SpeechRec();
        instance.continuous = true;
        instance.interimResults = true;
        instance.lang = "en-US";
        this.recognition = instance;
      } catch (err) {
        console.warn("[Voice] Web Speech API constructor failed:", err);
      }
    }
  }

  public isSupported(): boolean {
    return !!(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition));
  }

  public getStatus(): VoiceRecognitionStatus {
    return {
      isSupported: this.isSupported(),
      isListening: this.isListening,
      error: null,
    };
  }

  public onStatusChange(callback: (status: VoiceRecognitionStatus) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notify(error: string | null = null) {
    const status: VoiceRecognitionStatus = {
      isSupported: this.isSupported(),
      isListening: this.isListening,
      error,
    };
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  /**
   * Start listening for voice input.
   * `onTranscript` receives the accumulated text (interim or final) so the input field can update live.
   * `onEnd` is called when listening terminates.
   */
  public startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (errorMessage: string) => void,
    onEnd?: () => void
  ): boolean {
    if (!this.isSupported() || !this.recognition) {
      const msg = "Speech Recognition is not natively supported in this WebView2 runtime. Please use manual text input.";
      onError(msg);
      this.notify(msg);
      return false;
    }

    if (this.isListening) {
      this.stopListening();
    }

    try {
      this.recognition.onstart = () => {
        this.isListening = true;
        this.notify(null);
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = "";
        let isFinal = false;

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res && res[0]) {
            fullTranscript += res[0].transcript;
            if (res.isFinal) isFinal = true;
          }
        }

        if (fullTranscript.trim()) {
          onTranscript(fullTranscript, isFinal);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.isListening = false;
        let userMessage = "Speech recognition error.";
        switch (event.error) {
          case "not-allowed":
            userMessage = "Microphone access denied. Please allow microphone permissions in Windows Settings.";
            break;
          case "no-speech":
            userMessage = "No speech detected. Please speak closer to your microphone.";
            break;
          case "network":
            userMessage = "Speech service network issue. Please check your connection or use manual text input.";
            break;
          case "audio-capture":
            userMessage = "No microphone hardware detected. Please connect an audio input device.";
            break;
          default:
            userMessage = `Speech recognition error: ${event.error}`;
        }
        onError(userMessage);
        this.notify(userMessage);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.notify(null);
        if (onEnd) onEnd();
      };

      this.recognition.start();
      return true;
    } catch (err) {
      this.isListening = false;
      const msg = err instanceof Error ? err.message : "Failed to start microphone listener.";
      onError(msg);
      this.notify(msg);
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListening = false;
    this.notify(null);
  }
}

export const voiceService = new VoiceRecognitionService();

