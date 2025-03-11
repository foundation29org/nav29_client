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
    if(localStorage.getItem('token') && this.authService.getIdUser()!=undefined){
      if((this.authService.getToken() == localStorage.getItem('token'))&& this.authService.getIdUser()!=undefined){
        const tokenPayload = decode(localStorage.getItem('token'));
        if(tokenPayload.sub ==this.authService.getIdUser()){
          return true;
        }else{
          return false;
        }
      }else{
        return false;
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
