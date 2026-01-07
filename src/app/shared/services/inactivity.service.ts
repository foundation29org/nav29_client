import { Injectable, NgZone, OnDestroy, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription, fromEvent, merge } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { EventsService } from './events.service';

@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
  
  // Configuración de tiempos (en milisegundos)
  private readonly WARNING_TIME = 12 * 60 * 1000; // 12 minutos
  private readonly LOGOUT_TIME = 15 * 60 * 1000;  // 15 minutos
  
  private activitySubscription: Subscription;
  private isWarningShown = false;
  private isActive = false;
  private lastActivityTime: number = 0; // Timestamp de última actividad
  private ignoreActivityUntil: number = 0; // Timestamp hasta el cual ignorar actividad (después de keepSessionAlive)
  private checkInterval: any = null; // Interval para verificar inactividad periódicamente
  private logoutExecuted = false; // Bandera para evitar ejecutar logout múltiples veces
  private checkCount: number = 0; // Contador de verificaciones periódicas
  
  // Eventos que emite el servicio
  public onInactivityWarning = new Subject<void>();
  public onInactivityLogout = new Subject<void>();
  
  // Usar Injector para evitar dependencia circular con AuthService
  private _authService: any;
  
  constructor(
    private ngZone: NgZone,
    private router: Router,
    private eventsService: EventsService,
    private injector: Injector
  ) {}
  
  private get authService() {
    if (!this._authService) {
      // Lazy load para evitar dependencia circular
      const { AuthService } = require('../auth/auth.service');
      this._authService = this.injector.get(AuthService);
    }
    return this._authService;
  }
  
  /**
   * Inicia el monitoreo de inactividad
   * Llamar después del login
   */
  startMonitoring(): void {
    console.log(`>>> startMonitoring called, isActive: ${this.isActive}, isWarningShown: ${this.isWarningShown}`);
    
    // Si ya está activo, primero detenerlo completamente para resetear todo
    if (this.isActive) {
      console.log('>>> startMonitoring: already active, stopping first to reset state');
      this.stopMonitoring();
    }
    
    this.isActive = true;
    this.isWarningShown = false; // Resetear estado del warning
    this.ignoreActivityUntil = 0; // Resetear bandera
    this.logoutExecuted = false; // Resetear bandera de logout ejecutado
    console.log('Inactivity monitoring started');
    
    // Eventos de actividad del usuario - solo eventos significativos (no mousemove que se dispara constantemente)
    const significantActivityEvents = merge(
      fromEvent(document, 'click'),
      fromEvent(document, 'keypress'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'touchstart')
    ).pipe(
      throttleTime(1000) // Evitar procesar demasiados eventos
    );
    
    // Eventos de movimiento (menos significativos) - solo actualizar si no hay actividad reciente
    const movementEvents = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'scroll'),
      fromEvent(document, 'touchmove')
    ).pipe(
      throttleTime(30000) // Solo actualizar cada 30 segundos para eventos de movimiento
    );
    
    // Ejecutar fuera de Angular zone para no afectar el rendimiento
    this.ngZone.runOutsideAngular(() => {
      // Suscripción para eventos significativos
      const significantSub = significantActivityEvents.subscribe(() => {
        this.updateLastActivityTime('significant');
      });
      
      // Suscripción para eventos de movimiento (menos frecuente)
      const movementSub = movementEvents.subscribe(() => {
        // Solo actualizar si no ha habido actividad significativa en los últimos 20 segundos
        const timeSinceLastActivity = Date.now() - this.lastActivityTime;
        if (timeSinceLastActivity > 20000) {
          this.updateLastActivityTime('movement');
        }
      });
      
      // Combinar ambas suscripciones
      this.activitySubscription = new Subscription();
      this.activitySubscription.add(significantSub);
      this.activitySubscription.add(movementSub);
    });
    
    // Iniciar timestamp y verificación periódica
    this.lastActivityTime = Date.now();
    console.log(`>>> Setting lastActivityTime to ${new Date(this.lastActivityTime).toISOString()}`);
    this.startPeriodicCheck();
    console.log('>>> startMonitoring completed');
  }
  
  /**
   * Detiene el monitoreo de inactividad
   * Llamar al hacer logout
   */
  stopMonitoring(): void {
    this.isActive = false;
    this.isWarningShown = false;
    this.ignoreActivityUntil = 0; // Resetear bandera
    this.logoutExecuted = false; // Resetear bandera de logout ejecutado
    this.checkCount = 0; // Resetear contador
    
    if (this.activitySubscription) {
      this.activitySubscription.unsubscribe();
      this.activitySubscription = null;
    }
    
    this.stopPeriodicCheck();
    console.log('Inactivity monitoring stopped');
  }
  
  /**
   * Actualiza el timestamp de última actividad
   */
  private updateLastActivityTime(type: 'significant' | 'movement'): void {
    const now = Date.now();
    
    // Ignorar actividad si estamos en el período de ignorar (después de keepSessionAlive)
    if (now < this.ignoreActivityUntil) {
      return;
    }
    // Ignorar si el warning está visible (el usuario debe hacer click en el botón)
    if (this.isWarningShown) {
      return;
    }
    // Actualizar timestamp de última actividad
    this.lastActivityTime = now;
  }
  
  /**
   * Inicia la verificación periódica de inactividad
   */
  private startPeriodicCheck(): void {
    // Limpiar interval anterior si existe
    this.stopPeriodicCheck();
    
    console.log('>>> startPeriodicCheck called');
    
    // Verificar cada 10 segundos si ha pasado el tiempo de inactividad
    this.checkInterval = setInterval(() => {
      this.checkCount++;
      this.ngZone.run(() => {
        const isAuth = this.authService.isAuthenticated();
        if (!this.isActive || !isAuth) {
          console.log(`>>> Periodic check #${this.checkCount} skipped: isActive=${this.isActive}, isAuthenticated=${isAuth}`);
          return;
        }
        
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivityTime;
        const warningMinutes = this.WARNING_TIME / 60000;
        const logoutMinutes = this.LOGOUT_TIME / 60000;
        
        // Log solo cada minuto para no saturar la consola
        if (this.checkCount % 6 === 0 || timeSinceLastActivity >= this.WARNING_TIME - 10000) {
          console.log(`>>> Periodic check #${this.checkCount}: ${(timeSinceLastActivity / 60000).toFixed(1)} min since last activity, isWarningShown=${this.isWarningShown}, isActive=${this.isActive}`);
        }
        
        // Si ha pasado el tiempo de logout y el warning está visible, hacer logout
        // Esto debe verificarse PRIMERO porque es más crítico
        // Solo ejecutar una vez para evitar múltiples ejecuciones
        if (timeSinceLastActivity >= this.LOGOUT_TIME && this.isWarningShown && !this.logoutExecuted) {
          console.log(`Inactivity logout - ${logoutMinutes} minutes of inactivity (timeSinceLastActivity=${(timeSinceLastActivity / 60000).toFixed(1)} min)`);
          this.logoutExecuted = true; // Marcar como ejecutado para evitar múltiples ejecuciones
          this.isWarningShown = false; // Resetear para el próximo ciclo
          // Detener el monitoreo inmediatamente antes de emitir el evento
          this.stopMonitoring();
          this.onInactivityLogout.next();
          this.eventsService.broadcast('inactivity-logout', true);
          return; // No verificar warning si ya se hace logout
        }
        
        // Si ha pasado el tiempo de warning y no se ha mostrado, mostrarlo
        // Solo verificar si el warning NO está visible
        if (timeSinceLastActivity >= this.WARNING_TIME && !this.isWarningShown) {
          console.log(`Inactivity warning - ${warningMinutes} minutes of inactivity (timeSinceLastActivity=${(timeSinceLastActivity / 60000).toFixed(1)} min)`);
          this.isWarningShown = true;
          console.log('>>> Broadcasting inactivity-warning event');
          // Emitir en el ngZone para asegurar que Angular detecte el cambio
          this.ngZone.run(() => {
            this.onInactivityWarning.next();
            this.eventsService.broadcast('inactivity-warning', true);
            console.log('>>> inactivity-warning event broadcasted');
          });
        }
      });
    }, 10000); // Verificar cada 10 segundos para mayor precisión
  }
  
  /**
   * Detiene la verificación periódica
   */
  private stopPeriodicCheck(): void {
    if (this.checkInterval) {
      console.log('>>> stopPeriodicCheck: clearing interval');
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  /**
   * El usuario hace click en "Seguir conectado" en el modal de warning
   */
  keepSessionAlive(): void {
    console.log('>>> keepSessionAlive called');
    
    // Resetear estado
    this.isWarningShown = false;
    this.logoutExecuted = false; // Resetear para permitir nuevo ciclo
    
    // Actualizar timestamp de última actividad (el click cuenta como actividad)
    this.lastActivityTime = Date.now();
    
    // Ignorar eventos de actividad por 2000ms para evitar que el click del botón se cuente como actividad adicional
    this.ignoreActivityUntil = Date.now() + 2000;
    console.log(`>>> Session kept alive, timers reset`);
  }
  
  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}

