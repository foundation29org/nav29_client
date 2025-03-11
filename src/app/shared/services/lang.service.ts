import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from "@angular/common/http";
import { environment } from 'environments/environment';
import { SortService} from 'app/shared/services/sort.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { catchError, map } from 'rxjs/operators'
@Injectable({
  providedIn: 'root'
})
export class LangService {

    langs: any = [];

    constructor(public translate : TranslateService, private http: HttpClient, private sortService: SortService, public insightsService: InsightsService) {}


    getLangs(){
      //load the available languages
      return this.http.get(environment.api+'/api/langs')
      .pipe(
        map((res: any) => {
          this.langs = res;
          res.sort(this.sortService.GetSortOrder("name"));
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    

    getAllLangs(){
      //load the available languages
      return this.http.get('assets/jsons/all-languages.json')
      .pipe(
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

    loadDataJson(lang: string){
      //cargar las palabras del idioma
      return this.http.get(environment.api+'/assets/i18n/'+lang+'.json')
      .pipe(
        map((res: any) => {
          return { lang: lang, jsonData: res };
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }
    

}
