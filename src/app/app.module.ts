import * as $ from 'jquery';
import { NgModule, LOCALE_ID } from "@angular/core";
import { BrowserModule } from '@angular/platform-browser';
import es from '@angular/common/locales/es'
import fr from '@angular/common/locales/fr'
import de from '@angular/common/locales/de'
import it from '@angular/common/locales/it'
import pt from '@angular/common/locales/pt'
import { registerLocaleData } from '@angular/common';
registerLocaleData(es);
registerLocaleData(fr);
registerLocaleData(de);
registerLocaleData(it);
registerLocaleData(pt);
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { ToastrModule } from "ngx-toastr";
import { HttpClientModule, HttpClient, HTTP_INTERCEPTORS } from "@angular/common/http";
import { TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { StoreModule } from "@ngrx/store";
import { DragulaService } from "ng2-dragula";
import { NgxSpinnerModule } from 'ngx-spinner';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
import { environment } from 'environments/environment';

import {
  PerfectScrollbarModule,
  PERFECT_SCROLLBAR_CONFIG,
  PerfectScrollbarConfigInterface
} from 'ngx-perfect-scrollbar';

import { AppRoutingModule } from "./app-routing.module";
import { SharedModule } from "./shared/shared.module";
import * as fromApp from './store/app.reducer';
import { AppComponent } from "./app.component";
import { ContentLayoutComponent } from "./layouts/content/content-layout.component";
import { FullLayoutComponent } from "./layouts/full/full-layout.component";
import { LandPageLayoutComponent } from "./layouts/land-page/land-page-layout.component";

import { AuthGuard } from "./shared/auth/auth-guard.service";
import { RoleGuard } from './shared/auth/role-guard.service';
import { TokenService } from './shared/auth/token.service';
import { WINDOW_PROVIDERS } from './shared/services/window.service';
import { SortService } from 'app/shared/services/sort.service';
import { EventsService } from 'app/shared/services/events.service';
import { DatePipe } from '@angular/common';
import { DateService } from 'app/shared/services/date.service';
import { SearchService } from 'app/shared/services/search.service';
import { LocalizedDatePipe } from 'app/shared/services/localizedDatePipe.service';
import { HighlightSearch } from 'app/shared/services/search-filter-highlight.service';
import { SearchFilterPipe } from 'app/shared/services/search-filter.service';
import { Data } from 'app/shared/services/data.service';
import { CordovaService } from 'app/shared/services/cordova.service';
import { TrackEventsService } from 'app/shared/services/track-events.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { AuthInterceptor } from './shared/auth/auth.interceptor';
import { AuthServiceFirebase } from "./shared/services/auth.service.firebase";
import { WebPubSubService } from 'app/shared/services/web-pub-sub.service';
import { QuillModule } from 'ngx-quill';


const DEFAULT_PERFECT_SCROLLBAR_CONFIG: PerfectScrollbarConfigInterface = {
  suppressScrollX: true,
  wheelPropagation: false
};

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}

@NgModule({
  declarations: [AppComponent, FullLayoutComponent, ContentLayoutComponent, LandPageLayoutComponent, SearchFilterPipe, HighlightSearch, LocalizedDatePipe],
  imports: [
    BrowserModule,
    CommonModule,
    BrowserAnimationsModule,
    StoreModule.forRoot(fromApp.appReducer),
    AppRoutingModule,
    SharedModule,
    HttpClientModule,
    ToastrModule.forRoot(),
    NgbModule,
    NgxSpinnerModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    PerfectScrollbarModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AngularFireStorageModule,
    AngularFireDatabaseModule,
    QuillModule.forRoot(),
  ],
  providers: [
    TokenService,
    AuthGuard,
    RoleGuard,
    {
      provide : HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi   : true
    },
    DragulaService,
    {
      provide: PERFECT_SCROLLBAR_CONFIG,
      useValue: DEFAULT_PERFECT_SCROLLBAR_CONFIG
    },
    { provide: PERFECT_SCROLLBAR_CONFIG, useValue: DEFAULT_PERFECT_SCROLLBAR_CONFIG },
    WINDOW_PROVIDERS,
    { provide: LOCALE_ID, useValue: 'es-ES' },
    SortService,
    EventsService,
    DatePipe,
    DateService,
    SearchService,
    TrackEventsService,
    InsightsService,
    HighlightSearch,
    LocalizedDatePipe,
    SearchFilterPipe,
    Data,
    CordovaService,
    AuthServiceFirebase,
    WebPubSubService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
