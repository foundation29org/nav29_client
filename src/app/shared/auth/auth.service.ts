import { Router } from '@angular/router';
import { Injectable, OnInit, OnDestroy } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from "@angular/common/http";
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators'
import * as decode from 'jwt-decode';
import { ICurrentPatient } from './ICurrentPatient.interface';
import { AuthServiceFirebase } from "app/shared/services/auth.service.firebase";
import { WebPubSubClient } from "@azure/web-pubsub-client";
import { WebPubSubService } from 'app/shared/services/web-pub-sub.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { Subscription, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnInit, OnDestroy {
  private token: string;
  private loginUrl: string = '/.';
  private redirectUrl: string = '/home';
  private isloggedIn: boolean = false;
  private message: string;
  private iduser: string;
  private role: string;
  private subrole: string;
  private lang: string;
  private expToken: number = null;
  private currentPatientSubject = new BehaviorSubject<ICurrentPatient>(null);
  currentPatient$ = this.currentPatientSubject.asObservable();
  private patientList: Array<ICurrentPatient> = null;
  private isApp: boolean = document.URL.indexOf( 'http://' ) === -1 && document.URL.indexOf( 'https://' ) === -1 && location.hostname != "localhost" && location.hostname != "127.0.0.1";
  private client: WebPubSubClient;
  private subscription: Subscription = new Subscription();
  patientListSubject: Subject<Array<ICurrentPatient>> = new Subject<Array<ICurrentPatient>>();

  constructor(private http: HttpClient, public authServiceFirebase: AuthServiceFirebase, public webPubSubService: WebPubSubService, public router: Router, public insightsService: InsightsService) {}


  ngOnInit() {
  }


  async ngOnDestroy() {
    /*if (this.subscription) {
      this.subscription.unsubscribe();
    }*/
  }

  getEnvironment():boolean{
    if(localStorage.getItem('token')){
      this.setLang(localStorage.getItem('lang'));
      if(localStorage.getItem('lang')=='es'){
        localStorage.setItem('culture', 'es-ES');
      }else{
        localStorage.setItem('culture', 'en-EN');
      }
      this.setAuthenticated(localStorage.getItem('token'));
      const tokenPayload = decode(localStorage.getItem('token'));
      this.setIdUser(tokenPayload.sub);
      this.setExpToken(tokenPayload.exp);
      this.setRole(tokenPayload.role);
      this.setSubRole(tokenPayload.subrole);
      // Iniciar conexión WebPubSub si estamos autenticados
      this.webPubSubService.initializeConnection(this.getIdUser())
        .catch(err => {
          console.error('Failed to initialize WebPubSub:', err);
          this.insightsService.trackException(err);
        });
      if(tokenPayload.role=='Clinical'){
        //this.setRedirectUrl('/patients')
        this.setRedirectUrl('/home')
      }else{
        this.setRedirectUrl('/home')
      }
      
      return true;
    }else{
      return false;
    }
  }

  setEnvironment(token:string):void{
    this.setAuthenticated(token);
    // decode the token to get its payload
    const tokenPayload = decode(token);
    this.setIdUser(tokenPayload.sub);
    this.setExpToken(tokenPayload.exp);
    this.setRole(tokenPayload.role);
    this.setSubRole(tokenPayload.subrole);
    if(tokenPayload.role=='Clinical'){
      //this.setRedirectUrl('/patients')
      this.setRedirectUrl('/home')
    }else{
      this.setRedirectUrl('/home')
    }
    
    //save localStorage
    localStorage.setItem('token', token)
  }

  login(formValue: any): Observable<boolean> {
    //your code for signing up the new user
    return this.http.post(environment.api+'/api/login',formValue)
    .pipe(
      tap(async (res: any) => {
          if(res.message == "You have successfully logged in"){
            //entrar en la app
            this.setLang(res.lang);
            localStorage.setItem('lang', res.lang)

            this.setEnvironment(res.token);
            try {
              await this.webPubSubService.initializeConnection(this.getIdUser());
            } catch (err) {
              console.error('Failed to initialize WebPubSub:', err);
              this.insightsService.trackException(err);
              // No fallamos el login si falla WebPubSub, solo logueamos el error
            }
          }else{
            this.isloggedIn = false;
          }
          this.setMessage(res.message);
          return this.isloggedIn;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          //this.isLoginFailed = true;
          this.setMessage("Sign in failed");
          this.isloggedIn = false;
          return of(this.isloggedIn); // aquí devuelves un observable que emite this.isloggedIn en caso de error
        })
      );
  }

  async logout() {
    this.router.navigate(['/.']);
    this.lang = localStorage.getItem('lang');
      localStorage.clear();
      localStorage.setItem('lang', this.lang);
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      await this.webPubSubService.disconnect();
      this.authServiceFirebase.SignOut()
      await this.delay(500);
      this.token = null;
      this.role = null;
      this.subrole = null;
      this.expToken = null;
      this.isloggedIn = false;
      this.message = null;
      //this.currentPatient = null;
      // Restablecer el paciente actual en AuthService
      this.setCurrentPatient(null);
      this.patientList = null;
      this.iduser = null;   
      //reload page
      window.location.reload();
  }

  async logout2() {
    this.lang = localStorage.getItem('lang');
      localStorage.clear();
      localStorage.setItem('lang', this.lang);
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      await this.webPubSubService.disconnect();
      this.authServiceFirebase.SignOut()
      await this.delay(500);
      this.token = null;
      this.role = null;
      this.subrole = null;
      this.expToken = null;
      this.isloggedIn = false;
      this.message = null;
      //this.currentPatient = null;
      // Restablecer el paciente actual en AuthService
      this.setCurrentPatient(null);
      this.patientList = null;
      this.iduser = null;
  }

  loadPatients(){
    this.http.get(environment.api+'/api/patients-all/'+this.getIdUser())
    .subscribe((res: any) => {
      if(res.listpatients.length>0){
        this.setPatientList(res.listpatients);
        if(this.getCurrentPatient()== null){
          this.setCurrentPatient(res.listpatients[0]);
        }
      }else{
        this.setPatientList([]);
      }
    });
  }

  getToken() {
    return this.token;
  }

  isAuthenticated() {
    // here you can check if user is authenticated or not through his token
    return this.isloggedIn;
  }
  //este metodo sobraría si se usa el metodo signinUser
  setAuthenticated(token) {
    // here you can check if user is authenticated or not through his token
    this.isloggedIn=true;
    this.token=token;
  }
  getLoginUrl(): string {
		return this.loginUrl;
	}
  getRedirectUrl(): string {
		return this.redirectUrl;
	}
	setRedirectUrl(url: string): void {
		this.redirectUrl = url;
	}
  setMessage(message: string): void {
		this.message = message;
	}
  getMessage(): string {
		return this.message;
	}
  setRole(role: string): void {
    this.role = role;
  }
  getRole(): string {
    return this.role;
  }
  setSubRole(subrole: string): void {
    this.subrole = subrole;
  }
  getSubRole(): string {
    return this.subrole;
  }
  setExpToken(expToken: number): void {
    this.expToken = expToken;
  }
  getExpToken(): number {
    return this.expToken;
  }
  setIdUser(iduser: string): void {
    this.iduser = iduser;
  }
  getIdUser(): string {
    return this.iduser;
  }
  setCurrentPatient(currentPatient: ICurrentPatient): void {
    this.currentPatientSubject.next(currentPatient);
  }
  getCurrentPatient(): ICurrentPatient {
    return this.currentPatientSubject.value;
  }

  setPatientList(patientList: Array<ICurrentPatient>): void {
    this.patientList = patientList;
    this.patientListSubject.next(patientList);
  }
  getPatientList(): Array<ICurrentPatient> {
    if(this.patientList){
      this.patientList.sort((a, b) => a.patientName.localeCompare(b.patientName));
      return this.patientList;
    }else{
      return [];
    }
    
  }
  setLang(lang: string): void {
    this.lang = lang;
    localStorage.setItem('lang', this.lang);
  }
  getLang(): string {
    return this.lang;
  }

  getIsApp(): boolean {
    return this.isApp;
  }

   async initWebPubSub() {
    return new Promise(async (resolve, reject) => {
  //if (this.webPubSubService.getClient() && this.webPubSubService.checkConnectionStatus()) {
    if (this.webPubSubService.checkConnectionStatus()) {
      // The client is already connected, no need to reconnect
      if(!this.isloggedIn){
        this.webPubSubService.disconnect();
      }
      resolve (true);
    }else{
      console.log(this.webPubSubService.checkConnectionStatus())
    }
    // The client is not connected, proceed to connect
      try {
        let token = await this.webPubSubService.getToken(this.getIdUser());
        await this.webPubSubService.connect(token);
        resolve (true);
      } catch (err) {
        this.insightsService.trackException(err);
        console.log('Failed to initialize WebPubSub:', err);
        resolve (false);
      }
    });
      
    
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getWebPubSubClient() {
    return this.client;
  }
}
