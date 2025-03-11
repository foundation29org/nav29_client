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

  constructor(private http: HttpClient, public insightsService: InsightsService, private eventsService: EventsService) { }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  async getToken(IdUser): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if(this.client){
        this.client.stop();
        this.client = null;
      }
      const url = environment.api + '/api/gettoken/' + IdUser;
      const cacheBuster = Date.now().toString();
      this.http.get(url, {params: {_cb: cacheBuster}})
        .subscribe((res: any) => {
          resolve(res.url);
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

  /*async connect(token: string): Promise<WebPubSubClient> {
    this.client = new WebPubSubClient({
      getClientAccessUrl: token
    });

    await this.client.start();
    this.listenMessage();


    return this.client;
  }*/

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
    this.disconnect();
    this.connectionStatus$.next(false);
    this.eventsService.broadcast('webpubsubevent', false);
  });

  this.client.on("disconnected", async (e) => {
    console.log(`Connection ${e} is disconnected.`);
    this.isConnected = false;
    this.connectionStatus$.next(false);
    this.eventsService.broadcast('webpubsubevent', false);
    this.handleDisconnection();
  });
  }

  getMessageObservable(): Observable<any> {
    return this.messageSubject.asObservable();
  }

  disconnect() {
    this.isConnected = false; 
    this.isListening = false; 
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
      //this.startConnectionMonitoring();
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    if (!this.reconnectInterval) {
      this.reconnectInterval = setInterval(async () => {
        if (this.isConnected || this.reconnectAttempts >= this.maxReconnectAttempts) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
          return;
        }

        try {
          const userId = this.getStoredUserId();
          if (userId) {
            const token = await this.getToken(userId);
            await this.connect(token);
          }
        } catch (error) {
          console.log("Reconnection attempt failed:", error);
          this.reconnectAttempts++;
          this.insightsService.trackException(error);
        }
      }, 5000);
    }
  }

  private getStoredUserId(): string {
    // Get the user ID from wherever you store it (localStorage, service, etc.)
    const token = localStorage.getItem('token');
    if (token) {
      const tokenPayload = decode(token);
      return tokenPayload.sub;
    }
    return null;
  }

}
