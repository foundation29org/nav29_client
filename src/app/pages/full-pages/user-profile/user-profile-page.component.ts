import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from 'environments/environment';
import { HttpClient } from "@angular/common/http";
import { AuthService } from 'app/shared/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import { EventsService} from 'app/shared/services/events.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthGuard } from 'app/shared/auth/auth-guard.service';
import { LangService } from 'app/shared/services/lang.service';
import { Subscription } from 'rxjs';
import { ConfigService } from 'app/shared/services/config.service';
import { AuthServiceFirebase } from "app/shared/services/auth.service.firebase";
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { PatientService } from 'app/shared/services/patient.service';
import { Injector } from '@angular/core';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-user-profile-page',
    templateUrl: './user-profile-page.component.html',
    styleUrls: ['./user-profile-page.component.scss']
})

export class UserProfilePageComponent implements OnInit, AfterViewInit, OnDestroy {
  public config: any = {};
  layoutSub: Subscription;

  public user: any;
  public userCopy: any;
  langs: any;
  allLangs: any;
  private msgDataSavedOk: string;
  private msgDataSavedFail: string;
  msgDownload: string;
  loading: boolean = false;
  sending: boolean = false;
  item: number = 0;
  private subscription: Subscription = new Subscription();
  showPanelDelete: boolean = false;
  deleting: boolean = false;
  isLoading: boolean = false;
  isLoading2: boolean = false;
  isLoginFailed: boolean = false;
  showTryAgain: boolean = false;

  constructor(private configService: ConfigService, private cdr: ChangeDetectorRef, private http: HttpClient, private authService: AuthService, public toastr: ToastrService, public translate: TranslateService, private authGuard: AuthGuard, private langService:LangService, private inj: Injector, public authServiceFirebase: AuthServiceFirebase, public insightsService: InsightsService, private patientService: PatientService, private router: Router) {
    this.config = this.configService.templateConf;

    this.loadLanguages();
  }  

  loadLanguages() {
    this.subscription.add( this.langService.getLangs()
    .subscribe( (res : any) => {
      this.langs=res;
    }));

    this.subscription.add( this.langService.getAllLangs()
    .subscribe( (res : any) => {
      this.allLangs=res;
    }));
  }

    ngOnInit() {

      this.layoutSub = this.configService.templateConf$.subscribe((templateConf) => {
        if (templateConf) {
          this.config = templateConf;
        }
        this.cdr.markForCheck();

      })

      //cargar los datos del usuario
      this.loading = true;
      this.subscription.add( this.http.get(environment.api+'/api/users/settings/'+this.authService.getIdUser())
      .subscribe( (res : any) => {
        this.user = res.user;
        this.userCopy = JSON.parse(JSON.stringify(res.user));
        this.loading = false;
       }, (err) => {
         console.log(err);
         this.insightsService.trackException(err);
         this.loading = false;
       }));

       this.subscription.add( this.translate.onLangChange.subscribe((event: { lang: string, translations: any }) => {
         this.loadTranslations();
       }));

       this.loadTranslations();

       const urlParams = new URLSearchParams(window.location.search);
        const email = decodeURIComponent(urlParams.get('email') || '');
        this.showTryAgain = false;
       if (this.authServiceFirebase.afAuth.isSignInWithEmailLink(window.location.href) && email) {
        this.isLoading = true;
        this.authServiceFirebase.afAuth.signInWithEmailLink(email, window.location.href)
          .then(async (result) => {
            this.showTryAgain = false;
            // Obtiene el token de ID del usuario autenticado
            const idToken = await result.user.getIdToken();
            this.deleteData(idToken);

            this.isLoading = false;
          })
          .catch(error => {
            this.showTryAgain = true;
            this.isLoading = false;
            //console.error("Error signing in with email link", error);
          });
      }

    }

