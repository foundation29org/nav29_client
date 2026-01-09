import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { NgForm } from '@angular/forms'
import { environment } from 'environments/environment';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { HttpClient } from "@angular/common/http";
import { AuthService } from 'app/shared/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { PatientService } from 'app/shared/services/patient.service';
import { Router} from '@angular/router';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-patients',
    templateUrl: './patients.component.html',
    styleUrls: ['./patients.component.scss']
})

export class PatientsComponent implements OnInit, OnDestroy {

  private subscription: Subscription = new Subscription();
  private subscription2: Subscription = new Subscription();
  patients: any = [];
  filteredPatients: any = [];
  sharedPatients: any = [];
  filteredSharedPatients: any = [];
  currentPatient : any = null;
  mode = 'Custom';
  modalReference: NgbModalRef;
  @ViewChild('shareCustom', { static: false }) contentshareCustom: TemplateRef<any>;
  loaded = false;
  role: string;
  searchTerm: string = '';

  constructor(private router: Router, private http: HttpClient, private authService: AuthService, public toastr: ToastrService, public translate: TranslateService, public insightsService: InsightsService, private patientService: PatientService,private modalService: NgbModal
  ) {

  }  

    ngOnInit() {
      this.role = this.authService.getRole();
      this.subscription.add(this.authService.currentPatient$.subscribe(patient => {
        console.log('entra')
        console.log(patient)
        if (patient) {
          this.initEnvironment();
        }
      }));
      this.initEnvironment();
      this.getSharedPatients();
    }

    initEnvironment() {
      this.loaded = true;
      this.patients = this.authService.getPatientList();
      console.log(this.patients)
      this.currentPatient = this.authService.getCurrentPatient();
      this.filteredPatients = [...this.patients];
      this.subscription2 = this.authService.patientListSubject.subscribe(
        (patientList) => {
          patientList.sort((a, b) => a.patientName.localeCompare(b.patientName));
          this.patients = patientList;
          this.filterPatients();
        }
      );
    }

    getSharedPatients() {
      this.subscription.add(this.patientService.getSharedPatients(this.authService.getIdUser())
        .subscribe((res: any) => {
          console.log(res)
          this.sharedPatients = res;
          this.filteredSharedPatients = [...this.sharedPatients];
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
        }));
    
    }

    filterPatients() {
      if (!this.searchTerm || this.searchTerm.trim() === '') {
        this.filteredPatients = [...this.patients];
      } else {
        const search = this.searchTerm.toLowerCase().trim();
        this.filteredPatients = this.patients.filter((patient: any) => {
          // Buscar por nombre
          const nameMatch = patient.patientName?.toLowerCase().includes(search);
          
          // Buscar por fecha de nacimiento
          let dateMatch = false;
          if (patient.birthDate) {
            const birthDate = new Date(patient.birthDate);
            const day = birthDate.getDate();
            const month = birthDate.getMonth() + 1;
            const year = birthDate.getFullYear();
            
            // Nombres de mes en español
            const monthNames = [
              'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
              'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
            ];
            const monthNamesShort = [
              'ene', 'feb', 'mar', 'abr', 'may', 'jun',
              'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
            ];
            
            const monthName = monthNames[month - 1];
            const monthNameShort = monthNamesShort[month - 1];
            
            // Generar todas las variaciones posibles de formato
            const dateVariations = [
              // Formato largo: "6 de abril de 1953"
              `${day} de ${monthName} de ${year}`,
              `${day} de ${monthName}`,
              // Formato corto: "6 abr 1953", "6 abr.", "6 abr"
              `${day} ${monthNameShort} ${year}`,
              `${day} ${monthNameShort}. ${year}`,
              `${day} ${monthNameShort}`,
              `${day} ${monthNameShort}.`,
              // Formato numérico: "6/4/1953", "06/04/1953"
              `${day}/${month}/${year}`,
              `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
              // Solo día y mes: "6/4", "06/04"
              `${day}/${month}`,
              `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`,
              // Solo año
              year.toString(),
              // Solo mes
              monthName,
              monthNameShort,
              // Formato ISO: "1953-04-06"
              `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
            ];
            
            // Buscar en todas las variaciones
            dateMatch = dateVariations.some(format => format.toLowerCase().includes(search));
          }
          
          return nameMatch || dateMatch;
        });
      }
    }

