import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from "@angular/router";
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import Swal from 'sweetalert2';
import { AuthService } from '../../../app/shared/auth/auth.service';
import { PatientService } from 'app/shared/services/patient.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { LangService } from 'app/shared/services/lang.service';
import { EventsService } from 'app/shared/services/events.service';
import { tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})

export class WelcomeComponent implements OnInit, OnDestroy {
  private subscription: Subscription = new Subscription();
  loadedUserInfo: boolean = false;
  isVerified: boolean = false;


  modalReference: NgbModalRef;
  
  role = 'Unknown';
  medicalLevel: string = '1';
  preferredResponseLanguage: string = '';
  lang: string = '';
  langs: any;
  allLangs: any;
  sharedPatients: any = [];
  patientList: any = [];
  formErrors = {
    lang: false,
    preferredResponseLanguage: false,
    role: false,
    medicalLevel: false
  };

  @ViewChild('contentExpectations', { static: false }) contentExpectations: TemplateRef<any>;
  showMedicalLevel = false;


  handleIsVerified(isVerified: boolean) {
    this.setVerified(isVerified);
  }

  constructor(private patientService: PatientService, private router: Router, private modalService: NgbModal, public toastr: ToastrService, public translate: TranslateService, private authService: AuthService, public insightsService: InsightsService, private langService: LangService, private eventsService: EventsService) {

  }


  setVerified(isVerified: boolean) {
    this.isVerified = isVerified;
  }


  ngOnInit() {
    this.getRoleMedicalLevel();
    this.loadLanguages();
    this.getSharedPatients();
   
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


  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  getRoleMedicalLevel() {
    this.subscription.add(this.patientService.getRoleMedicalLevel()
      .subscribe((res: any) => {
        this.role = res.role;
        this.medicalLevel = res.medicalLevel;
        this.preferredResponseLanguage = res.preferredResponseLanguage;
        this.lang = res.lang;
        this.loadedUserInfo = true;
        this.showExpectations();
      }, (err) => {
        console.log(err);
      }));
  }

  getSharedPatients() {
    return this.patientService.getSharedPatients(this.authService.getIdUser())
      .pipe(
        tap((res: any) => {
          this.sharedPatients = res;
        })
      );
  }

  showExpectations() {
    let ngbModalOptions: NgbModalOptions = {
      keyboard: false,
      backdrop : 'static',
      windowClass: 'ModalClass-lg' // xl, lg, sm
    };
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    this.modalReference = this.modalService.open(this.contentExpectations, ngbModalOptions);
  }

  // Añadir métodos para manejar los cambios
  onRoleChange(value: string) {
    this.role = value;
    this.formErrors.role = false; // Limpiar el error cuando se selecciona un rol
  }

  onMedicalLevelChange(value: string) {
    this.medicalLevel = value;
    this.formErrors.medicalLevel = false;
  }

  onLangChange(value: string) {
    this.lang = value;
    this.formErrors.lang = false;
  }

  onPreferredLangChange(value: string) {
    this.preferredResponseLanguage = value;
    this.formErrors.preferredResponseLanguage = false;
  }
  
  async saveSettings() {

    // Resetear errores
    this.formErrors = {
      lang: false,
      preferredResponseLanguage: false,
      role: false,
      medicalLevel: false
    };

    // Marcar campos con error
    this.formErrors.lang = !this.lang;
    this.formErrors.preferredResponseLanguage = !this.preferredResponseLanguage;
    this.formErrors.role = !this.role || this.role === 'Unknown';
    this.formErrors.medicalLevel = !this.medicalLevel;



    // Validar que todos los campos estén completos
    if (!this.lang || !this.preferredResponseLanguage || !this.role || this.role === 'Unknown' || !this.medicalLevel) {
      Swal.fire({
        icon: 'warning',
        title: this.translate.instant("generics.Warning"),
        text: this.translate.instant("welcome.allFieldsRequired"),
        confirmButtonText: this.translate.instant("generics.Accept")
      });
      return;
    }

    try {
      const res = await firstValueFrom(
        this.patientService.saveSettings(this.lang, this.preferredResponseLanguage, this.role, this.medicalLevel)
      );

      if(res.message == "You have successfully logged in") {
        this.authService.setEnvironment(res.token);
        
        // Convertimos el Observable a Promise y esperamos la respuesta
        console.log('Getting patient ID...');
        const patientIdResponse = await firstValueFrom(this.patientService.getPatientId());
        console.log('Patient ID response:', patientIdResponse);

        this.patientList = this.authService.getPatientList();
        
        // Esperamos a que se complete getSharedPatients
        console.log('Getting shared patients...');
        await firstValueFrom(this.getSharedPatients());
        console.log('Shared patients obtained');

        // Si no hay paciente actual pero hay pacientes compartidos, seleccionamos el primero
        if (!this.authService.getCurrentPatient()) {
          if(this.patientList.length > 0){
            this.eventsService.broadcast('patientChanged', this.authService.getCurrentPatient());
            this.authService.setCurrentPatient(this.patientList[0])
          }else if(this.sharedPatients.length > 0){
            this.eventsService.broadcast('patientChanged', this.authService.getCurrentPatient());
            this.authService.setCurrentPatient(this.sharedPatients[0])
          }
        }
        
        await Swal.fire({
          title: this.translate.instant("welcome.settingsSaved"),
          html: this.getNextStepMessage(),
          icon: 'success',
          confirmButtonText: this.translate.instant("wizard.Continue")
        });

        this.navigateBasedOnRole();
      }
    } catch (error) {
      console.error('Error in saveSettings:', error);
      Swal.fire({
        icon: 'error',
        title: this.translate.instant("generics.error"),
        text: this.translate.instant("generics.error try again")
      });
    }
  }

  private getNextStepMessage(): string {
    if (this.role === 'Clinical') {
      return this.translate.instant("welcome.nextStepsClinical");
    } else if (this.patientList.length === 0 && this.sharedPatients.length === 0) {
      return this.translate.instant("welcome.nextStepsNewPatient");
    } else {
      return this.translate.instant("welcome.nextStepsExistingPatient");
    }
  }

  private navigateBasedOnRole() {
    if(this.patientList.length > 0 || this.sharedPatients.length > 0) {
      if((this.patientList.length == 1 && this.sharedPatients.length == 0) || 
         (this.patientList.length == 0 && this.sharedPatients.length == 1)) {
        this.router.navigate(['/home', { firstPatient: true }]);
      } else {
        this.router.navigate(['/patients']);
      }
    } else {
      if(this.role == 'Clinical') {
        this.router.navigate(['/patients']);
      } else {
        this.router.navigate(['/new-patient']);
      }
    }
  }

  async closeModal() {

    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
  }

    goToPatients(){
      this.router.navigate(['/patients']);
    }
}