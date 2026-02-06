import { Component, ViewChild, OnDestroy, OnInit, Input, NgZone } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from "@angular/router";
import { AuthService } from '../../../../app/shared/auth/auth.service';
import { AuthServiceFirebase } from "../../../../app/shared/services/auth.service.firebase";
import { GoCertiusService } from "app/shared/services/gocertius.service";
import { PatientService } from 'app/shared/services/patient.service';
import { ApiDx29ServerService } from 'app/shared/services/api-dx29-server.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
declare var YT: any;
import { v4 as uuidv4 } from 'uuid';
import CryptoES from 'crypto-es';

@Component({
    selector: 'app-logincomp-page',
    templateUrl: './logincomp-page.component.html',
    styleUrls: ['./logincomp-page.component.scss']
})

export class LoginCompPageComponent implements OnDestroy, OnInit{

    @ViewChild('f') loginForm: NgForm;
    //loginForm: FormGroup;
    sending: boolean = false;

    isBlockedAccount: boolean = false;
    isLoginFailed: boolean = false;
    isLoginFailed2: boolean = false;
    errorAccountActivated: boolean = false;
    emailResent: boolean = false;
    supportContacted: boolean = false;
    isAccountActivated: boolean = false;
    isActivationPending: boolean = false;
    isBlocked: boolean = false;
    email: string;
    userEmail: string;
    private subscription: Subscription = new Subscription();
    private subscription2: Subscription = new Subscription();
    private subscriptionIntervals: Subscription = new Subscription();
    startTime: Date = null;
    finishTime: Date = null;
    isApp: boolean = document.URL.indexOf( 'http://' ) === -1 && document.URL.indexOf( 'https://' ) === -1 && location.hostname != "localhost" && location.hostname != "127.0.0.1";

    user: any;
  haveToken: boolean = false;
  isLoading: boolean = false;
  isLoading2: boolean = false;
  showTryAgain: boolean = false;
  @Input() mode: string;
  modalReference: NgbModalRef;
  videoEnded: boolean = false;
  panelmode: string = 'login';

  player: any;
  videoDuration: number = 0;
  currentTime: number = 0;
  progressInterval: any;


  caseFileId: string = 'f2dba3ed-1189-46a9-b6e5-0846dacd109f';//uuidv4();
  evidenceGroupId: string = 'd8bff35a-fd6b-46f6-b3f6-069b9b572742';
  evidenceList: any[] = [];
  reportId: string = '935f5aaf-b344-487c-8bf2-515c31c3cbec';
  evicenceIdVideo: string = '98bf1120-4bf6-4ce5-ace0-233e326cadf5';
  listEvidences: any[] = [];

    constructor(private router: Router, public authService: AuthService, public translate: TranslateService, public toastr: ToastrService, public authServiceFirebase: AuthServiceFirebase, private modalService: NgbModal, private ngZone: NgZone, private goCertiusService: GoCertiusService, private http: HttpClient, private patientService: PatientService, private apiDx29ServerService: ApiDx29ServerService, private route: ActivatedRoute) {
      // Solo redirigir si hay una sesión válida confirmada (no mientras se verifica)
      if(this.authService.getEnvironment() && this.authService.isAuthenticated() && this.authService.getIdUser()){

        var param = this.router.parseUrl(this.router.url).queryParams;
        if (param.key && param.token) {
          //logout
          this.authService.logout2();

        } else {
          this.translate.use(this.authService.getLang());
          localStorage.setItem('lang', this.authService.getLang());
          let url =  this.authService.getRedirectUrl();
          this.router.navigate([ url ]);
        }
        /*let url =  this.authService.getRedirectUrl();
        this.router.navigate([ url ]);*/
      }
      
     }

     getInvitationParams() {
      const params = {};
      if (this.route.snapshot.queryParams['key']) {
        params['key'] = this.route.snapshot.queryParams['key'];
      }
      if (this.route.snapshot.queryParams['token']) {
        params['token'] = this.route.snapshot.queryParams['token'];
      }
      return params;
    }

