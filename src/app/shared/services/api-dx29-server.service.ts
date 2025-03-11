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

}
