import { Component, OnInit, OnDestroy, EventEmitter, Output } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from 'app/shared/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import CryptoES from 'crypto-es';
import * as decode from 'jwt-decode';

declare global {
  interface Window {
    veriffSDK: any;
  }
}

@Component({
  selector: 'app-veriff',
  templateUrl: './veriff.component.html',
  styleUrls: ['./veriff.component.scss']
})

export class VeriffComponent implements OnInit, OnDestroy {
   //Variable Declaration
   patient: any;
  infoVerified: any = {};
  checking: boolean = false;
  loadVerifiedInfo: boolean = false;
  userInfo: any = {};
  gridSize: string = 'md';
  clientHeight: any = 0;
  lang: string;
  private subscription: Subscription = new Subscription();
  @Output() isVerifiedEmmited = new EventEmitter<string>();

  constructor(private http: HttpClient, public translate: TranslateService, private authService: AuthService, public toastr: ToastrService) {
    this.lang = this.authService.getLang();
    this.loadScripts();
    
  }

  loadScripts(){
    $.getScript("https://cdn.veriff.me/sdk/js/1.2/veriff.min.js").done(function (script, textStatus) {
      //console.log("finished loading and running docxtemplater.js. with a status of" + textStatus);
    });
    $.getScript("https://cdn.veriff.me/incontext/js/v1/veriff.js").done(function (script, textStatus) {
      //console.log("finished loading and running docxtemplater.js. with a status of" + textStatus);
    });
  }



  ngOnDestroy() {
    this.subscription.unsubscribe();
  }


