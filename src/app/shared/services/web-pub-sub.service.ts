import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { WebPubSubClient } from "@azure/web-pubsub-client";
import { HttpClient } from "@angular/common/http";
import { environment } from 'environments/environment';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { EventsService } from 'app/shared/services/events.service';
import * as decode from 'jwt-decode';

@Injectable({ providedIn: 'root' })
export class WebPubSubService {
  private messageSubject = new Subject<any>();
  isConnected: boolean = false;
  client: WebPubSubClient;

  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: any;
  private isListening: boolean = false;
  private currentUserId: string = ''; 

  constructor(private http: HttpClient, public insightsService: InsightsService, private eventsService: EventsService) { }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  async getToken(IdUser): Promise<string> {
    return new Promise(async (resolve, reject) => {
      // Guardar el userId para reconexiones futuras
      if (IdUser) {
        this.currentUserId = IdUser;
      }
      
      const userIdToUse = IdUser || this.currentUserId;
      if (!userIdToUse) {
        reject(new Error('No userId available for token request'));
        return;
      }
      
      const url = environment.api + '/api/gettoken/' + userIdToUse;
      const cacheBuster = Date.now().toString();
      // Usar withCredentials para enviar cookies de autenticación
      // Usar responseType: 'text' para manejar respuestas que no sean JSON válido
      this.http.get(url, {params: {_cb: cacheBuster}, withCredentials: true, responseType: 'text'})
        .subscribe((res: string) => {
          try {
            // Verificar si la respuesta parece HTML (sesión expirada/redirección)
            if (res.trim().startsWith('<!DOCTYPE') || res.trim().startsWith('<html')) {
              const error = new Error('Session expired or invalid response - received HTML instead of token');
              console.warn('getToken received HTML response - possible session expiration');
              this.insightsService.trackException(error);
              reject(error);
              return;
            }
            
            const parsed = JSON.parse(res);
            resolve(parsed.url);
          } catch (parseError) {
            console.error('Error parsing getToken response:', parseError);
            this.insightsService.trackException(parseError);
            reject(parseError);
          }
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          reject(err);
        });
    });
  }  

  async getClient(){
    return this.client;
  }

  async connect(token: string): Promise<WebPubSubClient> {
    return new Promise(async (resolve, reject) => {
      try {
        this.client = new WebPubSubClient({
          getClientAccessUrl: token
        }, {autoReconnect: false, reconnectRetryOptions: {maxRetries: 5, retryDelayInMs: 5000}});
        await this.client.start();
        this.listenMessage();
        resolve(this.client);
      } catch (error) {
        console.error("An error occurred while connecting:", error);
        reject(error); // rechazar la promesa con el error
      }

    });
  }


  checkConnectionStatus() {
    return this.isConnected;
  }
  
  listenMessage() {
   // Evitar registrar listeners múltiples veces
   if (this.isListening) {
    return;
  }
  this.isListening = true;

  this.client.on("group-message", (e) => {
    this.isConnected = true;
    this.messageSubject.next(e.message);
  });

  this.client.on("connected", (e) => {
    console.log(`Connection ${e.connectionId} is connected.`);
    this.isConnected = true;
    this.connectionStatus$.next(true);
    this.eventsService.broadcast('webpubsubevent', true);
    this.reconnectAttempts = 0;
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  });

  this.client.on("stopped", () => {
    console.log(`Client has stopped`);
    // NO llamar a disconnect() aquí porque cancela la reconexión
    // Solo actualizar el estado, la reconexión se maneja en "disconnected"
    this.isConnected = false;
    this.isListening = false;
    this.connectionStatus$.next(false);
    this.eventsService.broadcast('webpubsubevent', false);
  });

  this.client.on("disconnected", async (e) => {
    console.log(`Connection disconnected:`, e);
    this.isConnected = false;
    this.isListening = false;
    this.connectionStatus$.next(false);
    this.eventsService.broadcast('webpubsubevent', false);
    // Iniciar reconexión automática
    this.handleDisconnection();
  });
  }

  getMessageObservable(): Observable<any> {
    return this.messageSubject.asObservable();
  }

