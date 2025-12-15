import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpHeaders} from '@angular/common/http';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { environment } from 'environments/environment';

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
      
      if (error.status === 401 || error.status === 403) {
        // Intentar refrescar token si es 401 y no es logout/session/refresh
        if (!isLogoutRequest && !isSessionCheck && !isRefreshRequest && error.status === 401) {
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
                // Si no se pudo refrescar, hacer logout y redirigir
                authService.logout();
                return throwError(error);
              }
            }),
            catchError((refreshError) => {
              // Si falla el refresh, hacer logout
              authService.logout();
              return throwError(error);
            })
          );
        } else if (!isLogoutRequest && !isSessionCheck && !isRefreshRequest) {
          // Para 403 u otros errores, hacer logout directamente
          authService.logout();
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
