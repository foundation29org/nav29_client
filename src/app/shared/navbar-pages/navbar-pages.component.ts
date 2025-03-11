import { Component, Output, EventEmitter, OnDestroy, OnInit, AfterViewInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LayoutService } from '../services/layout.service';
import { Subscription } from 'rxjs';
import { ConfigService } from '../services/config.service';
import { LangService } from 'app/shared/services/lang.service';
import { EventsService } from 'app/shared/services/events.service';
import { TrackEventsService } from 'app/shared/services/track-events.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { Injectable, Injector } from '@angular/core';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar-pages',
  templateUrl: './navbar-pages.component.html',
  styleUrls: ['./navbar-pages.component.scss']
})

@Injectable()
export class NavbarPagesComponent implements OnInit, AfterViewInit, OnDestroy {
  currentLang = 'en';
  toggleClass = 'ft-maximize';
  placement = "bottom-right";
  hideSidebar: boolean = true;
  public isCollapsed = true;
  layoutSub: Subscription;
  @Output()
  toggleHideSidebar = new EventEmitter<Object>();

  public config: any = {};
  langs: any;
  isHomePage: boolean = false;
  isClinicianPage: boolean = false;
  isPatientPage: boolean = false;
  isUndiagnosedPatientPage: boolean = false;
  isEdHubPage: boolean = false;
  isAboutPage: boolean = false;
  isDonaPage: boolean = false;
  isLoginPage: boolean = false;
  isRegisterPage: boolean = false;
  role: string = 'Clinical';
  subrole: string = 'null';
  _startTime: any;
  private subscription: Subscription = new Subscription();

  constructor(public translate: TranslateService, private layoutService: LayoutService, private configService: ConfigService, private langService: LangService, private router: Router, private inj: Injector, public trackEventsService: TrackEventsService, public insightsService: InsightsService) {

    this.loadLanguages();
    if ((this.router.url).indexOf('/.') != -1 || (this.router.url)== '/') {
      this.isHomePage = true;
      this.isAboutPage = false;
      this.isLoginPage = false;
      this.isRegisterPage = false;
      this.role = 'Clinical';
      this.subrole = 'null';
    }else if((this.router.url).indexOf('/aboutus')!=-1){
      this.isHomePage = false;
          this.isAboutPage = true;
          this.isLoginPage = false;
          this.isRegisterPage = false;
    }else if ((this.router.url).indexOf('/login') != -1) {
      this.isHomePage = false;
      this.isAboutPage = false;
      this.isLoginPage = true;
      this.isRegisterPage = false;
    }else{
      this.isHomePage = false;
      this.isAboutPage = false;
      this.isLoginPage = false;
      this.isRegisterPage = false;
    }

    this.router.events.pipe(
      filter((event: any) => event instanceof NavigationEnd)
    ).subscribe(event => {
      var tempUrl = (event.url).toString();
        if (tempUrl.indexOf('/.') != -1 || tempUrl == '/') {
          this.isHomePage = true;
          this.isAboutPage = false;
          this.isLoginPage = false;
          this.isRegisterPage = false;
          this.role = 'Clinical';
          this.subrole = 'null';
        } else if (tempUrl.indexOf('/aboutus') != -1) {
          this.isHomePage = false;
          this.isAboutPage = true;
          this.isLoginPage = false;
          this.isRegisterPage = false;
        }else if (tempUrl.indexOf('/login') != -1) {
          this.isHomePage = false;
          this.isAboutPage = false;
          this.isLoginPage = true;
          this.isRegisterPage = false;
        }else {
          this.isHomePage = false;
          this.isAboutPage = false;
          this.isLoginPage = false;
          this.isRegisterPage = false;
        }
    });

    this.layoutSub = layoutService.toggleSidebar$.subscribe(
      isShow => {
        this.hideSidebar = !isShow;
      });

    this._startTime = Date.now();
  }

  ngOnInit() {
    this.config = this.configService.templateConf;
  }

  ngAfterViewInit() {
    if (this.config.layout.dir) {
      setTimeout(() => {
        const dir = this.config.layout.dir;
        if (dir === "rtl") {
          this.placement = "bottom-left";
        } else if (dir === "ltr") {
          this.placement = "bottom-right";
        }
      }, 0);

    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.layoutSub) {
      this.layoutSub.unsubscribe();
    }
  }

  ToggleClass() {
    if (this.toggleClass === "ft-maximize") {
      this.toggleClass = "ft-minimize";
    } else {
      this.toggleClass = "ft-maximize";
    }
  }

  toggleNotificationSidebar() {
    this.layoutService.toggleNotificationSidebar(true);
  }

  toggleSidebar() {
    const appSidebar = document.getElementsByClassName("app-sidebar")[0];
    if (appSidebar.classList.contains("hide-sidebar")) {
      this.toggleHideSidebar.emit(false);
    } else {
      this.toggleHideSidebar.emit(true);
    }
  }

  loadLanguages() {
    this.subscription.add(this.langService.getLangs()
      .subscribe((res: any) => {
        this.langs = res;
        if (localStorage.getItem('lang')) {
          this.translate.use(localStorage.getItem('lang'));
          this.searchLangName(localStorage.getItem('lang'));
          this.currentLang = localStorage.getItem('lang');
        } else {
          const browserLang: string = this.translate.getBrowserLang();
          var foundlang = false;
          for (let lang of this.langs) {
            if (browserLang.match(lang.code)) {
              this.translate.use(lang.code);
              foundlang = true;
              localStorage.setItem('lang', lang.code);
              this.currentLang = localStorage.getItem('lang');
              this.searchLangName(lang.name);
            }
          }
          if (!foundlang) {
            localStorage.setItem('lang', this.translate.store.currentLang);
            this.currentLang = this.translate.store.currentLang;
          }
        }

      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
      }));
  }

  searchLangName(code: string) {
    for (let lang of this.langs) {
      var actualLang = localStorage.getItem('lang');
      if (actualLang == lang.code) {
        this.currentLang = lang.code;
      }
    }
  }

  ChangeLanguage(language: string) {
    this.translate.use(language);
    localStorage.setItem('lang', language);
    this.searchLangName(language);
    var eventsLang = this.inj.get(EventsService);
    eventsLang.broadcast('changelang', language);
  }

  getElapsedSeconds() {
    var endDate = Date.now();
    var seconds = (endDate - this._startTime) / 1000;
    return seconds;
  };

  goToLogin(){
    this.router.navigate(['/login']);
  }

}
