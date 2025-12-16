import { Router } from '@angular/router';
import { Injectable, OnInit, OnDestroy } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from "@angular/common/http";
import { Observable, of, BehaviorSubject, Subscription, Subject } from 'rxjs';
import { catchError, switchMap, map } from 'rxjs/operators';
import * as decode from 'jwt-decode';
import { ICurrentPatient } from './ICurrentPatient.interface';
import { AuthServiceFirebase } from "app/shared/services/auth.service.firebase";
import { WebPubSubClient } from "@azure/web-pubsub-client";
import { WebPubSubService } from 'app/shared/services/web-pub-sub.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';

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

  private isCheckingSession: boolean = false; // Bandera para evitar múltiples llamadas simultáneas
  private sessionChecked: boolean = false; // Bandera para saber si ya se verificó la sesión
  private isRefreshingToken: boolean = false; // Bandera para evitar múltiples refreshes simultáneos
  private refreshTokenPromise: Promise<boolean> | null = null; // Promise compartida para las peticiones que esperan
  
  // Método público para verificar si hay un refresh en curso
  get isRefreshingTokenStatus(): boolean {
    return this.isRefreshingToken;
  }
  
  // Método público para obtener la Promise del refresh en curso (si existe)
  getRefreshTokenPromise(): Promise<boolean> | null {
    return this.refreshTokenPromise;
  }
  
  // Método público para que el guard pueda verificar si se está verificando la sesión
  isCheckingSessionStatus(): boolean {
    return this.isCheckingSession;
  }
  
  // Método público para verificar si ya se verificó la sesión
  isSessionChecked(): boolean {
    return this.sessionChecked;
  }

  getEnvironment():boolean{
    // Establecer lang desde localStorage inmediatamente para evitar undefined
    // Esto asegura que siempre haya un idioma disponible, incluso durante la verificación
    const storedLang = localStorage.getItem('lang');
    if (storedLang && !this.lang) {
      this.setLang(storedLang);
    } else if (!storedLang && !this.lang) {
      // Si no hay lang en localStorage ni en memoria, establecer por defecto
      this.setLang('en');
    }
    
    // Si ya hay una sesión válida en memoria, retornar true inmediatamente
    if (this.isloggedIn && this.getIdUser()) {
      return true;
    }
    
    // Primero verificar si hay token legacy en localStorage (migración)
    if(localStorage.getItem('token')){
      // Migración: usar token legacy temporalmente
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
      
      // Cargar pacientes después de autenticación exitosa (token legacy)
      //this.loadPatients();
      
      if(tokenPayload.role=='Clinical'){
        //this.setRedirectUrl('/patients')
        this.setRedirectUrl('/home')
      }else{
        this.setRedirectUrl('/home')
      }
      return true;
    }
    
    // Si no hay token legacy ni sesión en memoria, intentar obtener sesión desde cookies
    // Evitar múltiples llamadas simultáneas
    if (!this.isCheckingSession && !this.sessionChecked) {
      this.isCheckingSession = true;
      this.http.get(environment.api+'/api/session', { withCredentials: true })
        .subscribe(
          (res: any) => {
            this.isCheckingSession = false;
            this.sessionChecked = true;
            // Sesión válida desde cookies
            this.setLang(res.lang);
            if(res.lang=='es'){
              localStorage.setItem('culture', 'es-ES');
            }else{
              localStorage.setItem('culture', 'en-EN');
            }
            
            // Guardar datos en memoria (no en localStorage para tokens)
            this.setIdUser(res.userId);
            this.setRole(res.role);
            this.setSubRole(res.role); // Mantener compatibilidad
            this.isloggedIn = true;
            
            // Iniciar conexión WebPubSub si estamos autenticados
            this.webPubSubService.initializeConnection(this.getIdUser())
              .catch(err => {
                console.error('Failed to initialize WebPubSub:', err);
                this.insightsService.trackException(err);
              });
            
            // Cargar pacientes después de autenticación exitosa
            //this.loadPatients();
            
            if(res.role=='Clinical'){
              //this.setRedirectUrl('/patients')
              this.setRedirectUrl('/home')
            }else{
              this.setRedirectUrl('/home')
            }
          },
          (err) => {
            this.isCheckingSession = false;
            this.sessionChecked = true; // Marcar como verificado aunque haya fallado
            // No hay sesión válida - esto es normal antes del login, no hacer nada
            // Solo loguear si es un error inesperado (no 401/403)
            if(err.status !== 401 && err.status !== 403){
              console.error('Error checking session:', err);
              this.insightsService.trackException(err);
            }
          }
        );
      // NO retornar true mientras se verifica - esto causa redirecciones prematuras en login
      // Retornar false y dejar que la verificación asíncrona establezca isloggedIn cuando termine
      return false;
    }
    
    // Si ya se verificó la sesión y no hay sesión válida, retornar false
    return false;
  }

  setEnvironment(token:string):void{
    // Mantener token solo en memoria (no localStorage para seguridad)
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
    
    // NO guardar token en localStorage - las cookies lo manejan ahora
    // localStorage.setItem('token', token) // REMOVIDO POR SEGURIDAD
  }

  login(formValue: any): Observable<boolean> {
    //your code for signing up the new user
    return this.http.post(environment.api+'/api/login', formValue, { withCredentials: true })
    .pipe(
      switchMap((res: any) => {
          if(res.message == "You have successfully logged in"){
            //entrar en la app
            this.setLang(res.lang);
            localStorage.setItem('lang', res.lang)

            // Mantener compatibilidad: guardar token en memoria (no localStorage)
            if(res.token){
              this.token = res.token;
              const tokenPayload = decode(res.token);
              this.setExpToken(tokenPayload.exp);
            }

            // Las cookies se establecen automáticamente por el servidor
            // Obtener información de sesión desde el servidor y esperar a que termine
            return this.http.get(environment.api+'/api/session', { withCredentials: true })
              .pipe(
                map((sessionRes: any) => {
                  this.setIdUser(sessionRes.userId);
                  this.setRole(sessionRes.role);
                  this.setSubRole(sessionRes.role);
                  this.isloggedIn = true;
                  
                  // Iniciar conexión WebPubSub (no esperar, hacerlo en background)
                  this.webPubSubService.initializeConnection(this.getIdUser())
                    .catch(err => {
                      console.error('Failed to initialize WebPubSub:', err);
                      this.insightsService.trackException(err);
                    });
                  
                  // Cargar pacientes después de login exitoso
                  //this.loadPatients();
                  
                  // Establecer redirección basada en el rol
                  if(sessionRes.role=='Clinical'){
                    //this.setRedirectUrl('/patients')
                    this.setRedirectUrl('/home')
                  }else{
                    this.setRedirectUrl('/home')
                  }
                  
                  this.setMessage(res.message);
                  return true;
                }),
                catchError((err) => {
                  console.error('Failed to get session:', err);
                  this.insightsService.trackException(err);
                  this.isloggedIn = false;
                  this.setMessage("Sign in failed");
                  return of(false);
                })
              );
          }else{
            this.isloggedIn = false;
            this.setMessage(res.message);
            return of(false);
          }
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          //this.isLoginFailed = true;
          this.setMessage("Sign in failed");
          this.isloggedIn = false;
          return of(false); // retornar false en caso de error
        })
      );
  }

  async logout() {
    this.router.navigate(['/.']);
    this.lang = localStorage.getItem('lang');
    
    // Llamar al endpoint de logout para limpiar cookies en el servidor
    try {
      await this.http.post(environment.api+'/api/logout', {}, { withCredentials: true }).toPromise();
    } catch (err) {
      console.error('Error during logout:', err);
      this.insightsService.trackException(err);
    }
    
    // Limpiar localStorage (excepto lang)
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
    // Resetear flags de verificación de sesión
    this.sessionChecked = false;
    this.isCheckingSession = false;   
    //reload page
    //window.location.reload();
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

  private isLoadingPatients: boolean = false; // Evitar múltiples llamadas simultáneas

  loadPatients(){
    // Evitar múltiples llamadas simultáneas - pero permitir reintentos después de un tiempo
    if (this.isLoadingPatients) {
      console.log('loadPatients already in progress, skipping');
      return;
    }
    
    const userId = this.getIdUser();
    if (!userId) {
      console.log('loadPatients: No userId available');
      return; // No cargar si no hay userId
    }
    
    this.isLoadingPatients = true;
    this.http.get(environment.api+'/api/patients-all/'+userId, { withCredentials: true })
    .subscribe((res: any) => {
      this.isLoadingPatients = false;
      if(res.listpatients && res.listpatients.length>0){
        this.setPatientList(res.listpatients);
        if(this.getCurrentPatient()== null){
          this.setCurrentPatient(res.listpatients[0]);
        }
      }else{
        this.setPatientList([]);
      }
    }, (err) => {
      this.isLoadingPatients = false;
      console.error('Error loading patients:', err);
      this.insightsService.trackException(err);
    });
  }

  getToken() {
    return this.token;
  }

  isAuthenticated() {
    // Solo retornar true si realmente está autenticado (tiene sesión válida)
    // NO retornar true solo por estar verificando, para evitar redirecciones prematuras en login
    return this.isloggedIn && this.getIdUser() != null;
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
    if (lang) {
      this.lang = lang;
      localStorage.setItem('lang', this.lang);
    }
  }
  getLang(): string {
    // Siempre retornar un valor válido para evitar undefined.json
    if (this.lang) {
      return this.lang;
    }
    // Si no hay lang en memoria, intentar obtenerlo de localStorage
    const storedLang = localStorage.getItem('lang');
    if (storedLang) {
      this.lang = storedLang;
      return this.lang;
    }
    // Si no hay nada, retornar 'en' por defecto
    this.lang = 'en';
    localStorage.setItem('lang', this.lang);
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

  // Método para refrescar el access token usando refresh token
  async refreshAccessToken(): Promise<boolean> {
    // Si ya hay un refresh en curso, retornar la misma Promise
    if (this.isRefreshingToken && this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }
    
    this.isRefreshingToken = true;
    
    // Crear la Promise compartida
    this.refreshTokenPromise = this._doRefreshToken();
    
    try {
      const result = await this.refreshTokenPromise;
      return result;
    } finally {
      // Limpiar la Promise cuando termine
      this.refreshTokenPromise = null;
    }
  }
  
  // Método privado que realiza el refresh real
  private async _doRefreshToken(): Promise<boolean> {
    try {
      const response: any = await this.http.post(environment.api+'/api/refresh', {}, { withCredentials: true }).toPromise();
      
      if (response && response.token) {
        // Actualizar token en memoria
        this.token = response.token;
        const tokenPayload = decode(response.token);
        this.setExpToken(tokenPayload.exp);
        
        // Obtener información completa de la sesión para actualizar el estado
        try {
          const sessionRes: any = await this.http.get(environment.api+'/api/session', { withCredentials: true }).toPromise();
          if (sessionRes) {
            this.setIdUser(sessionRes.userId);
            this.setRole(sessionRes.role);
            this.setSubRole(sessionRes.role);
            this.isloggedIn = true;
            // Actualizar lang usando setLang para también guardar en localStorage
            if (sessionRes.lang) {
              this.setLang(sessionRes.lang);
            }
            // Establecer redirección basada en el rol
            if(sessionRes.role=='Clinical'){
              //this.setRedirectUrl('/patients')
              this.setRedirectUrl('/home')
            }else{
              this.setRedirectUrl('/home')
            }
          }
        } catch (sessionErr) {
          // Si falla obtener la sesión, aún consideramos el refresh exitoso
          // porque las cookies están actualizadas
          console.warn('Could not get session after refresh:', sessionErr);
        }
        
        this.isRefreshingToken = false;
        return true;
      }
      this.isRefreshingToken = false;
      return false;
    } catch (err) {
      console.error('Failed to refresh token:', err);
      this.insightsService.trackException(err);
      // Si falla el refresh, marcar como no autenticado
      this.isloggedIn = false;
      this.isRefreshingToken = false;
      return false;
    }
  }
}