     ngOnInit() {
      console.log(this.mode)
      this.checkMode();
       const urlParams = new URLSearchParams(window.location.search);
        const email = decodeURIComponent(urlParams.get('email') || '');
        this.caseFileId = urlParams.get('caseFileId') || '';
        this.evidenceGroupId = urlParams.get('evidenceGroupId') || '';
        this.evidenceList = urlParams.get('listEvidences') ? JSON.parse(urlParams.get('listEvidences')) : [];
        console.log(this.caseFileId, this.evidenceGroupId, this.evidenceList);
        this.showTryAgain = false;
        if (this.authServiceFirebase.afAuth.isSignInWithEmailLink(window.location.href) && email) {
            this.isLoading = true;
        this.authServiceFirebase.afAuth.signInWithEmailLink(email, window.location.href)
          .then(async (result) => {
            this.showTryAgain = false;
            // Obtiene el token de ID del usuario autenticado
            const idToken = await result.user.getIdToken();
            // El usuario ha sido autenticado correctamente.
            this.callToLogin(idToken);
            
          })
          .catch(error => {
            this.showTryAgain = true;
            this.isLoading = false;
            //console.error("Error signing in with email link", error);
          });
      }
      
       
      }

      async checkMode(){
        this.panelmode = this.mode;
        if(this.mode=='register'){
          await this.delay(500); 
          this.loadYoutubeApi();
          //this.createCaseFileVideo();
          //this.createCaseFile();
          //this.getCaseFile(this.caseFileId);
          //this.createEvidenceGroup(this.caseFileId);
          //this.getEvidenceGroup(this.caseFileId, '4f10620a-47a5-4beb-b7f2-3e7a97257e7c');
          //this.getEvidenceGroupList();
          //this.getEvidenceList();
          //this.closeEvidenceGroup();
          //this.updateCaseFile('133541f42098e7f53a86ff4ffb6933e42584f597a8b0f5c7b060ed30f462a6ff', this.caseFileId);
          //this.generateReport();
          //this.generateReportVideo();
          //this.getReportPdfUrl(this.reportId);
          //this.getReportZip(this.reportId);
        }
      }

      delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      async showConsent(content) {
        let ngbModalOptions: NgbModalOptions = {
          keyboard: false,
          backdrop: 'static',
          windowClass: 'ModalClass-lg' // xl, lg, sm
        };
        if (this.modalReference != undefined) {
          this.modalReference.close();
          this.modalReference = undefined;
        }
        this.modalReference = this.modalService.open(content, ngbModalOptions);
        await this.delay(200)
        document.getElementById('contentPrivacy').scrollIntoView(true);
      }

      async closeModal() {

        if (this.modalReference != undefined) {
          this.modalReference.close();
          this.modalReference = undefined;
        }
      }
    
      checkConsent(){
        if(!this.videoEnded){
          Swal.fire({
            html: '<p class="mt-2">'+this.translate.instant("wizard.legaltext")+'</p>',
            icon: 'error',
            showCancelButton: false,
            confirmButtonColor: '#DD6B55',
            confirmButtonText: 'Ok'
          })
        }else{
          this.acceptConsent();
        }
      }

      acceptConsent() {
        if(this.videoEnded){
          //this.regVideo();
        }else{
          //this.regPolicyPrivacy();
        }
        this.closeModal();
        this.panelmode='login'
      }
    
      loadYoutubeApi() {
        if (window['YT']) { // Chequea si el API de YouTube ya ha sido cargado
          this.initVideoPlayer();
        } else {
          // Crea el <script> tag y lo añade al DOM solo si no existe
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
          // Configura una función de callback para cuando el API esté lista
          window['onYouTubeIframeAPIReady'] = () => this.initVideoPlayer();
        }
      }