    loadTranslations(){
      this.translate.get('generics.Data saved successfully').subscribe((res: string) => {
        this.msgDataSavedOk=res;
      });
      this.translate.get('generics.Data saved fail').subscribe((res: string) => {
        this.msgDataSavedFail=res;
      });
      this.translate.get('generics.Download').subscribe((res: string) => {
        this.msgDownload=res;
      });
    }

    onChangeLang(newValue) {
      console.log(newValue)
      /*this.translate.use(newValue);
      var eventsLang = this.inj.get(EventsService);
      eventsLang.broadcast('changelang', newValue);*/
      this.onSubmit();
    }

    ngAfterViewInit() {
      let conf = this.config;
      conf.layout.sidebar.collapsed = true;
      this.configService.applyTemplateConfigChange({ layout: conf.layout });
    }

    ngOnDestroy() {
      let conf = this.config;
      conf.layout.sidebar.collapsed = false;
      this.configService.applyTemplateConfigChange({ layout: conf.layout });
      if (this.layoutSub) {
        this.layoutSub.unsubscribe();
      }

      this.subscription.unsubscribe();
    }

    resetForm() {
      this.user= JSON.parse(JSON.stringify(this.userCopy));
      this.translate.use(this.user.lang);
      var eventsLang = this.inj.get(EventsService);
      eventsLang.broadcast('changelang', this.user.lang);
      this.toastr.warning('', this.translate.instant("generics.Restored data"));
    }

