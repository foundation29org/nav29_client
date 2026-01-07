import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { WebPubSubClient } from "@azure/web-pubsub-client";
import { HttpClient } from "@angular/common/http";
import { environment } from 'environments/environment';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { EventsService } from 'app/shared/services/events.service';

@Injectable({ providedIn: 'root' })
export class WebPubSubService {
  private messageSubject = new Subject<any>();
  isConnected: boolean = false;
  client: WebPubSubClient;

  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private isListening: boolean = false;
  private currentUserId: string = '';

  constructor(private http: HttpClient, public insightsService: InsightsService, private eventsService: EventsService) { }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getToken(IdUser): Promise<string> {
    return new Promise(async (resolve, reject) => {
      // Guardar el userId
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
      this.http.get(url, {params: {_cb: cacheBuster}, withCredentials: true, responseType: 'text'})
        .subscribe((res: string) => {
          try {
            // Verificar si la respuesta parece HTML (sesión expirada/redirección)
            if (res.trim().startsWith('<!DOCTYPE') || res.trim().startsWith('<html')) {
              const error = new Error('Session expired or invalid response - received HTML instead of token');
              console.warn('getToken received HTML response - possible session expiration');
              reject(error);
              return;
            }
            
            const parsed = JSON.parse(res);
            resolve(parsed.url);
          } catch (parseError) {
            console.error('Error parsing getToken response:', parseError);
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
        }, {autoReconnect: true, reconnectRetryOptions: {maxRetries: 3, retryDelayInMs: 3000}});
        await this.client.start();
        this.listenMessage();
        resolve(this.client);
      } catch (error) {
        console.error("An error occurred while connecting:", error);
        reject(error);
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
    });

    this.client.on("stopped", () => {
      console.log(`Client has stopped`);
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
    });
  }

  getMessageObservable(): Observable<any> {
    return this.messageSubject.asObservable();
  }

  disconnect(clearUserId: boolean = true) {
    this.isConnected = false; 
    this.isListening = false;
    
    if (clearUserId) {
      this.currentUserId = '';
    }
    
    if(this.client){
      this.client.off("group-message", (e) => { });
      this.client.off("connected", (e) => { });
      this.client.off("stopped", (e) => { });
      this.client.off("disconnected", (e) => { });
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
}