      initVideoPlayer() {
        // Inicializa el reproductor de YouTube
        this.player = new YT.Player('player', {
          height: '100%', // Ahora se maneja con CSS
          width: '100%', // Ahora se maneja con CSS
          videoId: 'RTAmHX2lHdc', // Tu ID de video aquí
          playerVars: {
              'controls': 0, // Oculta los controles del reproductor
              'rel': 0, // Opcional: evita que se muestren videos relacionados al final
              'showinfo': 0, // Opcional: para versiones anteriores, evita mostrar la información del video
              'modestbranding': 1 // Opcional: limita la marca de YouTube en el control del reproductor
          },
          events: {
              'onStateChange': this.onPlayerStateChange.bind(this),
              'onReady': this.onPlayerReady.bind(this)
          }
      });
      }
    
      onPlayerStateChange(event) {
        // Habilita el botón cuando el video termine
        if (event.data === YT.PlayerState.ENDED) {
          this.ngZone.run(() => {
            this.videoEnded = true;
        });
        }
      }

      onPlayerReady(event) {
        this.player = event.target;
        // Obtener la duración total del video cuando esté listo
        this.videoDuration = this.player.getDuration();
        
        // Iniciar el intervalo para actualizar el progreso
        this.progressInterval = setInterval(() => {
          if (this.player.getPlayerState() === YT.PlayerState.PLAYING) {
            this.ngZone.run(() => {
              this.currentTime = this.player.getCurrentTime();
            });
          }
        }, 1000);
      }

      getRemainingTime(): number {
        return Math.ceil(this.videoDuration - this.currentTime);
      }


      setAccessToPatient(patientId, token, location, idToken) {
        this.subscription.add(this.patientService.setAccessToPatient(patientId, token, location, idToken)
          .subscribe((res: any) => {
            if(res.message=='needAccepted'){
              //swal
              //se le ha enviado un correo para que acepte el acceso
              Swal.fire({
                title: this.translate.instant('messages.m6.1'),
                text: this.translate.instant("messages.m6.3"),
                icon: 'warning',
                confirmButtonText: this.translate.instant("generics.Close")
              });
            }else if(res.userid && res.message=='Done'){
              // Si hay paciente seleccionado, ir a home; si no, ir a patients
              if (this.authService.getCurrentPatient()) {
                this.router.navigate(['/home']);
              } else {
                this.router.navigate(['/patients']);
              }
            }   
            
          }, (err) => {
            console.log(err);
            let url =  this.authService.getRedirectUrl();
            this.router.navigate([ url ]);
          }));
      }

      callToLogin(idToken){
        var info = {idToken:idToken, lang: localStorage.getItem('lang'), mode: this.mode};
        this.subscription2 = this.authService.login(info).subscribe(
          authenticated => {
          //this.loginForm.reset();
          if(authenticated) {
            if(this.mode=='register'){
              this.caseFileId = localStorage.getItem('tempCaseFileId');
              //this.updateCaseFile(this.authService.getIdUser(), this.caseFileId);
            }else if(this.mode=='login'){
              //get casefile, evidencegroup and evidences
            }
            this.haveToken = true;
              //this.translate.setDefaultLang( this.authService.getLang() );
              this.translate.use(this.authService.getLang());
              localStorage.setItem('lang', this.authService.getLang());
              this.checkLocation(idToken);
              this.sending = false;
              this.isLoading = false;
              this.isLoading2 = false;
          }else {
            this.isLoading = false;
            this.isLoading2 = false;
            this.haveToken = false;
            this.sending = false;
            let message =  this.authService.getMessage();
              if(message == "Sign in failed" || message == "Not found"){
                  this.isLoginFailed = true;
                }else{
                this.toastr.error('', message);
              }
          }
          }
      );
      }

      checkLocation(idToken){
        var param = this.router.parseUrl(this.router.url).queryParams;
        if (param.key && param.token) {
          this.getLocationInfo(param.key, param.token, idToken);
        } else {
          let url =  this.authService.getRedirectUrl();
          this.router.navigate([ url ]);
        }
      }

