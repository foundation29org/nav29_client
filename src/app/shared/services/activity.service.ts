import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from 'app/shared/auth/auth.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getRecentActivity(): Observable<any> {
    const currentPatient = this.authService.getCurrentPatient();
    if (!currentPatient) {
      return new Observable(observer => observer.next([]));
    }//add the userId to the url
    const userId = this.authService.getIdUser();
    return this.http.get(`${environment.api}/api/patient/${currentPatient.sub}/recent-activity/${userId}`);
  }

  getRecentAppointments(): Observable<any> {
    const currentPatient = this.authService.getCurrentPatient();
    if (!currentPatient) {
      return new Observable(observer => observer.next([]));
    }//add the userId to the url
    const userId = this.authService.getIdUser();
    return this.http.get(`${environment.api}/api/patient/${currentPatient.sub}/recent-appointments/${userId}`);
  }


} 