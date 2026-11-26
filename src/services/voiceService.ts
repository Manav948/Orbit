/**
 * voiceService.ts
 *
 * Windows WebView2 Speech Recognition & Voice Dictation Service.
 * Captures microphone audio using the standard MediaRecorder API and transcribes
 * via Groq Whisper (whisper-large-v3-turbo ~200ms) or OpenAI Whisper on the Rust backend.
 * Bypasses Google's locked Web Speech cloud endpoint to prevent "network" errors in WebView2.
 */

import { dbService } from "./dbService";

export interface VoiceRecognitionStatus {
  isSupported: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  error: string | null;
}

export interface VoiceRecognitionOptions {
  autoStopAfterSilenceMs?: number;
}

class VoiceRecognitionService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private isListening = false;
  private isTranscribing = false;
  private silenceMonitorId: number | null = null;
  private audioContext: AudioContext | null = null;
  private statusListeners: Array<(status: VoiceRecognitionStatus) => void> = [];

  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  public isSupported(): boolean {
    return !!(
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof window.MediaRecorder !== "undefined"
    );
  }

  public getStatus(): VoiceRecognitionStatus {
    return {
      isSupported: this.isSupported(),
      isListening: this.isListening,
      isTranscribing: this.isTranscribing,
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
      isTranscribing: this.isTranscribing,
      error,
    };
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Starts recording audio from the microphone.
   * Call `stopListening()` manually, or enable silence detection, to transcribe with Groq Whisper.
   */
  public async startListeningAsync(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (errorMessage: string) => void,
    onEnd?: () => void,
    options: VoiceRecognitionOptions = {}
  ): Promise<boolean> {
    if (!this.isSupported()) {
      const msg = "Microphone audio recording is not supported in this runtime environment.";
      onError(msg);
      this.notify(msg);
      return false;
    }

    if (this.isListening) {
      this.stopListening();
      return true;
    }

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;
    this.onEndCallback = onEnd || null;
    this.audioChunks = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.mediaStream = stream;

      // Pick best supported MIME type
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        this.isListening = false;
        this.cleanupStream();

        if (this.audioChunks.length === 0) {
          if (this.onEndCallback) this.onEndCallback();
          this.notify(null);
          return;
        }

        // Process audio with Whisper
        this.isTranscribing = true;
        this.notify(null);

        try {
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(arrayBuffer));

          const transcript = await dbService.transcribeAudio(bytes, mimeType);
          if (this.onTranscriptCallback && transcript.trim()) {
            this.onTranscriptCallback(transcript.trim(), true);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Audio transcription failed.";
          if (this.onErrorCallback) {
            this.onErrorCallback(errMsg);
          }
          this.notify(errMsg);
        } finally {
          this.isTranscribing = false;
          this.audioChunks = [];
          if (this.onEndCallback) {
            this.onEndCallback();
          }
          this.notify(null);
        }
      };

      recorder.onerror = () => {
        this.isListening = false;
        this.cleanupStream();
        const msg = "Audio recording error.";
        if (this.onErrorCallback) this.onErrorCallback(msg);
        this.notify(msg);
      };

      recorder.start(250); // collect in 250ms chunks
      this.isListening = true;
      if (options.autoStopAfterSilenceMs) {
        this.startSilenceMonitor(stream, options.autoStopAfterSilenceMs);
      }
      this.notify(null);
      return true;
    } catch (err: unknown) {
      this.isListening = false;
      this.cleanupStream();

      let userMessage = "Could not access microphone.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          userMessage = "Microphone access denied. Please allow microphone permissions in Windows Settings > Privacy > Microphone.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          userMessage = "No microphone hardware detected. Please connect an audio input device.";
        } else {
          userMessage = `Microphone error: ${err.message}`;
        }
      }

      if (this.onErrorCallback) this.onErrorCallback(userMessage);
      this.notify(userMessage);
      return false;
    }
  }

  /**
   * Synchronous signature wrapper for compatibility with callers.
   */
  public startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (errorMessage: string) => void,
    onEnd?: () => void,
    options: VoiceRecognitionOptions = {}
  ): boolean {
    this.startListeningAsync(onTranscript, onError, onEnd, options).catch((err) => {
      onError(err instanceof Error ? err.message : "Failed to start microphone.");
    });
    return true;
  }

  /**
   * Stop listening and trigger transcription of recorded speech.
   */
  public stopListening() {
    this.stopSilenceMonitor();
    if (this.mediaRecorder && this.isListening) {
      try {
        if (this.mediaRecorder.state !== "inactive") {
          this.mediaRecorder.stop();
        }
      } catch {
        // ignore
      }
    }
    this.isListening = false;
  }

  private cleanupStream() {
    this.stopSilenceMonitor();
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.mediaStream = null;
    }
  }

  private startSilenceMonitor(stream: MediaStream, silenceTimeoutMs: number) {
    if (typeof window.AudioContext === "undefined") {
      this.onErrorCallback?.("Automatic silence detection is unavailable; tap the microphone again to send.");
      return;
    }

    try {
      const context = new window.AudioContext();
      this.audioContext = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      if (context.state === "suspended") {
        void context.resume().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Audio context could not resume.";
          this.stopSilenceMonitor();
          this.onErrorCallback?.(`Automatic stop unavailable: ${message}. Tap the microphone again to send.`);
          this.notify(message);
        });
      }

      const samples = new Uint8Array(analyser.fftSize);
      let speechDetected = false;
      let silenceStartedAt: number | null = null;

      this.silenceMonitorId = window.setInterval(() => {
        if (!this.isListening) {
          this.stopSilenceMonitor();
          return;
        }

        analyser.getByteTimeDomainData(samples);
        const sumSquares = samples.reduce((sum, sample) => {
          const normalized = (sample - 128) / 128;
          return sum + normalized * normalized;
        }, 0);
        const volume = Math.sqrt(sumSquares / samples.length);

        if (volume >= 0.02) {
          speechDetected = true;
          silenceStartedAt = null;
        } else if (speechDetected) {
          silenceStartedAt ??= Date.now();
          if (Date.now() - silenceStartedAt >= silenceTimeoutMs) {
            this.stopListening();
          }
        }
      }, 120);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Audio silence detection failed.";
      this.stopSilenceMonitor();
      this.onErrorCallback?.(`Automatic stop unavailable: ${message}. Tap the microphone again to send.`);
      this.notify(message);
    }
  }

  private stopSilenceMonitor() {
    if (this.silenceMonitorId !== null) {
      window.clearInterval(this.silenceMonitorId);
      this.silenceMonitorId = null;
    }
    if (this.audioContext) {
      const context = this.audioContext;
      this.audioContext = null;
      void context.close().catch((err: unknown) => {
        console.warn("[Voice] Failed to close silence monitor audio context:", err);
      });
    }
  }
}

export const voiceService = new VoiceRecognitionService();
