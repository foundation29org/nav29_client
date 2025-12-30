import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

declare var webkitSpeechRecognition: any;

export interface SpeechRecognitionResult {
  text: string;
  isFinal: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: any;
  private speechConfig: SpeechSDK.SpeechConfig;
  private audioConfig: SpeechSDK.AudioConfig;
  private recognizer: SpeechSDK.SpeechRecognizer;
  private isWebSpeechSupported: boolean = false;
  private isAzureSupported: boolean = false;
  private currentProvider: 'web' | 'azure' | null = null;
  
  private resultSubject = new Subject<SpeechRecognitionResult>();
  private errorSubject = new Subject<string>();
  private statusSubject = new Subject<string>();
  
  public results$: Observable<SpeechRecognitionResult> = this.resultSubject.asObservable();
  public errors$: Observable<string> = this.errorSubject.asObservable();
  public status$: Observable<string> = this.statusSubject.asObservable();
  
  private isRecording: boolean = false;
  private accumulatedText: string = '';
  private useBackendProxy: boolean = false; // Si true, usa backend; si false, usa key directa (menos seguro)

  constructor(private http: HttpClient) {
    this.initialize();
  }

  private initialize() {
    // Detectar soporte de Web Speech API
    this.isWebSpeechSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    
    // Azure Speech siempre se maneja desde el backend (más seguro)
    this.useBackendProxy = true;
    this.isAzureSupported = true; // Siempre disponible si el backend está configurado
    
    if (this.isWebSpeechSupported) {
      this.setupWebSpeechRecognition();
      this.currentProvider = 'web';
    } else if (this.isAzureSupported) {
      // setupAzureSpeechRecognition se llamará cuando se necesite (después de obtener token del backend)
      this.currentProvider = 'azure';
    }
  }

  private setupWebSpeechRecognition() {
    this.recognition = new webkitSpeechRecognition();
    const lang = localStorage.getItem('lang') || 'es';
    const langMap: { [key: string]: string } = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT'
    };
    this.recognition.lang = langMap[lang] || 'es-ES';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
  }

  private async setupAzureSpeechRecognition() {
    try {
      // Obtener token temporal del backend (única forma de autenticación)
      const response: any = await this.http.get(`${environment.api}/api/speech/token`).toPromise();
      
      if (!response || !response.region) {
        throw new Error('Backend no devolvió región válida');
      }

      const speechRegion = response.region;
      
      if (response.token) {
        // Usar token temporal del backend (más seguro)
        this.speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
          response.token,
          speechRegion
        );
      } else {
        throw new Error('Backend no devolvió token. Verifica la configuración de AZURE_SPEECH_KEY en el servidor.');
      }

      if (!this.speechConfig) {
        throw new Error('No se pudo configurar Azure Speech');
      }
      
      const lang = localStorage.getItem('lang') || 'es';
      const langMap: { [key: string]: string } = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT'
      };
      this.speechConfig.speechRecognitionLanguage = langMap[lang] || 'es-ES';
      
      // Configurar para reconocimiento continuo
      this.speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        '5000'
      );
    } catch (error) {
      console.error('Error setting up Azure Speech:', error);
      const errorMessage = error.message || 'Error configuring Azure Speech Service';
      this.errorSubject.next(errorMessage + '. Verifica que el backend tenga configurado AZURE_SPEECH_KEY y AZURE_SPEECH_REGION.');
    }
  }

  public isSupported(): boolean {
    return this.isWebSpeechSupported || this.isAzureSupported;
  }

  public getProvider(): 'web' | 'azure' | null {
    return this.currentProvider;
  }

  public start(): void {
    if (!this.isSupported()) {
      this.errorSubject.next('Speech recognition is not supported in this browser');
      return;
    }

    if (this.isRecording) {
      return;
    }

    this.isRecording = true;
    this.accumulatedText = '';
    this.statusSubject.next('starting');

    if (this.currentProvider === 'web') {
      this.startWebSpeech();
    } else if (this.currentProvider === 'azure') {
      this.startAzureSpeech();
    }
  }

  private startWebSpeech(): void {
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.accumulatedText += finalTranscript;
        this.resultSubject.next({
          text: this.accumulatedText,
          isFinal: true
        });
      } else if (interimTranscript) {
        this.resultSubject.next({
          text: this.accumulatedText + interimTranscript,
          isFinal: false
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Reiniciar automáticamente si no hay habla
        this.restartWebSpeech();
      } else {
        this.errorSubject.next(`Error: ${event.error}`);
        this.stop();
      }
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        // Reiniciar automáticamente si aún está grabando
        this.restartWebSpeech();
      }
    };

    this.recognition.start();
    this.statusSubject.next('recording');
  }

  private restartWebSpeech(): void {
    if (this.isRecording && this.currentProvider === 'web') {
      setTimeout(() => {
        if (this.isRecording) {
          this.recognition.start();
        }
      }, 100);
    }
  }

  private async startAzureSpeech(): Promise<void> {
    try {
      // Si aún no está configurado, configurarlo ahora
      if (!this.speechConfig) {
        await this.setupAzureSpeechRecognition();
      }
      
      if (!this.speechConfig) {
        this.errorSubject.next('No se pudo configurar Azure Speech Service');
        return;
      }
      
      // Crear configuración de audio desde el micrófono
      this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig);

      this.recognizer.recognizing = (s, e) => {
        if (e.result.text) {
          this.resultSubject.next({
            text: this.accumulatedText + e.result.text,
            isFinal: false
          });
        }
      };

      this.recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          if (e.result.text) {
            this.accumulatedText += e.result.text + ' ';
            this.resultSubject.next({
              text: this.accumulatedText,
              isFinal: true
            });
          }
        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          // No hay coincidencia, continuar escuchando
        }
      };

      this.recognizer.canceled = (s, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          this.errorSubject.next(`Error: ${e.errorDetails}`);
          this.stop();
        }
      };

      this.recognizer.sessionStopped = () => {
        if (this.isRecording) {
          // Reiniciar si aún está grabando
          this.startAzureSpeech();
        }
      };

      // Iniciar reconocimiento continuo
      this.recognizer.startContinuousRecognitionAsync(
        () => {
          this.statusSubject.next('recording');
        },
        (error: string) => {
          this.errorSubject.next(`Error starting recognition: ${error}`);
          this.stop();
        }
      );
    } catch (error) {
      console.error('Error starting Azure Speech:', error);
      this.errorSubject.next('Error starting speech recognition');
      this.stop();
    }
  }

  public stop(): void {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;
    this.statusSubject.next('stopping');

    if (this.currentProvider === 'web' && this.recognition) {
      this.recognition.stop();
      this.recognition.onend = null; // Evitar reinicio automático
    } else if (this.currentProvider === 'azure' && this.recognizer) {
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          this.statusSubject.next('stopped');
          this.cleanupAzure();
        },
        (error: string) => {
          console.error('Error stopping recognition:', error);
          this.cleanupAzure();
        }
      );
    }
  }

  private cleanupAzure(): void {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
    if (this.audioConfig) {
      this.audioConfig.close();
      this.audioConfig = null;
    }
  }

  public getAccumulatedText(): string {
    return this.accumulatedText;
  }

  public clearAccumulatedText(): void {
    this.accumulatedText = '';
  }

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

