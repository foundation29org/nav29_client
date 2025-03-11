import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { InsightsService } from 'app/shared/services/azureInsights.service';

@Injectable({
  providedIn: 'root'
})
export class GoCertiusService {
  private tokenKey = 'access_token_gocertius';
  private tokenExpirationKey = 'access_token_gocertius_expiration';

  constructor(private http: HttpClient, private insightsService: InsightsService) {}

  private getStoredToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private getStoredTokenExpiration(): number {
    const expiration = localStorage.getItem(this.tokenExpirationKey);
    return expiration ? parseInt(expiration, 10) : 0;
  }

  private setStoredToken(token: string, expiresIn: number): void {
    localStorage.setItem(this.tokenKey, token);
    const expirationTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(this.tokenExpirationKey, expirationTime.toString());
  }

  private isTokenValid(): boolean {
    const expiration = this.getStoredTokenExpiration();
    return expiration > Date.now() + 5 * 60 * 1000; // 5 minutes buffer
  }

  private getNewToken(): Observable<string> {
    return this.http.get<any>(environment.api + '/api/gocertius/gettoken').pipe(
      map(res => {
        this.setStoredToken(res.access_token, res.expires_in);
        return res.access_token;
      }),
      catchError(err => {
        console.error('Error obtaining token:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  private getValidToken(): Observable<string> {
    if (this.isTokenValid()) {
      return new Observable(observer => {
        observer.next(this.getStoredToken());
        observer.complete();
      });
    } else {
      return this.getNewToken();
    }
  }

  createCaseFile(caseFileData: any): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.post(environment.api + '/api/gocertius/createcasefile', caseFileData, { headers });
      }),
      catchError(err => {
        console.error('Error creating case file:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  getCaseFile(caseFileId: string): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.get(environment.api + '/api/gocertius/getcasefile/' + caseFileId, { headers });
      }),
      catchError(err => {
        console.error('Error getting case file:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  updateCaseFile(caseFileId: string, caseFileData: any): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.post(environment.api + '/api/gocertius/updatecasefile/' + caseFileId, caseFileData, { headers });
      }),
      catchError(err => {
        console.error('Error updating case file:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  createEvidenceGroup(caseFileId, evidenceGroupData: any): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.post(environment.api + '/api/gocertius/createevidencegroup/'+caseFileId, evidenceGroupData, { headers });
      }),
      catchError(err => {
        console.error('Error creating evidence group:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  createEvidence(caseFileId,evidenceGroupId, evidenceData: any): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.post(environment.api + `/api/gocertius/createevidence/${caseFileId}/${evidenceGroupId}`, evidenceData, { headers });
      }),
      catchError(err => {
        console.error('Error creating evidence:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  getEvidenceUploadUrl(caseFileId: string, evidenceGroupId: string, evidenceId: string): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.get(environment.api + `/api/gocertius/getevidenceuploadurl/${caseFileId}/${evidenceGroupId}/${evidenceId}`, { headers });
      }),
      catchError(err => {
        console.error('Error getting evidence upload URL:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  uploadFile(uploadUrl: string, expiration: string, fileBlob: Blob, base64Hash: string, evidenceId: string): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders()
          .set('X-Gocertius-Token', token)
          .set('x-amz-checksum-sha256', base64Hash);
        return this.http.put(uploadUrl, fileBlob, { headers });
      }),
      catchError(err => {
        console.error('Error uploading file:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  
  getEvidenceList(): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.get(environment.api + `/api/gocertius/getevidencelist`, { headers });
      }),
      catchError(err => {
        console.error('Error getting evidence list:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  getEvidenceGroupList(): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.get(environment.api + `/api/gocertius/getevidencegrouplist`, { headers });
      }),
      catchError(err => {
        console.error('Error getting evidence group list:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  getEvidenceGroup(caseFileId: string, evidenceGroupId: string): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.get(environment.api + `/api/gocertius/getevidencegroup/${caseFileId}/${evidenceGroupId}`, { headers });
      }),
      catchError(err => {
        console.error('Error getting evidence group:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })  
    );
  }

  closeEvidenceGroup(caseFileId: string, evidenceGroupId: string, data: any): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.post(environment.api + `/api/gocertius/closeevidencegroup/${caseFileId}/${evidenceGroupId}`, data, { headers });
      }),
      catchError(err => {
        console.error('Error closing evidence group:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  generateReport(caseFileId: string, info: any): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.post(environment.api + `/api/gocertius/generatereport/${caseFileId}`, info, { headers });
      }),
      catchError(err => {
        console.error('Error generating report:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  getReportPdfUrl(reportId: string): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.get(environment.api + `/api/gocertius/getreportpdfurl/${reportId}`, { headers });
      }),
      catchError(err => {
        console.error('Error getting report PDF URL:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

  getReportZip(reportId: string): Observable<any> {
    return this.getValidToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders().set('X-Gocertius-Token', token);
        return this.http.get(environment.api + `/api/gocertius/getreportzip/${reportId}`, { headers });
      }),
      catchError(err => {
        console.error('Error getting report ZIP:', err);
        this.insightsService.trackException(err);
        return throwError(() => err);
      })
    );
  }

}