      async getLocationInfo(patientId, token, idToken) {
        const browserInfo = {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform
        };
        this.subscription.add(this.apiDx29ServerService.getInfoLocation()
          .subscribe((res: any) => {
            console.log(res)
            if(res.security.is_vpn){
              //show message ti say that is vpn active and cant asign access to patient if not disconnect vpn. Desactivelo y vuelva a acceder al link de invitación
              Swal.fire({
                title: this.translate.instant('open.VPN active'),
                text: this.translate.instant("open.VPN active description"),
                icon: 'warning',
                confirmButtonText: this.translate.instant("generics.Close")
              });
            }else{
              console.log(this.authService.getIdUser())
              let location = {
                platform: browserInfo.platform,
                userAgent: browserInfo.userAgent,
                city: res.city,
                country: res.country,
                latitude: res.latitude,
                longitude: res.longitude,
                postal_code: res.postal_code,
                idToken: idToken,
                userId: this.authService.getIdUser()
              }
              this.setAccessToPatient(patientId, token, location, idToken);
            }
            
          }, async (err) => {
            await this.delay(1000); 
            this.getLocationInfo(patientId, token, idToken);
            console.log(err);
          }));
      }
      

     ngOnDestroy() {
       if(this.subscription) {
            this.subscription.unsubscribe();
        }
       if(this.subscriptionIntervals) {
            this.subscriptionIntervals.unsubscribe();
        }
         if(this.subscription2) {
          this.subscription2.unsubscribe();
        }

        if (this.progressInterval) {
          clearInterval(this.progressInterval);
        }
     }

     submitInvalidForm() {
       if (!this.loginForm) { return; }
       const base = this.loginForm;
       for (const field in base.form.controls) {
         if (!base.form.controls[field].valid) {
             base.form.controls[field].markAsTouched()
         }
       }
     }

    // On registration link click
    onRegister() {
        this.router.navigate(['/register']);
    }

    sendSignInLink(email: string, event?: Event) {
      this.authServiceFirebase.afAuth.languageCode = Promise.resolve(localStorage.getItem('lang'));
      this.isLoginFailed = false;
      this.isLoginFailed2 = false;
      if(event) {
        event.preventDefault();  // Evita el envío real del formulario
    }
    let ruta = '/login';
    if(this.mode=='register'){
      ruta = '/register';
    }

    this.listEvidences = [];
      for (const evidence of this.evidenceList) {
        this.listEvidences.push({
          "id": evidence.evidenceId,
          "title": evidence.title
        });
      }

      const invitationParams = this.getInvitationParams();
      
      return this.authServiceFirebase.sendSignInLink(email, ruta, this.caseFileId, this.evidenceGroupId, this.listEvidences, invitationParams)
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
      this.isLoginFailed2 = false;
      var resp = null;
      if(method == 'google'){
        resp = await this.authServiceFirebase.GoogleAuth();
      }else if(method == 'microsoft'){
        resp = await this.authServiceFirebase.signInWithMicrosoft();
      }else if(method == 'apple'){
        resp = await this.authServiceFirebase.signInWithApple();
      }
      if(resp!=null){
        this.callToLogin(resp);
      }else{
        this.isLoading2 = false;
        this.isLoginFailed2 = true;
      }
      
    }

    changeMode(mode: string) {
      this.mode = mode;
    }


