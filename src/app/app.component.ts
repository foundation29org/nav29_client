import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router, NavigationEnd, ActivatedRoute} from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { filter, map, mergeMap } from 'rxjs/operators';

import { Title, Meta } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from 'app/shared/services/lang.service';
import Swal from 'sweetalert2';
import { EventsService } from 'app/shared/services/events.service';
import { AuthService } from 'app/shared/auth/auth.service';
import { TrackEventsService } from 'app/shared/services/track-events.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { InactivityService } from 'app/shared/services/inactivity.service';

declare var device;
declare global {
    interface Navigator {
      app: {
          exitApp: () => any;
      },
      splashscreen:any
    }
}


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {

    private subscription: Subscription = new Subscription();
    actualPage: string = '';
    hasLocalLang: boolean = false;
    tituloEvent: string = '';
    isMobile: boolean = false;
    private isSwalOpen: boolean = false;
    public inactivityWarningVisible: boolean = false;
    public inactivityWarningTimeRemaining: number = 180; // 3 minutos en segundos
    private audioContext: AudioContext = null;
    private audioUnlocked: boolean = false;

    constructor(public toastr: ToastrService, private router: Router, private activatedRoute: ActivatedRoute, private titleService: Title, public translate: TranslateService, private langService: LangService, private eventsService: EventsService, private meta: Meta, private authService: AuthService, public trackEventsService: TrackEventsService, public insightsService: InsightsService, private inactivityService: InactivityService) {
      this.trackEventsService.lauchEvent('App loaded');
      if (localStorage.getItem('lang')) {
          this.translate.use(localStorage.getItem('lang'));
          this.hasLocalLang = true;
        } else {
          const browserLang: string = translate.getBrowserLang();
          this.translate.use(browserLang.match(/en|es|pt|de|fr|it/) ? browserLang : "en");
          localStorage.setItem('lang', this.translate.store.currentLang);
          this.hasLocalLang = false;
        }
    
        this.loadLanguages();
        this.loadCultures();

        this.isMobile = false;
        var touchDevice: number = navigator.maxTouchPoints || ('ontouchstart' in document.documentElement ? 1 : 0);
        if (touchDevice > 1 && /Android/i.test(navigator.userAgent)) {
          this.isMobile = true;
        } else if (touchDevice > 1 && /iPhone/i.test(navigator.userAgent)) {
          this.isMobile = true;
        }
        if (this.isMobile){
          document.addEventListener("deviceready", this.onDeviceReady.bind(this), false);
          }
    }

    loadLanguages() {
        this.langService.getLangs()
          .subscribe((res: any) => {
            if (!this.hasLocalLang) {
              const browserLang: string = this.translate.getBrowserLang();
              for (let lang of res) {
                if (browserLang.match(lang.code)) {
                  this.translate.use(lang.code);
                  localStorage.setItem('lang', lang.code);
                  this.eventsService.broadcast('changelang', lang.code);
                }
              }
            }
          }, (err) => {
            console.log(err);
            this.insightsService.trackException(err);
          })
      }
    
      loadCultures() {
        if(localStorage.getItem('lang')=='es'){
          localStorage.setItem('culture', 'es-ES');
        }else if(localStorage.getItem('lang')=='de'){
          localStorage.setItem('culture', 'de-DE');
        }else if(localStorage.getItem('lang')=='fr'){
          localStorage.setItem('culture', 'fr-FR');
        }else if(localStorage.getItem('lang')=='it'){
          localStorage.setItem('culture', 'it-IT');
        }else if(localStorage.getItem('lang')=='pt'){
          localStorage.setItem('culture', 'pt-PT');
        }else{
          localStorage.setItem('culture', 'en-EN');
        }
      }

    ngOnInit() {
        this.meta.addTags([
            { name: 'keywords', content: this.translate.instant("seo.home.keywords") },
            { name: 'description', content: this.translate.instant("seo.home.description") },
            { name: 'title', content: this.translate.instant("seo.home.title") },
            { name: 'robots', content: 'index, follow' }
          ]);
        
        // Inicializar AudioContext al primer click del usuario (requerido por navegadores modernos)
        this.initAudioContext();

        //evento que escucha si ha habido un error de conexión
    this.eventsService.on('http-error', function (error) {
        var msg1 = 'Connection lost';
        var msg2 = 'Trying to connect ...';
  
        if (localStorage.getItem('lang')) {
          var actuallang = localStorage.getItem('lang');
          if (actuallang == 'es') {
            msg1 = 'Se ha perdido la conexión';
            msg2 = 'Intentando conectar ...';
          } else if (actuallang == 'pt') {
            msg1 = 'Conexão perdida';
            msg2 = 'Tentando se conectar ...';
          } else if (actuallang == 'de') {
            msg1 = 'Verbindung unterbrochen';
            msg2 = 'Versucht zu verbinden ...';
          } else if (actuallang == 'fr') {
            msg1 = 'Connexion perdue';
            msg2 = 'Essayant de se connecter ...';
          }else if (actuallang == 'it') {
            msg1 = 'Collegamento perso';
            msg2 = 'Tentativo di connessione ...';
          }
        }
        if (this.isSwalOpen) {
          return;
        }
        if (error.message) {
          if (error == 'The user does not exist') {
            this.isSwalOpen = true;
            Swal.fire({
              icon: 'warning',
              title: this.translate.instant("errors.The user does not exist"),
              html: this.translate.instant("errors.The session has been closed")
            }).then(() => {
              this.isSwalOpen = false;
            });
          }
        } else {
          this.isSwalOpen = true;
          Swal.fire({
            title: msg1,
            text: msg2,
            icon: 'warning',
            showCancelButton: false,
            confirmButtonColor: '#2F8BE6',
            confirmButtonText: 'OK',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            reverseButtons: true
          }).then((result) => {
            this.isSwalOpen = false;
            if (result.value) {
              //location.reload();
            }
          });
        }
      }.bind(this));

      this.subscription = this.router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.activatedRoute),
        map((route) => {
          while (route.firstChild) route = route.firstChild;
          return route;
        }),
        filter((route) => route.outlet === 'primary'),
        mergeMap((route) => route.data)
      ).subscribe((event) => {
        (async () => {
          await this.delay(500);
          this.tituloEvent = event['title'];
          var titulo = this.translate.instant(this.tituloEvent);
          this.titleService.setTitle(titulo);
        })();
      
        if (this.actualPage != event['title']) {
          window.scrollTo(0, 0)
        }
        this.actualPage = event['title'];
      });
        
        this.eventsService.on('changelang', function (lang) {
            (async () => {
              if(this.tituloEvent){
                await this.delay(500);
                var titulo = this.translate.instant(this.tituloEvent);
                this.titleService.setTitle(titulo);
              }
                localStorage.setItem('lang', lang);
                this.changeMeta();
                this.loadCultures();
            })();
        }.bind(this));

        // Evento de aviso de inactividad (12 minutos)
        // Usar directamente el Subject del servicio en lugar del EventsService para mayor confiabilidad
        console.log('>>> Setting up inactivity-warning event listener');
        this.subscription.add(
          this.inactivityService.onInactivityWarning.subscribe(() => {
            console.log('>>> Received inactivity-warning event in app.component (via Subject)');
            this.showInactivityWarning();
          })
        );
        // También escuchar el EventsService por si acaso
        this.eventsService.on('inactivity-warning', () => {
          console.log('>>> Received inactivity-warning event in app.component (via EventsService)');
          this.showInactivityWarning();
        });
        console.log('>>> inactivity-warning event listener set up');

        // Evento de logout por inactividad (15 minutos)
        this.subscription.add(
          this.inactivityService.onInactivityLogout.subscribe(() => {
            console.log('>>> Received inactivity-logout event (via Subject)');
            this.handleInactivityLogout();
          })
        );
        this.eventsService.on('inactivity-logout', () => {
          console.log('>>> Received inactivity-logout event (via EventsService)');
          this.handleInactivityLogout();
        });

        // Iniciar monitoreo de inactividad si el usuario ya está autenticado al cargar la app
        if (this.authService.isAuthenticated()) {
          // Resetear estado del modal al iniciar monitoreo (por si quedó abierto de antes)
          this.inactivityWarningVisible = false;
          this.inactivityService.startMonitoring();
        }

        // Escuchar cambios de navegación para iniciar/detener monitoreo
        this.subscription.add(
          this.router.events.pipe(
            filter((event) => event instanceof NavigationEnd)
          ).subscribe(() => {
            const isAuthenticated = this.authService.isAuthenticated();
            
            console.log(`>>> NavigationEnd: url=${this.router.url}, isAuthenticated=${isAuthenticated}`);
            
            // Si el usuario está autenticado, iniciar monitoreo
            // Si no está autenticado, detener monitoreo
            // No necesitamos verificar rutas porque isAuthenticated() ya maneja todo el estado
            if (isAuthenticated) {
              // Resetear estado del modal al iniciar monitoreo (por si quedó abierto de antes)
              this.inactivityWarningVisible = false;
              this.inactivityService.startMonitoring();
            } else {
              // Cerrar cualquier modal abierto y detener monitoreo
              this.inactivityWarningVisible = false;
              this.inactivityService.stopMonitoring();
            }
          })
        );
        
        // Reconfigurar listeners después de cada navegación para asegurar que estén activos
        // (por si se destruyeron en algún momento)
        this.subscription.add(
          this.router.events.pipe(
            filter((event) => event instanceof NavigationEnd)
          ).subscribe(() => {
            if (this.authService.isAuthenticated()) {
              // Reconfigurar listener si no existe (por si se perdió)
              // El listener debería persistir, pero por si acaso lo reconfiguramos
              console.log('>>> Ensuring inactivity-warning listener is active');
            }
          })
        );
    }

    delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.eventsService.destroy();
    }

    changeMeta() {
        this.meta.updateTag({ name: 'keywords', content: this.translate.instant("seo.home.keywords") });
        this.meta.updateTag({ name: 'description', content: this.translate.instant("seo.home.description") });
        this.meta.updateTag({ name: 'title', content: this.translate.instant("seo.home.title") });
      }

      onDeviceReady() {
        console.log('Device is ready');
        setTimeout(function() {
             navigator.splashscreen.hide();
         }, 2000);
         console.log(device.platform);
        if(device.platform == 'android' || device.platform == 'Android'){
          document.addEventListener("backbutton", this.onBackKeyDown.bind(this), false);
        }else if(device.platform == 'iOS'){
 
        }

        document.addEventListener("pause", onPause, false);
        document.addEventListener("resume", onResume, false);
 
        function onPause(){
          //navigator.splashscreen.show();
        }
 
        function onResume(){
          setTimeout(function() {
             //navigator.splashscreen.hide();
         }, 2000);
        }
      }

      onBackKeyDown(){
        if(this.actualPage.indexOf('menu.Dashboard')!=-1){
          Swal.fire({
              title: this.translate.instant("generics.Are you sure?"),
              text:  this.translate.instant("generics.Exit the application without logging off"),
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#0CC27E',
              cancelButtonColor: '#FF586B',
              confirmButtonText: this.translate.instant("generics.Yes"),
              cancelButtonText: this.translate.instant("generics.No, cancel"),
              showLoaderOnConfirm: true,
              allowOutsideClick: false,
              allowEscapeKey: false,
          }).then((result) => {
            if (result.value) {
              navigator.app.exitApp();
            }
          });
        }else{
          if(this.authService.isAuthenticated()){
            window.history.back();
          }
        }
      }

      /**
       * Muestra el modal de aviso de inactividad (a los 12 minutos)
       */
      private showInactivityWarning(): void {
        console.log('>>> showInactivityWarning called, inactivityWarningVisible:', this.inactivityWarningVisible);
        
        // Verificar si ya hay un modal abierto
        if (this.inactivityWarningVisible) {
          console.log('>>> showInactivityWarning aborted - modal already open');
          return;
        }
        
        // Verificar autenticación
        if (!this.authService.isAuthenticated()) {
          console.log('>>> showInactivityWarning aborted - not authenticated');
          return;
        }

        // Reproducir sonido de alerta sutil
        this.playAlertSound();

        // Mostrar el componente
        this.inactivityWarningTimeRemaining = 180; // 3 minutos en segundos
        this.inactivityWarningVisible = true;
        console.log('>>> Opening inactivity warning modal');
      }

      /**
       * Maneja el evento cuando el usuario hace click en "Seguir conectado"
       */
      onInactivityKeepAlive(): void {
        console.log('>>> User clicked keep alive - calling keepSessionAlive');
        this.inactivityWarningVisible = false;
        this.inactivityService.keepSessionAlive();
      }

      /**
       * Maneja el evento cuando el timer del modal expira
       */
      onInactivityWarningClosed(): void {
        console.log('>>> Inactivity warning timer expired');
        this.inactivityWarningVisible = false;
        // El logout se manejará por el servicio cuando llegue a 15 minutos
      }

      /**
       * Inicializa el AudioContext al primer click del usuario
       * Esto es necesario porque los navegadores modernos bloquean el audio automático
       */
      private initAudioContext(): void {
        const unlockAudio = () => {
          if (this.audioUnlocked) return;
          
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              this.audioContext = new AudioContextClass();
              
              // Crear un sonido silencioso para "desbloquear" el audio
              const buffer = this.audioContext.createBuffer(1, 1, 22050);
              const source = this.audioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(this.audioContext.destination);
              source.start(0);
              
              this.audioUnlocked = true;
              console.log('>>> AudioContext unlocked');
              
              // Remover los listeners
              document.removeEventListener('click', unlockAudio);
              document.removeEventListener('keydown', unlockAudio);
              document.removeEventListener('touchstart', unlockAudio);
            }
          } catch (e) {
            console.log('>>> Error initializing AudioContext:', e);
          }
        };
        
        // Agregar listeners para desbloquear el audio
        document.addEventListener('click', unlockAudio);
        document.addEventListener('keydown', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
      }

      /**
       * Reproduce un sonido de alerta usando Web Audio API
       * Doble beep tipo "notificación médica"
       */
      private playAlertSound(): void {
        console.log('>>> Playing alert sound');
        try {
          // Si no hay AudioContext, intentar crear uno
          if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
              console.log('>>> Web Audio API not supported');
              return;
            }
            this.audioContext = new AudioContextClass();
          }
          
          // Si el AudioContext está suspendido, intentar resumirlo
          if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
          }
          
          // Función helper para crear un beep
          const playBeep = (startTime: number, frequency: number, duration: number, volume: number) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            // Volumen con fade out
            gainNode.gain.setValueAtTime(volume, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
          };
          
          // Doble beep: bip-bip
          const now = this.audioContext.currentTime;
          playBeep(now, 880, 0.15, 0.5);        // Primer beep (La5, 880Hz)
          playBeep(now + 0.25, 880, 0.15, 0.5); // Segundo beep
          
          console.log('>>> Alert sound played successfully');
        } catch (e) {
          console.log('>>> Audio error:', e);
        }
      }

      /**
       * Maneja el logout por inactividad (a los 15 minutos)
       */
      private handleInactivityLogout(): void {
        // Cerrar el modal de warning si está abierto
        this.inactivityWarningVisible = false;

        // El servicio ya se detuvo automáticamente, pero por si acaso
        this.inactivityService.stopMonitoring();

        // Mostrar mensaje y hacer logout directamente (sin Swal)
        // Hacer logout inmediatamente
        this.authService.logout();
        
        // Mostrar mensaje después de un pequeño delay para que el logout se procese
        setTimeout(() => {
          Swal.fire({
            title: this.translate.instant("inactivity.logout_title") || 'Sesión cerrada',
            text: this.translate.instant("inactivity.logout_message") || 'Tu sesión ha sido cerrada por inactividad para proteger los datos del paciente.',
            icon: 'info',
            confirmButtonColor: '#2F8BE6',
            confirmButtonText: this.translate.instant("login.Sign in") || 'Iniciar sesión',
            allowOutsideClick: false,
            allowEscapeKey: false,
          });
        }, 100);
      }

}