  disconnect(clearUserId: boolean = false) {
    this.isConnected = false; 
    this.isListening = false;
    
    // Limpiar el intervalo de reconexión si existe
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    this.reconnectAttempts = 0;
    
    // Solo limpiar el userId si se solicita explícitamente (logout)
    if (clearUserId) {
      this.currentUserId = '';
    }
    
    if(this.client){
      this.client.off("group-message", (e) => { });
      this.client.off("connected", (e) => { });
      this.client.off("stopped", (e) => { });
      this.client.off("disconnected", (e) => { });
      //this.messageSubject.unsubscribe();
      this.client.stop();
      this.client = null;
    }
    
  }

  get connectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  async initializeConnection(userId: string): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }

    try {
      const token = await this.getToken(userId);
      await this.connect(token);
      return true;
    } catch (error) {
      this.insightsService.trackException(error);
      return false;
    }
  }

  private startConnectionMonitoring() {
    this.client.on("connected", (e) => {
      this.connectionStatus$.next(true);
      this.eventsService.broadcast('webpubsubevent', true);
      this.reconnectAttempts = 0;
    });

    this.client.on("disconnected", async () => {
      this.connectionStatus$.next(false);
      this.eventsService.broadcast('webpubsubevent', false);
      this.handleDisconnection();
    });
  }

  private async handleDisconnection() {
    // Si ya hay un intervalo de reconexión activo, no crear otro
    if (this.reconnectInterval) {
      console.log('Reconnection already in progress');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached, stopping reconnection');
      return;
    }

    // Verificar que tenemos un userId válido para reconectar
    if (!this.currentUserId) {
      console.warn('No userId available for reconnection');
      return;
    }

    console.log('Starting reconnection process...');
    
    // Limpiar el cliente anterior si existe
    if (this.client) {
      try {
        this.client.off("group-message", () => {});
        this.client.off("connected", () => {});
        this.client.off("stopped", () => {});
        this.client.off("disconnected", () => {});
      } catch (e) {
        // Ignorar errores al remover listeners
      }
      this.client = null;
    }

    this.reconnectInterval = setInterval(async () => {
      if (this.isConnected) {
        console.log('Stopping reconnection interval - connected');
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
        return;
      }
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('Max reconnection attempts reached');
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
        // Notificar que la reconexión falló - mostrar mensaje al usuario
        this.eventsService.broadcast('webpubsub-reconnect-failed', true);
        return;
      }

      this.reconnectAttempts++;
      
      try {
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        const token = await this.getToken(this.currentUserId);
        await this.connect(token);
        console.log('Reconnection successful!');
      } catch (error: any) {
        console.log("Reconnection attempt failed:", error?.message || error);
        
        // Si la sesión ha expirado (recibimos HTML), detener los intentos
        if (error?.message?.includes('Session expired') || error?.message?.includes('received HTML')) {
          console.warn('Session appears to be expired, stopping reconnection attempts');
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
          this.reconnectAttempts = this.maxReconnectAttempts;
          // Notificar que la sesión expiró
          this.eventsService.broadcast('webpubsub-session-expired', true);
        } else {
          this.insightsService.trackException(error);
        }
      }
    }, 5000);
  }

  /**
   * Reintentar la conexión manualmente (llamado desde UI)
   */
  async retryConnection(): Promise<boolean> {
    console.log('Manual reconnection requested');
    
    // Resetear el contador de intentos
    this.reconnectAttempts = 0;
    
    // Limpiar intervalo si existe
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Limpiar cliente si existe
    if (this.client) {
      try {
        this.client.off("group-message", () => {});
        this.client.off("connected", () => {});
        this.client.off("stopped", () => {});
        this.client.off("disconnected", () => {});
      } catch (e) {
        // Ignorar errores
      }
      this.client = null;
    }
    this.isListening = false;
    
    if (!this.currentUserId) {
      console.warn('No userId available for manual reconnection');
      return false;
    }
    
    try {
      const token = await this.getToken(this.currentUserId);
      await this.connect(token);
      console.log('Manual reconnection successful!');
      return true;
    } catch (error) {
      console.error('Manual reconnection failed:', error);
      this.insightsService.trackException(error);
      return false;
    }
  }
}