    createCaseFile(){
      this.caseFileId = uuidv4();
      console.log(this.caseFileId)

      const caseFileData = {
        "id": this.caseFileId,
        "title": "Registro temporal "+this.caseFileId,
        "code": this.caseFileId,
        "category": "Registro",
      };

      const caseFileData2 = {
        "id": this.caseFileId,
        "title": "Registro temporal "+this.caseFileId,
        "code": this.caseFileId,  // Genera un UUID o similar
        "description": "Registro temporal en nav29.org",
        "category": "Registro",
        "metadata": {
          "ipAddress": "127.0.0.1",
          "timestamp": new Date().toISOString(),
          "sessionId": "1234567890"
        }
      };
      this.goCertiusService.createCaseFile(caseFileData).subscribe(
        (response) => {
          console.log('Case File created:', response);
          // Guarda el caseFileId en el almacenamiento local para usarlo más tarde
          localStorage.setItem('tempCaseFileId', this.caseFileId);
          //localStorage.setItem('tempCaseFileId', response.id);
          this.createEvidenceGroup(this.caseFileId);
        },
        (error) => {
          console.error('Error creating Case File:', error);
        }
      );
    }

    getCaseFile(caseFileId: string){
      this.goCertiusService.getCaseFile(caseFileId).subscribe(
        (response) => {
          console.log('Case File:', response);
        },
        (error) => {
          console.error('Error getting Case File:', error);
        }
      );
    }

    updateCaseFile(idUser: string, caseFileId: string){
      const caseFileData0 = {
        "code": idUser,
      };
      const caseFileData = {
        "metadata": {
          "idUser": idUser,
          "timestamp": new Date().toISOString()
        }
      };

      this.goCertiusService.updateCaseFile(caseFileId, caseFileData).subscribe(
        (response) => {
          console.log('Case File updated:', response);
          this.closeEvidenceGroup();
        },
        (error) => {
          console.error('Error updating Case File:', error);
        }
      );
    }
      
    //create evidence group
    createEvidenceGroup(caseFileId: string){
      const tempEvidenceGroupId = uuidv4();
      console.log(tempEvidenceGroupId)
      const evidenceGroupData = {
        "id": tempEvidenceGroupId,
        "type": "FILE",
        "code": tempEvidenceGroupId
      };
      this.goCertiusService.createEvidenceGroup(caseFileId, evidenceGroupData).subscribe(
        (response) => {
          console.log('Evidence Group created:', response);
          //this.evidenceGroupId = response.id;
          this.evidenceGroupId = tempEvidenceGroupId;
        },
        (error) => {
          console.error('Error creating Evidence Group:', error);
        }
      );
    }

   


    async regVideo(){
      const videoData = {
        videoUrl: "https://www.youtube.com/watch?v=RTAmHX2lHdc",
        viewedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        evidenceId: '9c350e0a-3bad-4541-ae5d-5cca92830776',
        videoHash: '0ddf9ccd0e770303bed2c256c24a73b33f46dc6b7255d61108dbd839f966c9a4',
      };
      const videoDataString = JSON.stringify(videoData);
      const videoDataBlob = new Blob([videoDataString], { type: 'application/json' });
    
      const { hexHash, base64Hash } = await this.calculateSHA256(videoDataBlob);
    
      const evidenceData = {
        "evidenceId": uuidv4(),
        "title": "Aceptación del consentimiento - Visualización del video de consentimiento",
        "hash": hexHash,
        "capturedAt": new Date().toISOString(),
        "custodyType": "INTERNAL",
        "fileName": "video_view.json",
        "testimony": {
          "TSP": {
            "required": true,
            "providers": [
              "EADTrust"
            ]
          }
        }
      };
      this.createEvidence(evidenceData, videoDataBlob, base64Hash);
    }

    async regPolicyPrivacy(){
      const policyData = {
        policyVersion: "1.0", // Update this with your actual policy version
        acceptedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      };
      const policyDataString = JSON.stringify(policyData);
      const policyDataBlob = new Blob([policyDataString], { type: 'application/json' });
    
      const { hexHash, base64Hash } = await this.calculateSHA256(policyDataBlob);
    
      const evidenceData = {
        "evidenceId": uuidv4(),
        "title": "Aceptación del consentimiento - Visualización de la política de privacidad",
        "hash": hexHash,
        "capturedAt": new Date().toISOString(),
        "custodyType": "INTERNAL",//EXTERNAL
        "fileName": "privacy_policy_view.json",
        "testimony": {
          "TSP": {
            "required": true,
            "providers": [
              "EADTrust"
            ]
          }
        }
      };
      this.createEvidence(evidenceData, policyDataBlob, base64Hash);
    }

