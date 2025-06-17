import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiDx29ServerService } from 'app/shared/services/api-dx29-server.service';
import { AuthService } from 'app/shared/auth/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, switchMap, tap } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-my-condition',
  templateUrl: './my-condition.component.html',
  styleUrls: ['./my-condition.component.scss']
})
export class MyConditionComponent implements OnInit, OnDestroy {
  rarescopeData: any;
  isLoading: boolean = false;
  errorMessage: string = '';
  noPatientSelected: boolean = false;
  private patientSubscription: Subscription;

  constructor(
    private apiDx29ServerService: ApiDx29ServerService,
    private authService: AuthService,
    private translate: TranslateService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.patientSubscription = this.authService.currentPatient$.subscribe(
      (patient) => {
        if (patient && patient.sub) {
          this.noPatientSelected = false;
          this.errorMessage = '';
          this.loadRarescopeData(patient.sub);
        } else {
          this.isLoading = false;
          this.rarescopeData = null;
          this.noPatientSelected = true;
          this.errorMessage = this.translate.instant('patients.No patient selected');
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.patientSubscription) {
      this.patientSubscription.unsubscribe();
    }
  }

  private loadRarescopeData(patientId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.rarescopeData = null;

    this.apiDx29ServerService.getRarescopeAnalysis(patientId).subscribe(
      (res: any) => {
        if (res && res.success && res.analysis && res.analysis.trim() !== '') {
          this.rarescopeData = res;
        } else if (res && res.analysis && res.analysis.trim() === '') {
          this.errorMessage = this.translate.instant('generics.noDataToAnalyze');
          this.rarescopeData = null;
        }
        else {
          this.errorMessage = this.translate.instant('my-condition.error');
          this.rarescopeData = null;
        }
        this.isLoading = false;
      },
      (error) => {
        console.error('Error fetching Rarescope analysis:', error);
        this.errorMessage = this.translate.instant('my-condition.error');
        this.rarescopeData = null;
        this.isLoading = false;

        Swal.fire(
          this.translate.instant('generics.error'),
          this.translate.instant('generics.errorGettingInfo'),
          'error'
        );
      }
    );
  }

  navigateToPatients(): void {
    this.router.navigate(['/patients']);
  }
}