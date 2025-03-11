import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { ToastrService } from 'ngx-toastr';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { AuthService } from 'app/shared/auth/auth.service';

@Component({
  selector: 'app-edit-medical-event',
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
  templateUrl: './edit-medical-event.component.html',
  styleUrls: ['./edit-medical-event.component.scss']
})
export class EditMedicalEventComponent implements OnInit {
  @Input() event: any;
  eventForm: FormGroup;

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private translate: TranslateService,
    private toastr: ToastrService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.eventForm = this.formBuilder.group({
      name: [this.event.name, Validators.required],
      date: [new Date(this.event.date), Validators.required],
      key: [this.event.key, Validators.required],
      notes: [this.event.notes]
    });
  }

  save() {
    if (this.eventForm.valid) {
      const updatedEvent = {
        ...this.event,
        name: this.eventForm.value.name,
        date: this.eventForm.value.date,
        key: this.eventForm.value.key,
        notes: this.eventForm.value.notes
      };

      this.http.put(`${environment.api}/api/events/${this.authService.getCurrentPatient().sub}/${updatedEvent._id}/${this.authService.getIdUser()}`, updatedEvent)
        .subscribe(
          (response: any) => {
            console.log('Event updated successfully:', response);

            this.toastr.success(this.translate.instant("events.EventSuccess"));
            this.activeModal.close(response);
          },
          (error) => {
            console.error('Error updating event:', error);
            this.toastr.error(this.translate.instant("events.ErrorUpdatingEvent"));
            this.activeModal.dismiss('error');
          }
        );
    }
  }
}

