import { Component, ViewChild,  OnDestroy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpClient } from "@angular/common/http";
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from 'app/shared/auth/auth.service';
import { AuthGuard } from 'app/shared/auth/auth-guard.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnDestroy{
  @ViewChild('f') supportForm: NgForm;

  private subscription: Subscription = new Subscription();

  supportInfo: any = {};
  msgList: any = [];
  sending: boolean = false;

  constructor(private http: HttpClient, private translate : TranslateService, private authService: AuthService, private authGuard: AuthGuard, public toastr: ToastrService, public insightsService: InsightsService) {

    this.initVars();

  }

  initVars(){
    this.supportInfo = {
      subject: '',
      description: '',
      userId: this.authService.getIdUser()
    };
    this.loadMsg();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  submitInvalidForm() {
    if (!this.supportForm) { return; }
    const base = this.supportForm;
    for (const field in base.form.controls) {
      if (!base.form.controls[field].valid) {
          base.form.controls[field].markAsTouched()
      }
    }
  }

  sendMsg(){
    if(this.authGuard.testtoken()){
      this.sending = true;
      this.subscription.add( this.http.post(environment.api+'/api/support/', this.supportInfo)
      .subscribe( (res : any) => {
        //this.supportInfo = res.diagnosis;
        this.toastr.success('', this.translate.instant("generics.Data saved successfully"));
        this.supportForm.reset();
        this.sending = false;
        this.initVars();
       }, (err) => {
         this.sending = false;
         console.log(err);
         this.insightsService.trackException(err);
         this.toastr.error('', this.translate.instant("generics.error try again"));
       }));

    }
  }

  loadMsg(){
    if(this.authGuard.testtoken()){

      this.subscription.add( this.http.get(environment.api+'/api/support/'+this.authService.getIdUser())
      .subscribe( (res : any) => {
        this.msgList = res.listmsgs;
       }, (err) => {
         console.log(err);
         this.insightsService.trackException(err);
         this.toastr.error('', this.translate.instant("generics.error try again"));
       }));

    }
  }

}
