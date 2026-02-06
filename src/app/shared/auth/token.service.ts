import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from "@angular/common/http";
import { Observable } from 'rxjs';
import * as decode from 'jwt-decode';
import { AuthService } from './auth.service';
import { catchError, map } from 'rxjs/operators'
import { InsightsService } from 'app/shared/services/azureInsights.service';

@Injectable()
export class TokenService {
  constructor(private http: HttpClient, public authService: AuthService, public insightsService: InsightsService) {}


  isTokenValid():boolean{
    // Validar token en memoria (ya no usamos localStorage para tokens)
    const token = this.authService.getToken();
    if(token && this.authService.getIdUser()!=undefined){
      try {
        const tokenPayload = decode(token);
        // Verificar que el token no haya expirado
        const currentTime = Math.floor(Date.now() / 1000);
        if(tokenPayload.exp && tokenPayload.exp < currentTime){
          return false; // Token expirado
        }
        if(tokenPayload.sub == this.authService.getIdUser()){
          return true;
        }else{
          return false;
        }
      } catch (err) {
        return false; // Token inválido
      }
    }else{
      return false;
    }
  }

  //deprecated
  testToken(): Observable<boolean>{
    return this.http.get(environment.api+'/api/testToken').pipe(
      map((res: any) => {
        return res;
      }),
      catchError((err) => {
        console.log(err);
        this.insightsService.trackException(err);
        return err;
      })
    );
  }

}