    async regAcceptConsent(){
      const consentData = {
        consentVersion: "1.0", // Update this with your actual consent version
        acceptedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      };
      const consentDataString = JSON.stringify(consentData);
      const consentDataBlob = new Blob([consentDataString], { type: 'application/json' });
    
      const { hexHash, base64Hash } = await this.calculateSHA256(consentDataBlob);


      const evidenceData = 
      {
        "evidenceId": uuidv4(),
        "title": "Creación de la cuenta",
        "hash": hexHash,
        "capturedAt": new Date().toISOString(),
        "custodyType": "INTERNAL",
        "fileName": "consent_acceptance.json",
        "testimony": {
          "additionalProp1": {
            "required": true,
            "providers": [
              "string"
            ]
          }
        }
      };
      this.createEvidence(evidenceData, consentDataBlob, base64Hash);
    }
    
    calculateSHA256(file: Blob): Promise<{ hexHash: string, base64Hash: string }> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          const wordArray = CryptoES.lib.WordArray.create(e.target?.result as ArrayBuffer);
          const hash = CryptoES.SHA256(wordArray);
          resolve({
            hexHash: hash.toString(CryptoES.enc.Hex),
            base64Hash: hash.toString(CryptoES.enc.Base64)
          });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
      });
    }

    //create evidence
    async createEvidence(evidenceData, fileBlob, base64Hash) {
      //post with two parameters this.caseFileId, and this.evidenceGroupId, and a body
      this.goCertiusService.createEvidence(this.caseFileId, this.evidenceGroupId, evidenceData).subscribe(
        async (response) => {
          console.log('Evidence created:', response);
          this.evidenceList.push(evidenceData);
          console.log(this.evidenceList)
          // Now, upload the file
          if (response.url && evidenceData.custodyType == "INTERNAL") {
            try {
              await this.uploadFile(response.url, response.expiration, fileBlob, base64Hash, evidenceData.id);
              console.log('File uploaded successfully');
            } catch (error) {
              console.error('Error uploading file:', error);
            }
          }
        },
        (error) => {
          console.error('Error creating Evidence:', error);
        }
      );
    }

    async getEvidenceUploadUrl(uploadUrl: string, expiration: string, fileBlob: Blob, base64Hash: string, evidenceId: string) {

      this.goCertiusService.getEvidenceUploadUrl(this.caseFileId, this.evidenceGroupId, evidenceId).subscribe(
        (response) => {
          console.log('Evidence Upload URL:', response);
        },
        (error) => {
          console.error('Error getting Evidence Upload URL:', error);
        }
      );
      
    }

    async uploadFile(uploadUrl: string, expiration: string, fileBlob: Blob, base64Hash: string, evidenceId: string) {
      this.goCertiusService.uploadFile(uploadUrl, expiration, fileBlob, base64Hash, evidenceId).subscribe(
        (response) => {
          console.log('File uploaded successfully:', response);
        },
        (error) => {
          console.error('Error uploading file:', error);
        }
      );
    }

    getEvidenceGroupList(){
      this.goCertiusService.getEvidenceGroupList().subscribe(
        (response) => {
          console.log('Evidence Group List:', response);
        },
        (error) => {
          console.error('Error getting Evidence Group List:', error);
        }
      );
    }

    getEvidenceGroup(caseFileId: string, evidenceGroupId: string){
      this.goCertiusService.getEvidenceGroup(caseFileId, evidenceGroupId).subscribe(
        (response) => {
          console.log('Evidence Group:', response);
        },
        (error) => {
          console.error('Error getting Evidence Group:', error);
        }
      );
    }

    closeEvidenceGroup(){
      console.log(this.evidenceList)
      const data = {
        "evidencesCount": this.evidenceList.length,
        "collectMetadata": {
          "ipAddress": "127.0.0.1",
          "timestamp": new Date().toISOString(),
          "sessionId": "1234567890"
        }
      };
        
      this.goCertiusService.closeEvidenceGroup(this.caseFileId, this.evidenceGroupId, data).subscribe(
        (response) => {
          console.log('Evidence Group closed:', response);
          console.log(this.evidenceList)
          this.generateReport();
        },
        (error) => {
          console.error('Error closing Evidence Group:', error);
        }
      );
    }

    generateReport(){
      /*this.goCertiusService.getEvidenceList().subscribe(
        (response) => {
          console.log('Evidence List:', response);
        },
        (error) => {
          console.error('Error getting Evidence List:', error);
        }
      );*/
      // for each evidence in the this.evidenceList, get the evidence
      this.listEvidences = [];
      for (const evidence of this.evidenceList) {
        this.listEvidences.push({
          "id": evidence.evidenceId,
          "title": evidence.title
        });
      }
      this.reportId = uuidv4();
      const info = {
        "reportId": this.reportId,
        "template": "Certificate_1certius",
        "languageCode": "es_ES",
        "data": {
          "groups": [
            {
              "id": this.evidenceGroupId,
              "code": this.evidenceGroupId,
              "name": "Consentimiento y visualización de política de privacidad",
              "type": "FILE",
              "capturedFrom": "2024-09-24T10:11:37.872Z",
              "capturedUntil": "2024-09-24T23:59:59Z",
              "evidences": this.listEvidences
            }
          ]
        }
      }
      this.goCertiusService.generateReport(this.caseFileId, info).subscribe(
        (response) => {
          console.log('Report generated:', response);
        },
        (error) => {
          console.error('Error generating Report:', error);
        }
      );
    }

    getReportPdfUrl(reportId: string){
      this.goCertiusService.getReportPdfUrl(reportId).subscribe(
        (response) => {
          console.log('Report PDF URL:', response);
        },
        (error) => {
          console.error('Error getting Report PDF URL:', error);
        }
      );
    }

    getReportZip(reportId: string){
      this.goCertiusService.getReportZip(reportId).subscribe(
        (response) => {
          console.log('Report ZIP:', response);
        },
        (error) => {
          console.error('Error getting Report ZIP:', error);
        }
      );
    }

    createCaseFileVideo(){
      this.caseFileId = uuidv4();
      console.log(this.caseFileId)

      const caseFileData = {
        "id": this.caseFileId,
        "title": "Crear evidencia del video "+this.caseFileId,
        "code": this.caseFileId,
        "category": "Hash Video",
      };

      this.goCertiusService.createCaseFile(caseFileData).subscribe(
        (response) => {
          console.log('Case File created:', response);
          // Guarda el caseFileId en el almacenamiento local para usarlo más tarde
          localStorage.setItem('tempCaseFileId', this.caseFileId);
          //localStorage.setItem('tempCaseFileId', response.id);
          const tempEvidenceGroupId = uuidv4();
          console.log(tempEvidenceGroupId)
          const evidenceGroupData = {
            "id": tempEvidenceGroupId,
            "type": "FILE",
            "code": tempEvidenceGroupId
          };
          this.goCertiusService.createEvidenceGroup(this.caseFileId, evidenceGroupData).subscribe(
            (response) => {
              console.log('Evidence Group created:', response);
              //this.evidenceGroupId = response.id;
              this.evidenceGroupId = tempEvidenceGroupId;
              this.createEvidenceVideoYoutube();
            },
            (error) => {
              console.error('Error creating Evidence Group:', error);
            }
          );
        },
        (error) => {
          console.error('Error creating Case File:', error);
        }
      );
    }

    async readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", filePath, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('Failed to load file'));
          }
        };
        xhr.onerror = function () {
          reject(new Error('XHR error'));
        };
        xhr.send();
      });
    }

    async createEvidenceVideoYoutube() {
      const videoPath = "assets/videos/Consentimiento informado Nav29.mp4";
      const videoFile = await this.readFileAsArrayBuffer(videoPath);
      const videoBlob = new Blob([videoFile], { type: 'video/mp4' });
      
      const { hexHash, base64Hash } = await this.calculateSHA256(videoBlob);
    
      this.evicenceIdVideo = uuidv4();
      const videoEvidenceData = {
        "evidenceId": this.evicenceIdVideo,
        "title": "Video de consentimiento",
        "hash": hexHash,
        "capturedAt": new Date().toISOString(),
        "custodyType": "INTERNAL",
        "fileName": "Consentimiento informado Nav29.mp4",
        "testimony": {
          "TSP": {
            "required": true,
            "providers": ["EADTrust"]
          }
        }
      };
    
      this.goCertiusService.createEvidence(this.caseFileId, this.evidenceGroupId, videoEvidenceData).subscribe(
        async (response) => {
          console.log('Evidence created:', response);
          
          if (response.url) {
            try {
              await this.uploadFile(response.url, response.expiration, videoBlob, base64Hash, videoEvidenceData.evidenceId);
              console.log('Video evidence file uploaded successfully');
              
              // Aquí podrías cerrar el grupo de evidencias y generar el reporte si es necesario
              this.closeEvidenceGroupVideo();
            } catch (error) {
              console.error('Error uploading video evidence file:', error);
            }
          }
        },
        (error) => {
          console.error('Error creating video Evidence:', error);
        }
      );
    }

    //this.goCertiusService.getEvidenceList()
    getEvidenceList(){
      this.goCertiusService.getEvidenceList().subscribe(
        (response) => {
          console.log('Evidence List:', response);
        },
        (error) => {
          console.error('Error getting Evidence List:', error);
        }
      );
    }

    closeEvidenceGroupVideo(){
      const data = {
        "evidencesCount": 1,
        "collectMetadata": {
          "ipAddress": "127.0.0.1",
          "timestamp": new Date().toISOString(),
          "sessionId": "1234567890"
        }
      };
        
      this.goCertiusService.closeEvidenceGroup(this.caseFileId, this.evidenceGroupId, data).subscribe(
        (response) => {
          console.log('Evidence Group closed:', response);
          console.log(this.evidenceList)
          //wait 10 seconds to generate the report
          setTimeout(() => {
            this.generateReportVideo();
          }, 10000);
        },
        (error) => {
          console.error('Error closing Evidence Group:', error);
        }
      );
    }

    generateReportVideo(){
      /*this.goCertiusService.getEvidenceList().subscribe(
        (response) => {
          console.log('Evidence List:', response);
        },
        (error) => {
          console.error('Error getting Evidence List:', error);
        }
      );*/
      this.reportId = uuidv4();
      const info = {
        "reportId": this.reportId,
        "template": "Certificate_1certius",
        "languageCode": "es_ES",
        "data": {
          "groups": [
            {
              "id": this.evidenceGroupId,
              "code": this.evidenceGroupId,
              "name": "Creación del report del vídeo de Youtube",
              "type": "FILE",
              "capturedFrom": "2024-09-24T10:11:37.872Z",
              "capturedUntil": "2024-09-24T23:59:59Z",
              "evidences": [
                {
                  "id": this.evicenceIdVideo,
                  "title": "Video de consentimiento",
                }
              ]
            }
          ]
        },
        "additionalData": {
          "additionalProp1": "sample"
        }
      }
      
      this.goCertiusService.generateReport(this.caseFileId, info).subscribe(
        (response) => {
          console.log('Report generated:', response);
        },
        (error) => {
          console.error('Error generating Report:', error);
        }
      );
    }

}