    filterSharedPatients() {
      if (!this.searchTerm || this.searchTerm.trim() === '') {
        this.filteredSharedPatients = [...this.sharedPatients];
      } else {
        const search = this.searchTerm.toLowerCase().trim();
        this.filteredSharedPatients = this.sharedPatients.filter((patient: any) => {
          // Buscar por nombre
          const nameMatch = patient.patientName?.toLowerCase().includes(search);
          
          // Buscar por fecha de nacimiento
          let dateMatch = false;
          if (patient.birthDate) {
            const birthDate = new Date(patient.birthDate);
            const day = birthDate.getDate();
            const month = birthDate.getMonth() + 1;
            const year = birthDate.getFullYear();
            
            // Nombres de mes en español
            const monthNames = [
              'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
              'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
            ];
            const monthNamesShort = [
              'ene', 'feb', 'mar', 'abr', 'may', 'jun',
              'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
            ];
            
            const monthName = monthNames[month - 1];
            const monthNameShort = monthNamesShort[month - 1];
            
            // Generar todas las variaciones posibles de formato
            const dateVariations = [
              // Formato largo: "6 de abril de 1953"
              `${day} de ${monthName} de ${year}`,
              `${day} de ${monthName}`,
              // Formato corto: "6 abr 1953", "6 abr.", "6 abr"
              `${day} ${monthNameShort} ${year}`,
              `${day} ${monthNameShort}. ${year}`,
              `${day} ${monthNameShort}`,
              `${day} ${monthNameShort}.`,
              // Formato numérico: "6/4/1953", "06/04/1953"
              `${day}/${month}/${year}`,
              `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
              // Solo día y mes: "6/4", "06/04"
              `${day}/${month}`,
              `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`,
              // Solo año
              year.toString(),
              // Solo mes
              monthName,
              monthNameShort,
              // Formato ISO: "1953-04-06"
              `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
            ];
            
            // Buscar en todas las variaciones
            dateMatch = dateVariations.some(format => format.toLowerCase().includes(search));
          }
          
          return nameMatch || dateMatch;
        });
      }
    }

    onSearchChange() {
      this.filterPatients();
      this.filterSharedPatients();
    }

    clearSearch() {
      this.searchTerm = '';
      this.filterPatients();
      this.filterSharedPatients();
    }

    ngOnDestroy() {
      this.subscription.unsubscribe();
      this.subscription2.unsubscribe();
    }


    selectPatient(patient): void {
      this.authService.setCurrentPatient(patient);
      this.router.navigate(['/home'], { queryParams: { my: 'Data' } });
    }
  
    deletePatient(sub: string): void {
      Swal.fire({
        title: this.translate.instant('patients.msgdelete'),
        text: this.translate.instant('patients.msgdelete2'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: this.translate.instant('patients.Yes, delete it!'),
        cancelButtonText: this.translate.instant('patients.No, keep it')
      }).then((result) => {
        if (result.value) {
          this.deletePatientConfirmed(sub);
        }
      });
    }

    deletePatientConfirmed(sub: string): void {
      this.subscription.add(this.patientService.deletePatient(sub)
      .subscribe((res: any) => {
        console.log(res)
        if (this.currentPatient?.sub === sub) {
          this.authService.setCurrentPatient(null);
        }
        this.authService.loadPatients();
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
      }));
      
    
    }
  
    addPatient(): void {
      this.router.navigate(['/new-patient']);
    }
  
    /*editPatient(patient): void {
      //go to edit patient page
      this.authService.setCurrentPatient(patient);
      this.router.navigate(['/patient']);
    }*/

    enableEdit(patient): void {
      patient.editing = true;
      patient.originalData = { ...patient }; // Guardar datos originales por si cancela
    }
  
    cancelEdit(patient): void {
      Object.assign(patient, patient.originalData); // Restaurar datos originales
      patient.editing = false;
    }

    savePatient(patient): void {
      this.subscription.add(this.http.put(environment.api + '/api/patients/' + patient.sub, patient)
      .subscribe((res: any) => {
        patient.editing = false;
          delete patient.originalData; // Eliminar datos originales
          this.authService.loadPatients();
          this.toastr.success(this.translate.instant('patients.Patient updated successfully'));
      }, (err) => {
        this.insightsService.trackException(err);
        this.toastr.error(this.translate.instant('patients.Failed to update patient'));
      }));
    }

    share(patient){
      this.authService.setCurrentPatient(patient);
      this.openModal(this.contentshareCustom);
    }

    openModal(modaltemplate){
      let ngbModalOptions: NgbModalOptions = {
            backdrop : 'static',
            keyboard : false,
            windowClass: 'ModalClass-lg'// xl, lg, sm
      };
      this.modalReference = this.modalService.open(modaltemplate, ngbModalOptions);
    }

    closeModalShare() {
      if (this.modalReference != undefined) {
        this.modalReference.close();
        this.modalReference = undefined;
      }
    }

    backToHome(): void {
      // Si hay paciente seleccionado, ir a home; si no, quedarse en patients
      if (this.authService.getCurrentPatient()) {
        this.router.navigate(['/home']);
      }
      // Si no hay paciente, no navegar (ya estamos en patients)
    }

}
