import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpHeaders} from '@angular/common/http';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { environment } from 'environments/environment';

import { EventsService } from 'app/shared/services/events.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private inj: Injector, public insightsService: InsightsService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    var eventsService = this.inj.get(EventsService);

    let authService = this.inj.get(AuthService); //authservice is an angular service
        // Get the auth header from the service.
    /*if(authService.getToken()==undefined){
      const authReq = req.clone({ headers: req.headers});
      return next.handle(authReq)
    }*/
    if(authService.getToken()==undefined && req.url.indexOf(environment.api)!==-1){
      const authReq = req.clone({ headers: req.headers
        .set('x-api-key', environment.Server_Key)
      });
      return next.handle(authReq)
    }else if(authService.getToken()==undefined && req.url.indexOf(environment.api)==-1){
      const authReq = req.clone({ headers: req.headers});
      return next.handle(authReq)
    }
    // Clone the request to add the new header.
    var token =  authService.getToken();
    var type = 'Bearer'

    // Clone the request to add the new header.

    var isExternalReq = false;
    var authReq = req.clone({});
    /*if(req.url.indexOf(environment.api)!==-1){
      authReq = req.clone({ headers: req.headers.set('authorization',  `${type} ${token}`) });
      let tokenService = this.inj.get(TokenService);
      if(!tokenService.isTokenValid()){
        authService.logout();
      }
    }*/
    if(req.url.indexOf(environment.api)!==-1){
      let urlWithTimestamp = req.url;
      const timestamp = Date.now();
      if (req.url.includes('?')) {
        urlWithTimestamp += `&t=${timestamp}`;
      } else {
        urlWithTimestamp += `?t=${timestamp}`;
      }
      authReq = req.clone({
        url: urlWithTimestamp,
        headers: req.headers
        .set('authorization',  `${type} ${token}`)
        .set('x-api-key', environment.Server_Key)
      });
      let tokenService = this.inj.get(TokenService);
      if(!tokenService.isTokenValid()){
        authService.logout();
      }
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
      this.insightsService.trackException(error);
      if (error.status === 401 || error.status === 403) {
        authService.logout();
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
