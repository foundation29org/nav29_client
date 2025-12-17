import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpHeaders} from '@angular/common/http';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { environment } from 'environments/environment';
import { Router } from '@angular/router';

import { EventsService } from 'app/shared/services/events.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private inj: Injector, public insightsService: InsightsService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    var eventsService = this.inj.get(EventsService);

    let authService = this.inj.get(AuthService); //authservice is an angular service
    
    var isExternalReq = false;
    var authReq = req.clone({});
    
    // Para requests a nuestra API, usar cookies (withCredentials) y mantener header como fallback
    if(req.url.indexOf(environment.api)!==-1){
      let urlWithTimestamp = req.url;
      const timestamp = Date.now();
      if (req.url.includes('?')) {
        urlWithTimestamp += `&t=${timestamp}`;
      } else {
        urlWithTimestamp += `?t=${timestamp}`;
      }
      
      // Solo usar cookies HttpOnly - más seguro (no enviar token en headers)
      // Las cookies se envían automáticamente con withCredentials: true
      var headers = req.headers.set('x-api-key', environment.Server_Key);
      
      authReq = req.clone({
        url: urlWithTimestamp,
        headers: headers,
        withCredentials: true // CRÍTICO: Permite enviar cookies HttpOnly automáticamente
      });

      // Con cookies HttpOnly, la validación de tokens se hace en el servidor
      // NO validar tokens en memoria aquí porque pueden expirar mientras las cookies siguen válidas
      // El servidor rechazará automáticamente si las cookies son inválidas
    } else if(authService.getToken()==undefined && req.url.indexOf(environment.api)!==-1){
      // Request externo sin token
      authReq = req.clone({ headers: req.headers});
    } else if(authService.getToken()==undefined && req.url.indexOf(environment.api)!==-1){
      // Request externo
      authReq = req.clone({ headers: req.headers});
    }

    if (req.url.indexOf('api.veriff.me/v1/sessions') !== -1) {
      isExternalReq = true;
      const headers = new HttpHeaders({
        'x-auth-client': environment.tokenVeriff
      });
      authReq = req.clone({ headers });
    }

    if (req.url.indexOf('/person') !== -1) {
      isExternalReq = true;
      authReq = req.clone();
    }

    if (req.url.indexOf('https://alchemy.veriff.com/api/v2/sessions') !== -1) {
      isExternalReq = true;
    }
    if (req.url.indexOf('api.veriff.me') !== -1) {
      isExternalReq = true;
    }

    if (req.url.indexOf(environment.blobAccountUrl) !== -1) {
      isExternalReq = true;
    }

    // Pass on the cloned request instead of the original request.
    return next.handle(authReq)
  .pipe(
    catchError((error) => {
      // Excluir /api/logout, /api/session y /api/refresh del manejo de errores para evitar bucles infinitos
      const isLogoutRequest = req.url.indexOf('/api/logout') !== -1;
      const isSessionCheck = req.url.indexOf('/api/session') !== -1;
      const isRefreshRequest = req.url.indexOf('/api/refresh') !== -1;
      
      if (!isLogoutRequest && !isSessionCheck && !isRefreshRequest) {
        this.insightsService.trackException(error);
      }
      
      // No hacer retry en errores CORS (status 0) - estos son errores de red, no de autenticación
      if (error.status === 0 || error.status === null) {
        console.warn('auth.interceptor: Error CORS/red detectado, no intentando refresh. URL:', req.url);
        return throwError(error);
      }
      
      if (error.status === 401 || error.status === 403) {
        // Solo intentar refrescar si el usuario está autenticado (tiene sesión en memoria)
        // Si no está autenticado, no intentar refrescar porque no hay refresh token válido
        const isAuthenticated = authService.isAuthenticated();
        
        // Intentar refrescar token si es 401/403 y el usuario está autenticado
        // Permitir refresh para /api/session también (necesario al recargar después de 30 min)
        // pero excluir logout y refresh para evitar bucles
        if (!isLogoutRequest && !isRefreshRequest && isAuthenticated) {
          // Si ya hay un refresh en curso, esperar a que termine antes de reintentar
          const refreshPromise = authService.getRefreshTokenPromise();
          if (refreshPromise) {
            // Esperar a que termine el refresh en curso y luego reintentar
            return from(refreshPromise).pipe(
              switchMap((refreshed) => {
                if (refreshed) {
                  // Reintentar la petición original con un nuevo timestamp
                  let urlWithTimestamp = req.url;
                  const timestamp = Date.now();
                  if (req.url.includes('?')) {
                    urlWithTimestamp += `&t=${timestamp}`;
                  } else {
                    urlWithTimestamp += `?t=${timestamp}`;
                  }
                  
                  const retryReq = req.clone({
                    url: urlWithTimestamp,
                    headers: req.headers.set('x-api-key', environment.Server_Key),
                    withCredentials: true
                  });
                  
                  return next.handle(retryReq);
                } else {
                  // Si el refresh falló, hacer logout
                  authService.logout();
                  return throwError(error);
                }
              })
            );
          }
          
          // Intentar refrescar el access token usando refresh token
          return from(authService.refreshAccessToken()).pipe(
            switchMap(refreshed => {
              if (refreshed) {
                // Si se refrescó exitosamente, reintentar la petición original
                // Clonar la request original con un nuevo timestamp para evitar caché
                let urlWithTimestamp = req.url;
                const timestamp = Date.now();
                if (req.url.includes('?')) {
                  urlWithTimestamp += `&t=${timestamp}`;
                } else {
                  urlWithTimestamp += `?t=${timestamp}`;
                }
                
                const retryReq = req.clone({
                  url: urlWithTimestamp,
                  headers: req.headers.set('x-api-key', environment.Server_Key),
                  withCredentials: true
                });
                
                return next.handle(retryReq);
              } else {
                // Si no se pudo refrescar, verificar el tipo de error antes de hacer logout
                // Solo hacer logout si es un error de autenticación real (401/403)
                // NO hacer logout en errores de red o errores temporales del servidor
                const isAuthError = error.status === 401 || error.status === 403;
                
                if (isAuthError && !authService.isRefreshingTokenStatus) {
                  authService.logout();
                }
                
                return throwError(error);
              }
            }),
            catchError((refreshError: any) => {
              // Solo hacer logout si es un error de autenticación real (401/403)
              // NO hacer logout en errores de red (status 0) o errores temporales del servidor (500, 503)
              const isAuthError = refreshError.status === 401 || refreshError.status === 403;
              const isNetworkError = refreshError.status === 0 || refreshError.status === null;
              const isServerError = refreshError.status >= 500 && refreshError.status < 600;
              
              // Si es un error de autenticación real, el refresh token ha expirado o es inválido
              if (isAuthError && !authService.isRefreshingTokenStatus) {
                authService.logout();
              }
              
              // Si es un error de red o del servidor, NO hacer logout
              // El refresh token puede seguir siendo válido, solo fue un error temporal
              if (isNetworkError || isServerError) {
                console.warn('Refresh token failed due to network/server error. Token may still be valid. Status:', refreshError.status);
                // Retornar el error original, no el error de refresh
                return throwError(error);
              }
              
              // Para otros errores, retornar el error original
              return throwError(error);
            })
          );
        }
        return throwError(error);
      }

      if (error.status === 404 || error.status === 0) {
        if (!isExternalReq) {
          var returnMessage = error.message;
          if (error.error.message) {
            returnMessage = error.error;
          }
          eventsService.broadcast('http-error', returnMessage);
        } else {
          eventsService.broadcast('http-error-external', 'no external conexion');
        }
        return throwError(error);
      }

      if (error.status === 419) {
        return throwError(error);
      }

      //return all others errors
      return throwError(error);
    })
  ) as any;
  }
}
