import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from 'environments/environment';
import { catchError, map} from 'rxjs/operators'
import { InsightsService } from 'app/shared/services/azureInsights.service';

@Injectable({
  providedIn: 'root'
})
export class ApiDx29ServerService {
    constructor(private http: HttpClient, public insightsService: InsightsService) {}

    getDetectLanguage(text) {
      var jsonText = [{ "text": text }];
      return this.http.post(environment.api + '/api/getDetectLanguage', jsonText).pipe(
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

    getTranslationDictionary(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/translation', body).pipe(
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

    getTranslationInvert(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/translationinvert', body).pipe(
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

    getDeepLTranslationInvert(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/deepltranslationinvert', body).pipe(
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

    getDeepLTranslationtimeline(lang, info) {
      var body = { lang: lang, info: info }
      return this.http.post(environment.api + '/api/translationtimeline', body).pipe(
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

    getTranslationSegmentsInvert(lang,segments){
      var body = {lang:lang, segments: segments}
        return this.http.post(environment.api+'/api/translation/segments', body).pipe(
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

    getAzureBlobSasToken(containerName){
      return this.http.get(environment.api+'/api/getAzureBlobSasTokenWithContainer/'+containerName).pipe(
        map((res: any) => {
          return res.containerSAS;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    vote(info) {
      return this.http.post(environment.api + '/api/vote', info).pipe(
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

    getInfoLocation(){
      //return this.http.get('https://ipinfo.io?token=768aaa8d5105a1').pipe(
        return this.http.get('https://ipgeolocation.abstractapi.com/v1/?api_key=1b3786b25a2344c786403750aa83281b').pipe(
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

    getRarescopeAnalysis(patientId: string) {
      return this.http.post(environment.api + '/api/ai/rarescope/' + patientId, {}).pipe(
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

    getDifferentialDiagnosis(patientId: string, lang: string = 'en', useSummary?: boolean) {
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
      
      return this.http.post(environment.api + '/api/ai/dxgpt/' + patientId, body).pipe(
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
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

}
