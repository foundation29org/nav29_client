import { Component, OnInit, OnDestroy, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { NgForm, FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { HttpClient } from "@angular/common/http";
import { environment } from 'environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { SearchService } from 'app/shared/services/search.service';
import { AuthService } from 'app/shared/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { EventsService} from 'app/shared/services/events.service';
import { Injectable, Injector } from '@angular/core';
import { InsightsService } from 'app/shared/services/azureInsights.service';

declare let gtag: any;

@Component({
    selector: 'app-feedback-summary-page',
    templateUrl: './feedback-summary-page.component.html',
    styleUrls: ['./feedback-summary-page.component.scss'],
})

export class FeedbackSummaryPageComponent implements OnInit, OnDestroy {

    private subscription: Subscription = new Subscription();
    _startTime: any;
    role: string = '';
    eventList: any = [];
    showErrorForm: boolean = false;
    sending: boolean = false;
    @ViewChild('f') mainForm: NgForm;

    formulario: FormGroup;
    @Input() documents: any;
    @Input() type: string;
    @Output() close = new EventEmitter<void>(); 
    loading: boolean = false;

    constructor(private searchService: SearchService, public translate: TranslateService, private http: HttpClient, public toastr: ToastrService, private inj: Injector, public insightsService: InsightsService, private authService: AuthService) {
        

        this.formulario = new FormGroup({
            pregunta1: new FormControl('', Validators.required),
            freeText: new FormControl(''),
          });

          setTimeout(function () {
            //this.goTo('initpos');
        }.bind(this), 500);

    }

    ngOnInit() {
      }

      goTo(url){
        document.getElementById(url).scrollIntoView(true);
      }

    getElapsedSeconds() {
        var endDate = Date.now();
        var seconds = (endDate - this._startTime) / 1000;
        return seconds;
    };

    lauchEvent(category) {
        var secs = this.getElapsedSeconds();
        var savedEvent = this.searchService.search(this.eventList, 'name', category);
        if(!savedEvent){
            this.eventList.push({name:category});
            gtag('event', category, { 'myuuid': this.authService.getIdUser(), 'event_label': secs });
        }
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    openWeb(){
        window.open('https://www.foundation29.org', '_blank');
    }
  
    sendFeedback(){
        if (this.formulario.valid) {
            console.log(this.authService.getCurrentPatient())
            this.sending = true;
            const respuesta1 = this.formulario.get('pregunta1')?.value;
            const freeText = this.formulario.get('freeText')?.value;
        
            var value = { value: this.formulario.value, lang: this.translate.store.currentLang, documents: this.documents, type: this.type}
            this.subscription.add( this.http.post(environment.api+'/api/generalfeedback/set/'+this.authService.getCurrentPatient().sub, value)
            .subscribe( (res : any) => {
            this.sending = false;
            this.toastr.success(this.translate.instant("feedback.thanks"), this.translate.instant("feedback.Submitted"));
            this.formulario.reset();
            this.lauchEvent('Send email GENERAL FEEDBACK');
            //this.activeModal.close();
            this.close.emit();

            }, (err) => {
            this.insightsService.trackException(err);
                console.log(err);
                this.sending = false;
                this.toastr.error('', this.translate.instant("generics.error try again"));
            }));
        } else {
            this.toastr.error(this.translate.instant("feedback.onstarts"), 'Error');
        } 
    }
}
