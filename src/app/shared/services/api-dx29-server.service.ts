import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from 'environments/environment';
import { catchError, map } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { InsightsService } from 'app/shared/services/azureInsights.service';

@Injectable({
  providedIn: 'root'
})
export class ApiDx29ServerService {
    constructor(private http: HttpClient, public insightsService: InsightsService) {}

    /**
     * Manejo centralizado de errores HTTP.
     *  - Traza el error en consola y en App Insights.
     *  - Devuelve un Observable de error para que RxJS continúe el flujo correctamente.
     */
    private handleError = (err: any) => {
      console.error('[ApiDx29ServerService] HTTP error:', err);
      this.insightsService.trackException(err);
      return throwError(() => err);
    };

    getDetectLanguage(text) {
      var jsonText = [{ "text": text }];
      return this.http.post(environment.api + '/api/getDetectLanguage', jsonText).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getTranslationDictionary(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/translation', body).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getTranslationInvert(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/translationinvert', body).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getDeepLTranslationInvert(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/deepltranslationinvert', body).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getDeepLTranslationtimeline(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/translationtimeline', body).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getTranslationSegmentsInvert(lang,segments){
      var body = {lang:lang, segments: segments}
        return this.http.post(environment.api+'/api/translation/segments', body).pipe(
          map((res: any) => {
            return res;
          }),
          catchError(this.handleError)
        );
      }

    getAzureBlobSasToken(containerName){
      return this.http.get(environment.api+'/api/getAzureBlobSasTokenWithContainer/'+containerName).pipe(
        map((res: any) => {
          return res.containerSAS;
        }),
        catchError(this.handleError)
      );
    }

    vote(info) {
      return this.http.post(environment.api + '/api/vote', info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getInfoLocation(){
      //return this.http.get('https://ipinfo.io?token=768aaa8d5105a1').pipe(
        return this.http.get('https://ipgeolocation.abstractapi.com/v1/?api_key=1b3786b25a2344c786403750aa83281b').pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getRarescopeAnalysis(patientId: string) {
      return this.http.post(environment.api + '/api/ai/rarescope/' + patientId, {}).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getDifferentialDiagnosis(patientId: string, lang: string = 'en', useSummary?: boolean, excludeDiseases?: string[]) {
      const body: any = { lang: lang };
      if (useSummary) {
        body.useSummary = useSummary;
      }
      
      // Check if there's a custom medical description to use
      const customDescription = sessionStorage.getItem('customMedicalDescription');
      if (customDescription) {
        body.customMedicalDescription = customDescription;
        // Clear it after use
        sessionStorage.removeItem('customMedicalDescription');
      }
      
      // Add diseases_list if provided
      if (excludeDiseases && excludeDiseases.length > 0) {
        body.diseases_list = excludeDiseases.join(',');
      }
      
      return this.http.post(environment.api + '/api/ai/dxgpt/' + patientId, body).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

    getDiseaseInfo(patientId: string, questionType: number, disease: string, lang: string = 'en', medicalDescription?: string) {
      const body: any = {
        questionType: questionType,
        disease: disease,
        lang: lang
      };
      if (medicalDescription && (questionType === 3 || questionType === 4)) {
        body.medicalDescription = medicalDescription;
      }
      return this.http.post(environment.api + '/api/ai/disease-info/' + patientId, body).pipe(
        map((res: any) => {
          return res;
        }),
        catchError(this.handleError)
      );
    }

}