  ngOnInit() {
    this.getUserInfo(false);
  }

getUserInfo(checkstatus) {
  this.checking = true;
  this.subscription.add(this.http.get(environment.api + '/api/users/name/' + this.authService.getIdUser())
    .subscribe((res: any) => {
      this.userInfo = res;
      this.callIsVerified(checkstatus);
    }, (err) => {
      console.log(err);
      this.checking = false;
    }));

}

callIsVerified(checkstatus) {
  this.loadVerifiedInfo = false;
  this.subscription.add(this.http.get(environment.api + '/api/verified/' + this.authService.getIdUser())
    .subscribe((res: any) => {
      console.log(res)
      this.loadVerifiedInfo = true;
      this.infoVerified = res.infoVerified;
      if(!this.infoVerified.isVerified && (checkstatus || this.infoVerified.status!='Not started')){
        this.checkStatusVerified();
      }else{
        //this.getPatients();
      }
      this.checking = false;
    }, (err) => {
      console.log(err);
      this.checking = false;
    }));

}

checkStatusVerified(){
  if(this.infoVerified.url){
    var token = this.infoVerified.url.split('https://magic.veriff.me/v/');
    var tokenPayload = decode(token[1]);
    var date1 = tokenPayload.iat;
    var date2 = (new Date().getTime())/1000;
    var timeDiff = date2 - date1;
    var Difference_In_Days = timeDiff / (1000 * 3600 * 24);
    if(Difference_In_Days>=6){
      //this.createSesion();
      this.verifyStatus();
    }else{
      this.getVerified();
    }
    //this.saveDataVeriff(tokenPayload.session_id);
  }else{
    this.getVerified();
  }
      
}

saveDataVeriff(){
  var token = this.infoVerified.url.split('https://magic.veriff.me/v/');
  var tokenPayload = decode(token[1]);
  var session_id= tokenPayload.session_id
  var hashva = CryptoES.HmacSHA256(session_id, environment.privateVeriff);
  const headers= new HttpHeaders()
  .set('X-HMAC-SIGNATURE', hashva.toString().toLowerCase())
  .set('x-auth-client', environment.tokenVeriff);

  this.subscription.add(this.http.get('https://api.veriff.me/v1/sessions/'+session_id+'/person', { 'headers': headers })
    .subscribe(async (res: any) => {
      if(res.status=='success'){
        this.infoVerified.info = res.person;
        let dateOfBirth = res.person.dateOfBirth; // fecha en formato "1970-01-01"

        // Crear las fechas de hoy y de nacimiento
        let today = new Date();
        let birthDate = new Date(dateOfBirth);

        // Calcular la diferencia de años
        let age = today.getFullYear() - birthDate.getFullYear();

        // Ajustar la edad si el cumpleaños de este año aún no ha ocurrido
        if (birthDate.getMonth() > today.getMonth() || 
            (birthDate.getMonth() === today.getMonth() && birthDate.getDate() > today.getDate())) {
            age--;
        }
        // Verificar si la persona es menor de 18 años
        if (age < 18) {
            this.infoVerified.status = 'declined';
            this.infoVerified.info.value = 'Underage';
            this.infoVerified.isVerified = false;
        }

      }
      try {
        await this.saveDataVerfified();  // Espera a que la promesa se resuelva antes de emitir
        if (this.infoVerified.isVerified) {
          this.isVerifiedEmmited.emit(this.infoVerified.isVerified);
        }
      } catch (err) {
        console.error('Error al guardar los datos verificados', err);
      }
      
    }, (err) => {
      console.log(err);
    }));
}


createSesion(){
  var date = new Date();
  date.toISOString();
  var params = {"verification":{"person":{"firstName":this.userInfo.userName,"lastName":this.userInfo.lastName},"vendorData":this.userInfo.idUser,"timestamp":date}};
  console.log(params)
  this.subscription.add(this.http.post('https://api.veriff.me/v1/sessions', params)
    .subscribe(async (res: any) => {
      this.infoVerified.url = res.verification.url;
      this.infoVerified.status = res.verification.status;
      try {
        await this.saveDataVerfified();
      } catch (err) {
        console.error('Error al guardar los datos verificados', err);
      }
      if(res.verification.status=='created'){
        window.veriffSDK.createVeriffFrame({ url: this.infoVerified.url, 
          onEvent: async function(msg) {
            console.log(msg)
            if(msg=='FINISHED'){
              this.infoVerified.status = 'submitted';
              try {
                await this.saveDataVerfified();
              } catch (err) {
                console.error('Error al guardar los datos verificados', err);
              }
              this.getUserInfo(true);
            }
        }.bind(this) });
      }
    }, (err) => {
      console.log(err);
    }));
}

getVerified() {
  if(this.infoVerified.status=='Not started'){
    this.createSesion();
  }else if(this.infoVerified.status=='created'){
        window.veriffSDK.createVeriffFrame({ url: this.infoVerified.url, 
          onEvent: async function(msg) {
            console.log(msg)
          if(msg=='FINISHED'){
            this.infoVerified.status = 'submitted';
            try {
              await this.saveDataVerfified();
            } catch (err) {
              console.error('Error al guardar los datos verificados', err);
            }
            await this.delay(10000);
            this.getUserInfo(true);
          }else{
            this.verifyStatus();
          }
        }.bind(this) });
  }else if(this.infoVerified.status=='submitted'){
    this.verifyStatus();
  }else{
    this.verifyStatus();
  }
}

delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

verifyStatus(){
  var token = this.infoVerified.url.split('https://magic.veriff.me/v/');
  const headers= new HttpHeaders()
  .set('Authorization', 'Bearer '+token[1]);
  this.subscription.add(this.http.get('https://alchemy.veriff.com/api/v2/sessions', { 'headers': headers })
      .subscribe(async (res: any) => {
        console.log(res)
        this.infoVerified.status = res.status;
        if(this.infoVerified.status=='completed'){
          if(res.activeVerificationSession.status=='declined'){
            this.infoVerified.status='declined';
            this.infoVerified.info = res.activeVerificationSession.verificationRejectionCategory;
            this.infoVerified.isVerified = false;
          }else{
            this.infoVerified.isVerified = true;
            
            this.saveDataVeriff();
            Swal.fire(this.translate.instant("identity.t3"), '', "success");
            //this.getPatients();
            
          }
          
        }else if(this.infoVerified.status=='submitted' && res.previousVerificationSessions.length>0){
          this.infoVerified.status = 'resubmission_requested';
          this.infoVerified.info = res.previousVerificationSessions[0].verificationRejectionCategory;
          if(res.previousVerificationSessions[0].status=='resubmission_requested'){
            Swal.fire({
              title: this.translate.instant("identity.t5"),
              html: this.translate.instant("identity.t6"),
              icon: 'warning',
              showCancelButton: false,
              confirmButtonColor: '#2F8BE6',
              cancelButtonColor: '#B0B6BB',
              confirmButtonText: 'Ok',
              showLoaderOnConfirm: true,
              allowOutsideClick: false
          }).then((result) => {
            if (result.value) {
            window.veriffSDK.createVeriffFrame({ url: this.infoVerified.url, 
              onEvent: async function(msg) {
                
              if(msg=='FINISHED'){
                this.infoVerified.status = 'submitted';
                try {
                  await this.saveDataVerfified();
                } catch (err) {
                  console.error('Error al guardar los datos verificados', err);
                }
                await this.delay(10000);
                this.getUserInfo(true);
              }
            }.bind(this) });
            }
          });

            
          }

        }else if(this.infoVerified.status=='submitted'){
          (async () => { 
            await this.delay(10000);
            this.getUserInfo(true);
           })();
        }else if(this.infoVerified.status=='expired' || this.infoVerified.status=='abandoned'){
          //this.infoVerified.status=='Not started';
          this.createSesion();
        }else if(this.infoVerified.status=='started'){
          this.createSesion();
        }
        try {
          await this.saveDataVerfified();
        } catch (err) {
          console.error('Error al guardar los datos verificados', err);
        }
        
        //Resubmission
        //Declined
        //Approved
        //Expired
        //Abandoned

      }, (err) => {
        console.log(err);
      }));
}

saveDataVerfified(): Promise<any> {
  return new Promise((resolve, reject) => {
    var paramssend = { infoVerified: this.infoVerified };
    this.subscription.add(this.http.post(environment.api+'/api/verified/'+this.authService.getIdUser(), paramssend)
      .subscribe((res: any) => {
        resolve(res);  // Resuelve la promesa cuando la subscripción sea exitosa
      }, (err) => {
        console.error(err.error);
        reject(err);  // Rechaza la promesa si hay un error
      }));
  });
}
}