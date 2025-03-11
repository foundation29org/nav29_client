import { TranslateService } from '@ngx-translate/core';
import { Component, ViewChild, OnDestroy } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { NgForm } from '@angular/forms';
import { environment } from 'environments/environment';
import { TrackEventsService } from 'app/shared/services/track-events.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

declare let gtag: any;

@Component({
    selector: 'app-footer-land',
    templateUrl: './footer-land.component.html',
    styleUrls: ['./footer-land.component.scss']
})

export class FooterLandComponent implements OnDestroy{
    //Variables
    currentDate : Date = new Date();
    @ViewChild('f') mainForm: NgForm;
    sending: boolean = false;
    email: string;
    private subscription: Subscription = new Subscription();

    constructor(private http: HttpClient, public translate: TranslateService, public toastr: ToastrService, public trackEventsService: TrackEventsService, public insightsService: InsightsService) {
    }

    lauchEvent(category) {
      this.trackEventsService.lauchEvent(category);
      }

      ngOnDestroy() {
        this.subscription.unsubscribe();
      }
      
      submitInvalidForm() {
        if (!this.mainForm) { return; }
        const base = this.mainForm;
        for (const field in base.form.controls) {
          if (!base.form.controls[field].valid) {
              base.form.controls[field].markAsTouched()
          }
        }
      }
  
      sendMsg(){
          this.sending = true;
  
          //this.mainForm.value.email = (this.mainForm.value.email).toLowerCase();
          //this.mainForm.value.lang=this.translate.store.currentLang;
  
          var params = this.mainForm.value;
          this.subscription.add( this.http.post(environment.api+'/api/homesupport/', params)
          .subscribe( (res : any) => {
            this.sending = false;
            this.toastr.success('', this.translate.instant("generics.Data saved successfully"));
            this.mainForm.reset();
           }, (err) => {
             console.log(err);
             this.insightsService.trackException(err);
             this.sending = false;
             this.toastr.error('', this.translate.instant("generics.error try again"));
           }));
      }
  

}