    onSubmit() {
      if(this.authGuard.testtoken()){
        this.sending = true;
        var data = {lang: this.user.lang};
        this.subscription.add( this.http.put(environment.api+'/api/users/lang/'+this.authService.getIdUser(), data)
        .subscribe( (res : any) => {

          this.user.lang = res.user.lang;
          this.userCopy = JSON.parse(JSON.stringify(res.user));
          this.authService.setLang(this.user.lang);
          this.translate.use(this.user.lang);
          var eventsLang = this.inj.get(EventsService);
          eventsLang.broadcast('changelang', this.authService.getLang());
          this.sending = false;
          this.showSaveStatus();
         }, (err) => {
           console.log(err);
           this.insightsService.trackException(err);
           this.sending = false;
           if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
             this.authGuard.testtoken();
           }else{
             this.toastr.error('', this.msgDataSavedFail);
           }
         }));
       }
    }

    onChangePreferredResponseLanguage(newValue) {
      console.log(newValue)
      const previousLang = this.userCopy.preferredResponseLanguage;
      const langChanged = previousLang && previousLang !== newValue;
      
      this.patientService.updatePreferredLang(newValue).subscribe((res3) => {
        this.userCopy.preferredResponseLanguage = newValue;
        
        if(langChanged){
          // Mostrar mensaje informativo sobre el cambio de idioma
          this.showLangChangeInfo();
        } else {
          this.showSaveStatus();
        }
      });
    }

    showLangChangeInfo(){
      Swal.fire({
          icon: 'success',
          html: this.translate.instant("generics.Data saved successfully") + '<br><br><small>' + this.translate.instant("profile.Language change info") + '</small>',
          showCancelButton: false,
          showConfirmButton: false,
          allowOutsideClick: false
      })
      setTimeout(function () {
          Swal.close();
      }, 3000);
    }

    onRoleChange(role: string) {
      this.user.role = role;
      console.log(`Selected role: ${this.user.role}`);
      this.subscription.add(this.patientService.setRoleProfile(this.user.role)
        .subscribe((res: any) => {
          console.log(res)
          if(res.message == "You have successfully logged in"){
            this.authService.setEnvironment(res.token);
            //this.toastr.success('', this.msgDataSavedOk);
            this.showSaveStatus();
          }
        }, (err) => {
          console.log(err);
        }));
    }

    onMedicalLevelChange(medicalLevel: string) {
      this.user.medicalLevel = medicalLevel;
      this.subscription.add(this.patientService.setMedicalLevel(this.user.medicalLevel)
        .subscribe((res: any) => {
          //this.toastr.success('', this.msgDataSavedOk);
          this.showSaveStatus();
          console.log(res)
        }, (err) => {
          console.log(err);
        }));
    }

    showSaveStatus(){
      Swal.fire({
          icon: 'success',
          html: this.translate.instant("generics.Data saved successfully"),
          showCancelButton: false,
          showConfirmButton: false,
          allowOutsideClick: false
      })
      setTimeout(function () {
          Swal.close();
      }, 2000);
    }


    deleteAccount(){
      this.showPanelDelete = true;
    }

    cancelDeleteAccount(){
      this.showPanelDelete = false;
    }

    deleteData(idToken){
      //cargar los datos del usuario
      this.deleting = true;
      var info = {idToken:idToken, lang: localStorage.getItem('lang')};
      this.subscription.add( this.http.post(environment.api+'/api/deleteaccount/'+this.authService.getIdUser(), info)
      .subscribe( (res : any) => {
        this.isLoading2 = false;
        if(res.message=='The case has been eliminated'){
          Swal.fire({
            title: this.translate.instant("generics.It has been successfully removed"),
            icon: 'success',
            showCancelButton: false,
            showConfirmButton: false,
            allowOutsideClick: false
          }).then((result) => {
        
          });
            setTimeout(function () {
              Swal.close();
              this.authService.logout();
          }.bind(this), 1500);
        }else{
          Swal.fire(this.translate.instant("profile.incorrect account"), this.translate.instant("profile.we will close your session"), "warning");
          setTimeout(function () {
            this.authService.logout();
          }.bind(this), 1500);
        }
       }, (err) => {
         console.log(err);
         this.insightsService.trackException(err);
         this.deleting = false;
         this.isLoading2 = false;
       }));
    }

    sendVeriffEmail(email: string, event?: Event) {
      this.authServiceFirebase.afAuth.languageCode = Promise.resolve(localStorage.getItem('lang'));
      this.isLoginFailed = false;
      if(event) {
        event.preventDefault();  // Evita el envío real del formulario
      }
      return this.authServiceFirebase.sendSignInLink(email, '/pages/profile')
      .then((done) => {
        if(!done){
          this.isLoginFailed = true;
        }else{
          //swal with html
          Swal.fire({
            title: this.translate.instant("login.almost done"),
            html: '<p class="mt-2">'+this.translate.instant("login.login link")+'</p><ol><li class="mb-2">'+this.translate.instant("login.p1")+'</li> <li class="mb-2">'+this.translate.instant("login.p2")+'</li> <li class="mb-2">'+this.translate.instant("login.p3")+'</li> </ol>',
            icon: 'success',
            showCancelButton: false,
            confirmButtonColor: '#DD6B55',
            confirmButtonText: 'Ok'
          }).then((result) => {
          })

        }
          this.isLoading = false; // Ocultar spinner
          // Maneja el usuario conectado aquí
          // Por ejemplo, navegar a otra ruta
      })
      .catch((error) => {
          this.isLoading = false; // Ocultar spinner
          this.isLoginFailed = true;
          window.alert(error.message); // O puedes mostrar el error de una manera más amigable para el usuario
      });
    }

    async signMethod(method: string) {
      this.isLoading2 = true;
      var resp = null;
      if(method == 'google'){
        resp = await this.authServiceFirebase.GoogleAuth();
      }else if(method == 'microsoft'){
        resp = await this.authServiceFirebase.signInWithMicrosoft();
      }else if(method == 'apple'){
        resp = await this.authServiceFirebase.signInWithApple();
      }
      if(resp!=null){
        this.deleteData(resp);
      }else{
        this.isLoading2 = false;
      }
      
    }

    goBack(){
      // Si hay un paciente seleccionado, ir a home
      // Si no hay paciente seleccionado, ir a la lista de pacientes (seguro para cualquier rol)
      if(this.authService.getCurrentPatient()){
        this.router.navigate(['/home']);
      }else{
        this.router.navigate(['/patients']);
      }
    }


}
