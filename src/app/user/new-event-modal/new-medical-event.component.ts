import { Component, OnInit, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { AuthService } from '../../../app/shared/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-new-medical-event',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    TranslateModule, 
    MatDatepickerModule, 
    MatInputModule, 
    MatFormFieldModule, 
    MatNativeDateModule
  ],
  templateUrl: './new-medical-event.component.html',
  styleUrls: ['./new-medical-event.component.scss']
})
export class NewMedicalEventComponent implements OnInit {
  @Input() docId: string;
  eventForm: FormGroup;
  submitted = false;

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private translate: TranslateService,
    private toastr: ToastrService
  ) { }

  ngOnInit() {
    this.eventForm = this.formBuilder.group({
      name: ['', Validators.required],
      date: [new Date(), Validators.required],
      key: ['', Validators.required],
      notes: []
    });
  }

  save() {
    this.submitted = true;

    if (this.eventForm.invalid) {
      return;
    }
    if (this.eventForm.valid) {
      const newEvent = {
        name: this.eventForm.value.name,
        docId: this.docId,
        status: 'true',
        date: this.eventForm.value.date,
        key: this.eventForm.value.key,
        notes: this.eventForm.value.notes
      };
      const userId = this.authService.getIdUser();

      this.http.post(`${environment.api}/api/eventsdoc/`+this.authService.getCurrentPatient().sub+'/'+userId, newEvent)
        .subscribe(
          (response: any) => {
            if (response.message == 'Eventdb created') {
              console.log('Event created successfully:', response);
              this.toastr.success(this.translate.instant("events.EventSuccess"));
              this.activeModal.close(response.message);
            } else {
              console.error('Unexpected response format:', response);
              this.toastr.error(this.translate.instant("events.ErrorCreatingEvent"));
              this.activeModal.dismiss('error');
            }
          },
          (error) => {
            console.error('Error creating event:', error);
            this.toastr.error(this.translate.instant("events.ErrorCreatingEvent"));
            this.activeModal.dismiss('error');
          }
        );
    }
  }

  cancel() {
    this.submitted = false;
    this.activeModal.dismiss('cancel');
  }
}