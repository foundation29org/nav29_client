import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from "@angular/router";
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { AuthService } from '../../../app/shared/auth/auth.service';
import { PatientService } from 'app/shared/services/patient.service';
import { AuthGuard } from 'app/shared/auth/auth-guard.service';
import { DateService } from 'app/shared/services/date.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import * as datos from './icons.json';
import { jsPDF } from "jspdf";
declare var webkitSpeechRecognition: any;

@Component({
  selector: 'app-new-patient',
  templateUrl: './new-patient.component.html',
  styleUrls: ['./new-patient.component.scss']
})

export class NewPatientComponent implements OnInit, OnDestroy {
  private subscription: Subscription = new Subscription();
  loadedPatientInfo: boolean = false;
  startOpt: string = '';
  stepPhoto = 1;
  capturedImage: any;
  modalReference: NgbModalRef;
  nameFileCamera: string = '';
  docs: any = [];
  tempDocs: any = [];
  isCheckingDocsStatus = false;
  totalTokens = 0;
  containerName: string = '';
  currentPatient: string = '';
  actualPatient: any = {};
  icons: any = (datos as any).default;
  initialEvents: any[] = [];
  medicalLevel: string = '1';

  loadingInitialEvents: boolean = true;
  initialEventsForm: FormGroup;
  eventsForm: FormGroup;
  submitted = false;
  submitted2 = false;
  isFirstPatient = true;
  genderOptions = [
  ];
  stepform = 0;
  private messageSubscription: Subscription;
  maxDate: Date;

  havetreatment = false;
  havediagnosis = false;

  recognition: any;
  recording = false;
  supported = false;
  timer: number = 0;
  timerDisplay: string = '00:00';
  private interval: any;
  medicalText: string = '';
  summaryDx29: string = '';
  tempFileName: string = '';
  showCameraButton: boolean = false;
  preferredResponseLanguage: string = '';


  constructor(private patientService: PatientService, private router: Router, private modalService: NgbModal, public toastr: ToastrService, public translate: TranslateService, private http: HttpClient, private authService: AuthService, private formBuilder: FormBuilder, private dateService: DateService, private authGuard: AuthGuard, public insightsService: InsightsService) {
    this.getTranslations();
  }

  getTranslations(){
    this.genderOptions = [
      { value: 'male', viewValue: this.translate.instant('personalinfo.Male') },
      { value: 'female', viewValue: this.translate.instant('personalinfo.Female') }
    ];
  }



  ngOnInit() {
    this.showCameraButton = this.isMobileDevice();
    this.maxDate = new Date();
    this.initEnvironment();
  }


  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }


  initEnvironment() {
    this.subscription.add(this.patientService.getContext()
      .subscribe((res: any) => {
        Swal.close();
        this.medicalLevel = res.medicalLevel;
        this.preferredResponseLanguage = res.preferredResponseLanguage;
        
        if (!res.hasPatients) {
          this.isFirstPatient = true;
          this.patientService.getPatientId().subscribe((res: any) => {
          });
          this.continuePatient(res);
        }else{
          this.isFirstPatient = false;
          //mostrar un mensaje diciendo que ya tiene un paciente y se va a crear uno nuevo (no eliminará el paciente actual ya que puede tener varios pacientes en la herramienta), preguntar si quiere continuar con la creación del nuevo paciente, si no, llevar a la pagina de home
          Swal.fire({
            title: this.translate.instant('messages.patientExistsTitle'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: this.translate.instant('messages.patientExistsTextCreate'),
            cancelButtonText: this.translate.instant('messages.patientExistsTextCancel')
          }).then((result) => {
            if (result.isConfirmed) {
              // User wants to create a new patient
              this.patientService.createPatient().subscribe((res: any) => {
                this.patientService.getPatientId().subscribe((res: any) => {
                });
                /*this.actualPatient = res.patientInfo;
                this.currentPatient = res.patientInfo.sub;
                this.containerName = this.currentPatient.substr(1);*/
                this.continuePatient(res);
              });
            } else {
              // User does not want to create a new patient, navigate to home
              this.router.navigate(['/home']);
            }
          });          
        }
     
        
      }, (err) => {
        this.loadedPatientInfo = true;
        console.log(err);
      }));
  }

  continuePatient(res: any){
    this.startOpt = '';
    if (res.patientInfo) {
      this.actualPatient = res.patientInfo;
      this.currentPatient = res.patientInfo.sub;
      // containerName ya no se calcula en cliente, el servidor lo determina
      this.containerName = '';
      this.ShowFormInitialEvents();
      this.authService.setCurrentPatient(this.actualPatient);
    }else{
      //ha ocurrido un error, informar al usuario, y despues de 2 segundos, recargar la página
      this.insightsService.trackException("Patient info not found");
      this.toastr.error('', this.translate.instant("generics.error try again"));
      setTimeout(() => {
        location.reload();
      }, 2000);
    }
    this.loadedPatientInfo = true;
  }

  async closeModal() {

    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
  }

  changeStartOpt(opt) {
    this.startOpt = opt;
    if(opt == 'form'){
      this.loadingInitialEvents = false;
    }
  }

  resetStartOpt() {
    this.startOpt = '';
    this.loadingInitialEvents = true;
  }

  async entryOpt(opt,content) {
    if(opt=='opt1'){
      this.stepPhoto = 1;
      let ngbModalOptions: NgbModalOptions = {
        keyboard: false,
        windowClass: 'ModalClass-sm' // xl, lg, sm
      };
      if (this.modalReference != undefined) {
        this.modalReference.close();
        this.modalReference = undefined;
      }
      this.modalReference = this.modalService.open(content, ngbModalOptions);
      await this.delay(200);
      this.openCamera();
    }else if(opt=='opt2'){
      this.setupRecognition();
      this.medicalText = '';
      this.summaryDx29 = '';
      if (this.modalReference != undefined) {
          this.modalReference.close();
      }
      let ngbModalOptions: NgbModalOptions = {
          backdrop: 'static',
          keyboard: false,
          windowClass: 'ModalClass-lg'
      };
      this.modalReference = this.modalService.open(content, ngbModalOptions);
    }
    
  }

  setupRecognition() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      // El navegador soporta la funcionalidad
      console.log('soporta')
      this.recognition = new webkitSpeechRecognition();
      let lang = localStorage.getItem('lang');
      if(lang == 'en'){
        this.recognition.lang = 'en-US';
      }else if(lang == 'es'){
        this.recognition.lang = 'es-ES';
      }else if(lang == 'fr'){
        this.recognition.lang = 'fr-FR';
      }else if(lang == 'de'){
        this.recognition.lang = 'de-DE';
      }else if(lang == 'it'){
        this.recognition.lang = 'it-IT';
      }else if(lang == 'pt'){
        this.recognition.lang = 'pt-PT';
      }
      this.recognition.continuous = true;
      this.recognition.maxAlternatives = 3;
      this.supported = true;
    } else {
      // El navegador no soporta la funcionalidad
      this.supported = false;
      console.log('no soporta')
    }
  }

  startTimer(restartClock) {
    if(restartClock){
      this.timer = 0;
      this.timerDisplay = '00:00';
    }
    this.interval = setInterval(() => {
      this.timer++;
      this.timerDisplay = this.secondsToDisplay(this.timer);
    }, 1000);
  }
  
  stopTimer() {
    clearInterval(this.interval);
    this.timerDisplay = this.secondsToDisplay(this.timer);
  }
  
  secondsToDisplay(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  toggleRecording() {
    if (this.recording) {
      //mosstrar el swal durante dos segundos diciendo que es está procesando
      Swal.fire({
        title: this.translate.instant("voice.Processing audio..."),
        html: this.translate.instant("voice.Please wait a few seconds."),
        showCancelButton: false,
        showConfirmButton: false,
        allowOutsideClick: false
      })
      //esperar 4 segundos
      console.log('esperando 4 segundos')
      setTimeout(function () {
        console.log('cerrando swal')
        this.stopTimer();
        this.recognition.stop();
        Swal.close();
      }.bind(this), 4000);
      
      this.recording = !this.recording;
      
    } else {
      if(this.medicalText.length > 0){
        //quiere continuar con la grabacion o empezar una nueva
        Swal.fire({
          title: this.translate.instant("voice.Do you want to continue recording?"),
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#0CC27E',
          cancelButtonColor: '#FF586B',
          confirmButtonText: this.translate.instant("voice.Yes, I want to continue."),
          cancelButtonText: this.translate.instant("voice.No, I want to start a new recording."),
          showLoaderOnConfirm: true,
          allowOutsideClick: false
        }).then((result) => {
          if (result.value) {
            this.continueRecording(false, true);
          }else{
            this.medicalText = '';
            this.continueRecording(true, true);
          }
        });
      }else{
        this.continueRecording(true, true);
      }
    }
    
  }

  continueRecording(restartClock, changeState){
    this.startTimer(restartClock);
    this.recognition.start();
    this.recognition.onresult = (event) => {
      console.log(event)
      var transcript = event.results[event.resultIndex][0].transcript;
      console.log(transcript); // Utilizar el texto aquí
      this.medicalText += transcript + '\n';
      /*this.ngZone.run(() => {
        this.medicalText += transcript + '\n';
      });*/
      if (event.results[event.resultIndex].isFinal) {
        console.log('ha terminado')
      }
    };

   // this.recognition.onerror = function(event) {
    this.recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        console.log('Reiniciando el reconocimiento de voz...');
        this.restartRecognition(); // Llama a una función para reiniciar el reconocimiento
      } else {
        // Para otros tipos de errores, muestra un mensaje de error
        this.toastr.error('', this.translate.instant("voice.Error in voice recognition."));
      }
    };
    if(changeState){
      this.recording = !this.recording;
    }
  }

  restartRecognition() {
    this.recognition.stop(); // Detiene el reconocimiento actual
    setTimeout(() => this.continueRecording(false, false), 100); // Un breve retraso antes de reiniciar
  }

  async createFile(){
    if (!this.tempFileName.trim()) {
      // Si el usuario no ha introducido un nombre, generamos uno por defecto
      let today = new Date();
      let date = today.getFullYear().toString() +
                 (today.getMonth() + 1).toString().padStart(2, '0') +
                 today.getDate().toString().padStart(2, '0') +
                 today.getHours().toString().padStart(2, '0') +
                 today.getMinutes().toString().padStart(2, '0') +
                 today.getSeconds().toString().padStart(2, '0') +
                 today.getMilliseconds().toString().padStart(3, '0');
      
      this.tempFileName = localStorage.getItem('lang') == 'es' ? 'informeManual-' : 'manualFile-';
      this.tempFileName += date + '.txt';
    } else if (!this.tempFileName.endsWith('.txt')) {
      // Asegurarse de que el archivo tenga la extensión .txt
      this.tempFileName += '.txt';
    }
    
    let file = new File([this.medicalText], this.tempFileName, {type: 'text/plain'});
    var reader = new FileReader();
    reader.readAsArrayBuffer(file); // read file as data url
    reader.onload = (event2: any) => { // called once readAsDataURL is completed
      var filename = (file).name;
      var extension = filename.substr(filename.lastIndexOf('.'));
      var pos = (filename).lastIndexOf('.')
      pos = pos - 4;
      if (pos > 0 && extension == '.gz') {
        extension = (filename).substr(pos);
      }
      filename = filename.split(extension)[0];
      var uniqueFileName = this.getUniqueFileName2();
      filename = 'raitofile/' + uniqueFileName + '/' + filename + extension;
      this.docs.push({ dataFile: { event: file, name: file.name, url: filename, content: event2.target.result }, langToExtract: '', medicalText: '', state: 'false', tokens: 0 });
      if (this.modalReference != undefined) {
        this.modalReference.close();
        this.modalReference = undefined;
      }
      this.isCheckingDocsStatus = false;
      for (let i = 0; i < this.docs.length; i++) {
        this.prepareFile(i);
      }
    }
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isMobileDevice2(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor;
    return /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
  }

  isMobileDevice(): boolean {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor);
    return check;
  }

  openCamera() {
    const videoElement = document.querySelector('#videoElement') as HTMLVideoElement;
    if (videoElement) {
      let params = {
        video: {
          facingMode: 'user'
        }
      }
      if (this.isMobileDevice()) {
        params = {
          video: {
            facingMode: 'environment'
          }
        }
      }
      navigator.mediaDevices.getUserMedia(params)
        .then(stream => {
          videoElement.srcObject = stream;
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          //debe permitir la camara para continuar
          this.insightsService.trackException(err);
          this.toastr.error('', this.translate.instant("demo.allowcamera"));
          if (this.modalReference != undefined) {
            this.modalReference.close();
            this.modalReference = undefined;
          }
        });
    } else {
      console.error("Video element not found");
      this.insightsService.trackException("Video element not found");
      this.toastr.error('', this.translate.instant("generics.error try again"));
    }
  }

  captureImage() {
    const videoElement = document.querySelector('#videoElement') as HTMLVideoElement;
    if (videoElement) {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      this.capturedImage = canvas.toDataURL('image/png');
      this.stopCamera();
      this.stepPhoto = 2;
      this.nameFileCamera = 'photo-' + this.getUniqueFileName();
    } else {
      console.error("Video element not ready for capture.");
    }
  }

  stopCamera() {
    const videoElement = document.querySelector('#videoElement') as HTMLVideoElement;
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      const tracks = stream.getTracks();

      tracks.forEach(track => track.stop());
      videoElement.srcObject = null;
    }
  }

  async prevCamera() {
    this.stepPhoto = 1;
    await this.delay(200);
    this.openCamera();
    this.capturedImage = '';
  }

  otherPhoto(goprev) {
    if (this.nameFileCamera == '') {
      this.nameFileCamera = 'photo-' + this.getUniqueFileName();
    }
    this.nameFileCamera = this.nameFileCamera + '.png';
    let file = this.dataURLtoFile(this.capturedImage, this.nameFileCamera);
    var reader = new FileReader();
    reader.readAsArrayBuffer(file); // read file as data url
    reader.onload = (event2: any) => { // called once readAsDataURL is completed
      var filename = (file).name;
      var extension = filename.substr(filename.lastIndexOf('.'));
      var pos = (filename).lastIndexOf('.')
      pos = pos - 4;
      if (pos > 0 && extension == '.gz') {
        extension = (filename).substr(pos);
      }
      filename = filename.split(extension)[0];
      var uniqueFileName = this.getUniqueFileName2();
      filename = 'raitofile/' + uniqueFileName + '/' + filename + extension;
      let dataFile = { event: file, url: filename, name: file.name };
      this.tempDocs.push({ dataFile: dataFile, state: 'false' });
      if(goprev){
        this.prevCamera();
      }else{
        // Si hay más de 1 foto, preguntar si quiere agrupar
        if (this.tempDocs.length > 1) {
          this.askGroupPhotos();
        } else {
          // Si solo hay 1 foto, procesar directamente
          if (this.modalReference != undefined) {
            this.modalReference.close();
            this.modalReference = undefined;
          }
          this.processFilesSequentially();
        }
      }
    }
  }

  deletephoto(index) {
    this.tempDocs.splice(index, 1);
  }

  askGroupPhotos() {
    const pageCount = this.tempDocs.length;
    const pageList = this.tempDocs.map((doc, index) => `${index + 1}. ${doc.dataFile.name}`).join('<br>');
    
    // Generar nombre por defecto inteligente
    const defaultName = this.generateDefaultDocumentName();
    
    // Crear HTML con selector y campo de nombre condicional
    let htmlContent = `
      <p style="margin-bottom: 15px; font-size: 1.1em;">
        ${this.translate.instant('demo.You have captured')} <strong>${pageCount}</strong> ${pageCount === 1 ? this.translate.instant('demo.page') : this.translate.instant('demo.pages')}.
      </p>
      <p style="margin-bottom: 10px;"><strong>${this.translate.instant('demo.Captured pages')}:</strong></p>
      <div style="text-align: left; max-height: 120px; overflow-y: auto; margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px; font-size: 0.9em;">${pageList}</div>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
        <p style="margin-bottom: 15px; font-weight: 600;">${this.translate.instant('demo.How do you want to save this document?')}</p>
        <div style="text-align: left;">
          <label style="display: block; margin-bottom: 15px; cursor: pointer; padding: 10px; border: 2px solid #2F8BE6; border-radius: 6px; background-color: #f0f7ff;">
            <input type="radio" name="saveOption" value="group" checked style="margin-right: 10px; cursor: pointer; width: 18px; height: 18px; accent-color: #2F8BE6;">
            <span style="font-weight: 600; color: #2F8BE6;">${this.translate.instant('demo.Save as one document')}</span>
            <span style="display: block; margin-left: 28px; margin-top: 5px; font-size: 0.9em; color: #666;">${this.translate.instant('demo.Save as one document description')}</span>
          </label>
          <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; background-color: #fff;">
            <input type="radio" name="saveOption" value="separate" style="margin-right: 10px; cursor: pointer; width: 18px; height: 18px; accent-color: #2F8BE6;">
            <span style="font-weight: 600;">${this.translate.instant('demo.Save as separate documents')}</span>
            <span style="display: block; margin-left: 28px; margin-top: 5px; font-size: 0.9em; color: #666;">${this.translate.instant('demo.Save as separate documents description')}</span>
          </label>
        </div>
        <div id="documentNameContainer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600;">${this.translate.instant('demo.Document name')}</label>
          <input type="text" id="documentNameInput" value="${defaultName}" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 1em;" placeholder="${this.translate.instant('demo.Enter document name')}">
          <p style="margin-top: 5px; font-size: 0.85em; color: #666; font-style: italic;">${this.translate.instant('demo.You can change it later')}</p>
        </div>
      </div>
    `;
    
    Swal.fire({
      title: this.translate.instant('demo.Finalize document'),
      html: htmlContent,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.translate.instant('demo.Save document'),
      cancelButtonText: this.translate.instant('generics.Cancel'),
      confirmButtonColor: '#2F8BE6',
      cancelButtonColor: '#B0B6BB',
      reverseButtons: true,
      didOpen: () => {
        // Manejar cambio de opción y actualizar estilos visuales
        const container = Swal.getHtmlContainer();
        const radioButtons = container?.querySelectorAll('input[name="saveOption"]') as NodeListOf<HTMLInputElement>;
        const nameContainer = container?.querySelector('#documentNameContainer') as HTMLElement;
        const labels = container?.querySelectorAll('label') as NodeListOf<HTMLLabelElement>;
        
        // Función para actualizar estilos visuales de los labels
        const updateLabelStyles = () => {
          radioButtons?.forEach((radio, index) => {
            const label = labels?.[index];
            if (label && radio.checked) {
              label.style.borderColor = '#2F8BE6';
              label.style.backgroundColor = '#f0f7ff';
            } else if (label) {
              label.style.borderColor = '#dee2e6';
              label.style.backgroundColor = '#fff';
            }
          });
        };
        
        // Actualizar estilos iniciales
        updateLabelStyles();
        
        radioButtons?.forEach(radio => {
          radio.addEventListener('change', () => {
            updateLabelStyles();
            if (radio.value === 'group' && nameContainer) {
              nameContainer.style.display = 'block';
            } else if (radio.value === 'separate' && nameContainer) {
              nameContainer.style.display = 'none';
            }
          });
        });
      },
      preConfirm: () => {
        const container = Swal.getHtmlContainer();
        const selectedOption = (container?.querySelector('input[name="saveOption"]:checked') as HTMLInputElement)?.value;
        const nameInput = container?.querySelector('#documentNameInput') as HTMLInputElement;
        
        if (selectedOption === 'group') {
          const documentName = nameInput?.value?.trim();
          if (!documentName) {
            Swal.showValidationMessage(this.translate.instant('demo.Document name is required'));
            return false;
          }
          return { option: 'group', name: documentName };
        } else {
          return { option: 'separate', name: null };
        }
      }
    }).then((result) => {
      if (this.modalReference != undefined) {
        this.modalReference.close();
        this.modalReference = undefined;
      }
      
      if (result.isConfirmed && result.value) {
        if (result.value.option === 'group') {
          // Agrupar en un solo PDF con el nombre proporcionado
          this.groupPhotosIntoPDF(result.value.name);
        } else {
          // Subir como documentos separados
          this.processFilesSequentially();
        }
      }
    });
  }

  generateDefaultDocumentName(): string {
    // Generar nombre inteligente basado en fecha y contexto
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    
    // Opciones de nombres sugeridos
    const suggestions = [
      this.translate.instant('demo.Medical report'),
      this.translate.instant('demo.Test results'),
      this.translate.instant('demo.Medical documentation')
    ];
    
    // Usar el nombre de la cámara si existe y tiene sentido, sino usar sugerencia
    if (this.nameFileCamera && this.nameFileCamera !== '' && !this.nameFileCamera.startsWith('photo-')) {
      return this.nameFileCamera.replace('.png', '');
    }
    
    // Usar primera sugerencia con fecha
    return `${suggestions[0]} – ${dateStr}`;
  }

  async groupPhotosIntoPDF(documentName: string) {
    try {
      // Mostrar mensaje de carga
      Swal.fire({
        title: this.translate.instant('demo.Combining photos'),
        html: `<p>${this.translate.instant('demo.Combining')} ${this.tempDocs.length} ${this.tempDocs.length === 1 ? this.translate.instant('demo.photo') : this.translate.instant('demo.photos')} ${this.translate.instant('demo.into one document')}...</p>`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Crear PDF con jsPDF
      const doc = new jsPDF();
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pdfWidth - (margin * 2);
      const maxHeight = pdfHeight - (margin * 2);

      // Procesar cada foto y añadirla al PDF
      for (let i = 0; i < this.tempDocs.length; i++) {
        const photoData = this.tempDocs[i].dataFile;
        const imageDataUrl = await this.fileToDataURL(photoData.event);
        
        // Crear imagen para obtener dimensiones
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = () => {
            // Calcular dimensiones manteniendo proporción
            let imgWidth = img.width;
            let imgHeight = img.height;
            const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
            imgWidth = imgWidth * ratio;
            imgHeight = imgHeight * ratio;

            // Centrar imagen en la página
            const x = (pdfWidth - imgWidth) / 2;
            const y = (pdfHeight - imgHeight) / 2;

            // Añadir nueva página si no es la primera foto
            if (i > 0) {
              doc.addPage();
            }

            // Añadir imagen al PDF
            doc.addImage(imageDataUrl, 'PNG', x, y, imgWidth, imgHeight);
            resolve(null);
          };
          img.src = imageDataUrl;
        });
      }

      // Generar blob del PDF
      const pdfBlob = doc.output('blob');
      
      // Crear File desde el blob usando el nombre proporcionado por el usuario
      let cleanName = documentName.trim();
      if (cleanName.toLowerCase().endsWith('.pdf')) {
        cleanName = cleanName.slice(0, -4);
      }
      const pdfFileName = cleanName + '.pdf';
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // Preparar para subir
      var uniqueFileName = this.getUniqueFileName2();
      var filename = 'raitofile/' + uniqueFileName + '/' + pdfFileName;
      
      // Leer el archivo como ArrayBuffer para el contenido
      var reader = new FileReader();
      reader.readAsArrayBuffer(pdfFile);
      reader.onload = async (event2: any) => {
        // Limpiar tempDocs y añadir el PDF a docs
        this.tempDocs = [];
        this.docs.push({ dataFile: { event: pdfFile, name: pdfFileName, url: filename, content: event2.target.result }, langToExtract: '', medicalText: '', state: 'false', tokens: 0 });

        // Cerrar mensaje de carga y esperar un poco para que se cierre completamente
        Swal.close();
        await this.delay(300);

        // Procesar el archivo
        this.isCheckingDocsStatus = false;
        for (let i = 0; i < this.docs.length; i++) {
          this.prepareFile(i);
        }
      };
    } catch (error) {
      console.error('Error combining photos:', error);
      Swal.fire({
        title: this.translate.instant('demo.Error combining photos'),
        text: error.message || '',
        icon: 'error'
      });
      this.insightsService.trackException(error);
    }
  }

  fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  processFilesSequentially(index = 0) {
    if (index < this.tempDocs.length) {
      let file = this.tempDocs[index].dataFile.event;
      var reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (event2: any) => {
        var filename = this.tempDocs[index].dataFile.url;
        this.docs.push({ dataFile: { event: file, name: file.name, url: filename, content: event2.target.result }, langToExtract: '', medicalText: '', state: 'false', tokens: 0 });
        
        // Procesar siguiente archivo
        this.processFilesSequentially(index + 1);
      };
    } else {
      // Todos los archivos procesados, limpiar tempDocs y procesar docs
      this.tempDocs = [];
      if (this.modalReference != undefined) {
        this.modalReference.close();
        this.modalReference = undefined;
      }
      // Esperar un poco antes de procesar para asegurar que el modal se haya cerrado
      setTimeout(() => {
        this.isCheckingDocsStatus = false;
        for (let i = 0; i < this.docs.length; i++) {
          this.prepareFile(i);
        }
      }, 300);
    }
  }



  getUniqueFileName() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    var h = now.getHours();
    var mm = now.getMinutes();
    var ss = now.getSeconds();
    var ff = Math.round(now.getMilliseconds() / 10);
    var date = '' + y.toString().substr(-2) + (m < 10 ? '0' : '') + m + (d < 10 ? '0' : '') + d + (h < 10 ? '0' : '') + h + (mm < 10 ? '0' : '') + mm + (ss < 10 ? '0' : '') + ss + (ff < 10 ? '0' : '') + ff;
    return date;
  }

  getUniqueFileName2() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    var h = now.getHours();
    var mm = now.getMinutes();
    var ss = now.getSeconds();
    var ff = Math.round(now.getMilliseconds() / 10);
    var date = '' + y.toString().substr(-2) + (m < 10 ? '0' : '') + m + (d < 10 ? '0' : '') + d + (h < 10 ? '0' : '') + h + (mm < 10 ? '0' : '') + mm + (ss < 10 ? '0' : '') + ss + (ff < 10 ? '0' : '') + ff;
    var randomString = this.makeid(8);
    var name = date + randomString;
    var url = y.toString().substr(-2) + '/' + (m < 10 ? '0' : '') + m + '/' + (d < 10 ? '0' : '') + d + '/' + name;
    return url;
  }

  makeid(length) {
    var result = '';
    var characters = '0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += Math.floor(Math.random() * charactersLength);
    }
    return result;
  }

  //create dataURLtoFile
  dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  onFileChangePDF(event) {
    this.isCheckingDocsStatus = false;
    for (let file of event.target.files) {
      if (event.target.files && file) {
        var reader = new FileReader();
        reader.readAsArrayBuffer(file); // read file as data url
        reader.onload = (event2: any) => { // called once readAsDataURL is completed
          var filename = (file).name;
          var extension = filename.substr(filename.lastIndexOf('.'));
          var pos = (filename).lastIndexOf('.')
          pos = pos - 4;
          if (pos > 0 && extension == '.gz') {
            extension = (filename).substr(pos);
          }
          filename = filename.split(extension)[0];
          var uniqueFileName = this.getUniqueFileName2();
          filename = 'raitofile/' + uniqueFileName + '/' + filename + extension;
          this.docs.push({ dataFile: { event: file, name: file.name, url: filename, content: event2.target.result }, langToExtract: '', medicalText: '', state: 'false', tokens: 0 });
          if (event.target.files[0].type == 'application/pdf' || extension == '.docx' || event.target.files[0].type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension == '.jpg' || extension == '.png' || extension == '.jpeg' || extension == '.bmp' || extension == '.tiff' || extension == '.heif' || extension == '.pptx' || event.target.files[0].type == 'text/plain' || extension == '.txt') {
            let index = this.docs.length - 1;
            this.prepareFile(index);
          } else {
            Swal.fire(this.translate.instant("dashboardpatient.error extension"), '', "error");
            this.insightsService.trackEvent('Invalid file extension', { extension: extension });
          }
        }
      }
    }
  }

  prepareFileOld(index) {
    this.docs[index].state = 'uploading';
    //show in a swal the state of all the docs
    let swalopen = Swal.isVisible()
    if(!swalopen){
      Swal.fire({
        title: this.translate.instant("demo.Extracting the text from the documents"),
        html: '<p>'+this.translate.instant("demo.This may take up to a minute")+'</p><img class="round" src='+this.icons[0].data+' alt="procesing"/><div id="swal-content"></div>',
        showCancelButton: false,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: async () => {
          if (!this.isCheckingDocsStatus) {
            this.isCheckingDocsStatus = true;
            const updateSwalContent = async () => {
              await this.delay(800);
              let contentElement = Swal.getContent() ? Swal.getContent().querySelector('#swal-content') : null;
              if (contentElement) { // Verificar si el elemento existe
                let content = this.docs.map(doc => {
                  let icon;
                  if (doc.state === 'done') {
                    icon = '<em class="fa fa-check fa-fw success"></em>';
                  } else if (doc.state === 'failed') {
                    icon = '<em class="fa-solid fa-file-exclamation fa-fw danger"></em>';
                  } else {
                    icon = '<em class="fa fa-spinner fa-spin fa-fw primary"></em>';
                  }
                  return `<p>${doc.dataFile.name}: ${icon}</p>`;
                }).join('');
                
                contentElement.innerHTML = content; // Actualizar el contenido si el elemento existe
              }
            };
            updateSwalContent();
            const intervalId = setInterval(() => {
              updateSwalContent();
      
              if (this.docs.every(doc => doc.state === 'done' || doc.state === 'failed')) {
                clearInterval(intervalId);
                this.isCheckingDocsStatus = false; 
                this.getInitialEvents();
                this.continueAnalizeDocs()
                setTimeout(() => Swal.close(), 2300);
              }
            }, 2000);
  
          }
        }
      });
    }
   


    const formData = new FormData();
    formData.append("thumbnail", this.docs[index].dataFile.event);
    formData.append("url", this.docs[index].dataFile.url);
    formData.append("containerName", this.containerName);
    formData.append("userId", this.authService.getIdUser());
    formData.append("medicalLevel", this.medicalLevel);
    formData.append("preferredResponseLanguage", this.preferredResponseLanguage);
    this.sendFile(formData, index);
  }

  prepareFile(index) {
    this.docs[index].state = 'uploading';
    //show in a swal the state of all the docs
    let swalopen = Swal.isVisible()
    if(!swalopen){
      Swal.fire({
        title: this.translate.instant("demo.Extracting the text from the documents"),
        html: '<p>'+this.translate.instant("demo.This may take up to a minute")+'</p><img class="round" src='+this.icons[0].data+' alt="procesing"/><div id="swal-content"></div>',
        showCancelButton: false,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: async () => {
          if (!this.isCheckingDocsStatus) {
            this.isCheckingDocsStatus = true;
            const updateSwalContent = async () => {
              await this.delay(800);
              let contentElement = Swal.getContent() ? Swal.getContent().querySelector('#swal-content') : null;
              if (contentElement) { // Verificar si el elemento existe
                  let table = contentElement.querySelector('#docs-table');
                  if (!table) {
                      // Crear la tabla y el tbody si no existen
                      table = document.createElement('table');
                      table.id = 'docs-table';
                      table.className = 'w-100 mt-3 mb-3 text-left';
                      const status = this.translate.instant('generics.Status');
                      const name = this.translate.instant('generics.Name');
                      table.innerHTML = `
                          <thead>
                              <tr>
                                  <th>
                                  <div style="margin-bottom: 0.5rem;margin-right: 0.5rem;">${name}</div>
                                  </th>
                                  <th>
                                  <div style="margin-bottom: 0.5rem;">${status}</div>
                                  </th>
                              </tr>
                          </thead>
                          <tbody></tbody>
                      `;
                      contentElement.appendChild(table);
                  }
          
                  let tbody = table.querySelector('tbody');
                  if (tbody) {
                      let content = this.docs.map(doc => {
                          let icon;
                          if (doc.state === 'done') {
                              icon = '<em class="fa fa-check fa-fw success"></em>';
                          } else if (doc.state === 'failed') {
                              icon = '<em class="fa-solid fa-file-exclamation fa-fw danger"></em>';
                          } else {
                              icon = '<em class="fa fa-spinner fa-spin fa-fw primary"></em>';
                          }
                          return `
                            <tr>
                                <td>
                                    <div style="margin-bottom: 0.5rem;margin-right: 0.5rem;">${doc.dataFile.name}</div>
                                </td>
                                <td>
                                    <div style="margin-bottom: 0.5rem;">${icon}</div>
                                </td>
                            </tr>`;
                      }).join('');
          
                      tbody.innerHTML = content;
                  }
              }
          };
            updateSwalContent();
            const intervalId = setInterval(() => {
              updateSwalContent();
      
              if (this.docs.every(doc => doc.state === 'done' || doc.state === 'failed')) {
                clearInterval(intervalId);
                this.isCheckingDocsStatus = false; 
                this.getInitialEvents();
                this.continueAnalizeDocs()
                setTimeout(() => Swal.close(), 2300);
              }
            }, 2000);
  
          }
        }
      });
    }
   


    const formData = new FormData();
    formData.append("thumbnail", this.docs[index].dataFile.event);
    formData.append("url", this.docs[index].dataFile.url);
    formData.append("containerName", this.containerName);
    formData.append("userId", this.authService.getIdUser());
    formData.append("medicalLevel", this.medicalLevel);
    formData.append("preferredResponseLanguage", this.preferredResponseLanguage);
    this.sendFile(formData, index);
  }

  sendFile(formData, index) {
    this.subscription.add(this.http.post(environment.api + '/api/uploadwizard/'+ this.currentPatient, formData)
      .subscribe((res: any) => {
        if(res.message!='Done'){
          this.docs[index].state = 'failed';
          //Swal.close();
          /*Swal.fire(this.translate.instant("demo.A problem occurred while extracting text"), '', "error");
          this.docs.splice(index, 1);*/
        }else{
          this.docs[index].state = 'done';
          this.docs[index].docId = res.docId;
          //this.docs[res.doc_id].medicalText = res.data;
          //this.docs[res.doc_id].summary = res.summary;
          //this.docs[res.doc_id].tokens = res.tokens;
          //this.totalTokens = this.totalTokens + res.tokens;
          //Swal.close();
        }
        
      }, (err) => {
        this.insightsService.trackException(err);
        this.docs[index].state = 'failed';
        console.log(err);
        var msgFail = this.translate.instant("generics.Data saved fail");
          if(err.error.message){
            this.toastr.error(err.error.message, msgFail);
          }else{
            this.toastr.error('', msgFail);
          }
          //Swal.close();
          //Swal.fire(this.translate.instant("demo.A problem occurred while extracting text"), '', "error");
          //delete the file
          //this.docs.splice(index, 1);
      }));
  }


  continueAnalizeDocs(){
    let doneDocs = this.docs.filter(doc => doc.state === 'done');
    let info = { documents: doneDocs, medicalLevel: this.medicalLevel, userId: this.authService.getIdUser()}
    if(doneDocs.length > 0){
      this.subscription.add(this.http.post(environment.api + '/api/continueanalizedocs/'+ this.currentPatient, info)
      .subscribe((res: any) => {
      }, (err) => {
      }));
    }
   
  }

  getInitialEvents() {
    let doneDocs = this.docs.filter(doc => doc.state === 'done');
    if(doneDocs.length > 0){
      this.startOpt = 'form';
      this.loadingInitialEvents = true;
      this.subscription.add(this.patientService.getInitialEvents(this.currentPatient, this.preferredResponseLanguage)
        .subscribe((res: any) => {
          this.initialEvents = res;
          this.loadingInitialEvents = false;
          /*if (res && Array.isArray(res)) {
            // Transformar el arreglo de objetos a un objeto con claves y valores
            this.initialEvents = res.reduce((acc, current) => {
              acc[current.key] = current.insight;
              return acc;
            }, {});
          }*/
          this.ShowFormInitialEvents();
        }, (err) => {
          console.log(err);
          this.loadingInitialEvents = false;
        }));
    }else{
      Swal.fire({
        title: this.translate.instant("messages.A problem occurred while extracting text"),
        text: this.translate.instant("messages.want to try again"),
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#2F8BE6',
        cancelButtonColor: '#B0B6BB',
        confirmButtonText: this.translate.instant("generics.Yes"),
        cancelButtonText: this.translate.instant("generics.No"),
        allowOutsideClick: false,
        allowEscapeKey: false,
        reverseButtons: true
      }).then((result) => {
        if (result.value) {
          this.startOpt = 'doc';
        }else{
          this.startOpt = 'form';
        }
      });     

    }
    
  }

  dateValidator(control) {
    const selectedDate = new Date(control.value);
    const currentDate = new Date();
    if (selectedDate > currentDate) {
      return { futureDate: true };
    }
    return null;
  }
  
  ShowFormInitialEvents(){
    this.havetreatment = false;
    this.havediagnosis = false;
    //const data = this.initialEvents;
    this.initialEventsForm = this.formBuilder.group({
      name: ['', Validators.required],
      dob: ['',  [Validators.required, this.dateValidator]],
      measurementSystem: ['metric', Validators.required], // o 'metric' como valor predeterminado
      weightImperial: [null], // Peso en libras
      weightMetric: [null], // Peso en kilogramos
      heightFt: [null], // Altura en pies
      heightIn: [null], // Altura en pulgadas
      heightCm: [null], // Altura en centímetros
      ethnicGroup: ['white_european', Validators.required],
      gender: [null, Validators.required],
      chronicConditions: ['', Validators.required],
      diagnosis: [''],
      familyHealthHistory: ['', Validators.required], // Campo para sí/no del historial médico familiar
      familyHealthHistoryDetails: [''],
      knownAllergies: ['', Validators.required],
      allergiesDetails: [''],
      surgicalHistory: ['', Validators.required],
      surgicalHistoryDetails: [''],
      currentMedications: ['', Validators.required],
      treatment: [''],
      smokingIntensity: ['', Validators.required],
      alcoholIntake: ['', Validators.required],
      dietaryHabits: ['', Validators.required],
      dietaryHabitsDetails: [''],
      physicalActivityLevel: ['', Validators.required],
      sleepPattern: ['', Validators.required],
      stressLevel: ['', Validators.required],
      medication: this.formBuilder.array([])
    });
    
    /*if(this.initialEvents.length > 0){
      this.initialEvents.forEach(item => {
        this.initialEventsForm.controls[item.key].setValue(item.insight);
      });
    }*/

    if (this.initialEvents.length > 0) {
      this.initialEvents.forEach(item => {
        let value = item.insight;
        if (item.key === 'weightMetric' || item.key === 'heightCm') {
          value = this.normalizeInput(value, true); // Convertir a formato métrico si es necesario
        } else if (item.key === 'weightImperial' || item.key === 'heightFt' || item.key === 'heightIn') {
          value = this.normalizeInput(value, false); // Convertir a formato imperial si es necesario
        }
        if (item.key === "ethnicGroup") {
          const normalizedInsight = item.insight.toLowerCase();
          value = this.ethnicGroupMapping[normalizedInsight] || item.insight;
        }
        this.initialEventsForm.controls[item.key].setValue(value);
      });
      if(this.initialEventsForm.get('treatment').value){
        this.havetreatment = true;
      }
      if(this.initialEventsForm.get('diagnosis').value){
        this.havediagnosis = true;
      }
      
    }
    
    this.adjustMeasurementValidators();
    /*
    this.initialEvents.forEach(item => {
      console.log(item)
      this.initialEventsForm.controls[item.key].setValue(item.insight);
    });*/
  }

  ethnicGroupMapping = {
    "black african": "black_african",
    "white european": "white_european",
    "hispanic latino": "hispanic_latino",
    "south asian": "south_asian",
    "east asian": "east_asian",
    "middle eastern": "middle_eastern",
    "pacific islander": "pacific_islander",
    "multiracial other": "multiracial_other"
  };

  createMedicationGroup(medication): FormGroup {
    return this.formBuilder.group({
      medication_name: [medication.medication_name, Validators.required],
      dosage: [medication.dosage, Validators.required],
      frequency: [medication.frequency, Validators.required]
    });
  }

    // Método para añadir un nuevo grupo de medicamento al FormArray
  addMedication(): void {
    const medication = this.formBuilder.group({
      medication_name: ['', Validators.required],
      dosage: ['', Validators.required],
      frequency: ['', Validators.required]
    });

    (this.initialEventsForm.get('medication') as FormArray).push(medication);
  }

  // Método para eliminar un grupo de medicamento del FormArray
  deleteMedication(index: number): void {
    (this.initialEventsForm.get('medication') as FormArray).removeAt(index);
  }

    get datedob() {
      //return this.seizuresForm.get('date').value;
      let minDate = new Date(this.initialEventsForm.get('dob').value);
      return minDate;
    }
    get efid() { return this.initialEventsForm.controls; }


    saveInitialData() {
        /*if (this.initialEventsForm.invalid) {
          return;
        }*/
      this.submitted2 = true;
      const formValue = this.initialEventsForm.value;

      // Convertir unidades si es necesario (de imperial a métrico)
      const weightInKg = formValue.measurementSystem === 'imperial' ? formValue.weightImperial * 0.453592 : formValue.weightMetric;
      const heightInCm = formValue.measurementSystem === 'imperial' ? (formValue.heightFt * 30.48) + (formValue.heightIn * 2.54) : formValue.heightCm;
      this.initialEventsForm.value.dob = this.dateService.transformDate(this.initialEventsForm.value.dob);

      this.eventsForm = this.formBuilder.group({
        name: ['', Validators.required],
        date: [new Date()],
        notes: [],
        key: null
      });

      this.actualPatient.patientName = this.initialEventsForm.value.name;
      this.actualPatient.birthDate = this.initialEventsForm.value.dob;
      this.actualPatient.gender = this.initialEventsForm.value.gender;
      let savePromises = [this.updateBasicInfo(this.actualPatient)];

      const eventsData = [];

      eventsData.push({ name: this.translate.instant('steps.weight') + ': ' + weightInKg, key: 'weight' });
      eventsData.push({ name: this.translate.instant('steps.height') + ': ' + heightInCm, key: 'height' });

  
      //ethnicGroup
      const ethnicGroupKey = `steps.${this.initialEventsForm.value.ethnicGroup}`;
      const translatedEthnicGroup = this.translate.instant(ethnicGroupKey);
      eventsData.push({ name: this.translate.instant('steps.ethnicGroup') + ': ' + translatedEthnicGroup, key: 'ethnicGroup' });
      

      //knownAllergies
      if (this.initialEventsForm.value.knownAllergies == 'yes') {
        eventsData.push({ name: this.translate.instant('steps.knownAllergies') + ': ' + this.initialEventsForm.value.allergiesDetails, key: 'knownAllergies' });
      } else {
        eventsData.push({ name: this.translate.instant('steps.knownAllergies') + ': ' + this.initialEventsForm.value.knownAllergies, key: 'knownAllergies' });
      }

      //chronicConditions
      if(this.initialEventsForm.value.chronicConditions=='yes' && !this.havediagnosis){
        eventsData.push({ name: this.initialEventsForm.value.diagnosis, key: 'diagnosis' });
      }else{
        eventsData.push({ name: this.translate.instant('steps.chronicConditions') + ': ' + this.initialEventsForm.value.chronicConditions, key: 'chronicConditions' });;
      }      

      //familyHealthHistory
      if (this.initialEventsForm.value.familyHealthHistory == 'yes') {
        eventsData.push({ name: this.translate.instant('steps.familyHealthHistory') + ': ' + this.initialEventsForm.value.familyHealthHistoryDetails, key: 'familyHealthHistory' });
      } else {
        eventsData.push({ name: this.translate.instant('steps.familyHealthHistory') + ': ' + this.initialEventsForm.value.familyHealthHistory, key: 'familyHealthHistory' });
      }

      //surgicalHistory
      if (this.initialEventsForm.value.surgicalHistory == 'yes') {
        eventsData.push({ name: this.translate.instant('steps.surgicalHistory') + ': ' + this.initialEventsForm.value.surgicalHistoryDetails, key: 'surgicalHistory' });
      } else {
        eventsData.push({ name: this.translate.instant('steps.surgicalHistory') + ': ' + this.initialEventsForm.value.surgicalHistory, key: 'surgicalHistory' });
      }

      //currentMedications
      if (this.initialEventsForm.value.currentMedications == 'yes' && !this.havetreatment) {
        eventsData.push({ name: this.initialEventsForm.value.treatment, key: 'medication' });
      } else {
        eventsData.push({ name: this.translate.instant('steps.currentMedications') + ': ' + this.initialEventsForm.value.currentMedications, key: 'currentMedications' });
      }

      const smokingIntensityKey = `steps.${this.initialEventsForm.value.smokingIntensity}`;
      const translatedSmokingIntensity = this.translate.instant(smokingIntensityKey);
      eventsData.push({ name: this.translate.instant('steps.smokingIntensity') + ': ' + translatedSmokingIntensity, key: 'smokingIntensity' });

      const alcoholIntakeKey = `steps.${this.initialEventsForm.value.alcoholIntake}`;
      const translatedAlcoholIntake = this.translate.instant(alcoholIntakeKey);
      eventsData.push({ name: this.translate.instant('steps.alcoholIntake') + ': ' + translatedAlcoholIntake, key: 'alcoholIntake' });

      if (this.initialEventsForm.value.dietaryHabits == 'specific_diet_plan') {
        eventsData.push({ name: this.translate.instant('steps.dietaryHabits') + ': ' + this.initialEventsForm.value.dietaryHabitsDetails, key: 'dietaryHabits' });
      } else {
        const dietaryHabitsKey = `steps.${this.initialEventsForm.value.dietaryHabits}`;
        const translatedDietaryHabits = this.translate.instant(dietaryHabitsKey);
        eventsData.push({ name: this.translate.instant('steps.dietaryHabits') + ': ' + translatedDietaryHabits, key: 'dietaryHabits' });
      }

      const physicalActivityLevelKey = `steps.${this.initialEventsForm.value.physicalActivityLevel}`;
      const translatedPhysicalActivityLevel = this.translate.instant(physicalActivityLevelKey);
      eventsData.push({ name: this.translate.instant('steps.physicalActivityLevel') + ': ' + translatedPhysicalActivityLevel, key: 'physicalActivityLevel' });

      const sleepPatternKey = `steps.${this.initialEventsForm.value.sleepPattern}`;
      const translatedSleepPattern = this.translate.instant(sleepPatternKey);
      eventsData.push({ name: this.translate.instant('steps.sleepPattern') + ': ' + translatedSleepPattern, key: 'sleepPattern' });

      const stressLevelKey = `steps.${this.initialEventsForm.value.stressLevel}`;
      const translatedStressLevel = this.translate.instant(stressLevelKey);
      eventsData.push({ name: this.translate.instant('steps.stressLevel') + ': ' + translatedStressLevel, key: 'stressLevel' });

      savePromises.push(this.confirmSaveInitialData({ events: eventsData }));
      
      Promise.all(savePromises).then(() => { // cuando todas las promesas se resuelven
        this.submitted2 = false;
        this.toastr.success('', this.translate.instant("generics.Saved"));
        //ahora ya tienes un contexto basico para que pueda probar la app, estas funcionalidades:
        //quizes hacer un wizard
        //pasar un parametro si es el primer paciente 
        if(this.isFirstPatient){
          this.router.navigate(['/home', { firstPatient: true }]);
        }else{
          this.router.navigate(['/home', { firstPatient: false }]);
        }
      });    

    }

    updateBasicInfo(info){
      return new Promise((resolve, reject) => {
      if (this.authGuard.testtoken()) {
        
        this.subscription.add(this.http.put(environment.api + '/api/patients/' + info.sub, info)
          .subscribe((res: any) => {
            console.log(res);
            this.authService.setCurrentPatient(res.patientInfo);
            this.authService.loadPatients();
            resolve(true);
          }, (err) => {
            this.submitted = false;
            console.log(err);
            this.insightsService.trackException(err);
            if (err.error.message == 'Token expired' || err.error.message == 'Invalid Token') {
              this.authGuard.testtoken();
            } else {
            }
            reject(err);
          }));
      }
    });
    }


    confirmSaveInitialData(data){
      return new Promise((resolve, reject) => {
      if (this.authGuard.testtoken()) {
        const userId = this.authService.getIdUser();
        this.subscription.add(this.http.post(environment.api + '/api/eventsform/' + this.currentPatient + '/' + userId, data)
          .subscribe((res: any) => {
            resolve(true);
          }, (err) => {
            this.submitted = false;
            console.log(err);
            this.insightsService.trackException(err);
            if (err.error.message == 'Token expired' || err.error.message == 'Invalid Token') {
              this.authGuard.testtoken();
            } else {
            }
            reject(err);
          }));
      }
    });
    }
  
    cancelInitialData() {
      this.submitted = false;
    }

    async nextStep(){
      this.submitted = true;
      if(this.checkStep()){
        this.submitted = false;
        if(this.stepform == 16){
          this.saveInitialData();
        }else{
          this.incrementStep();
        }
        
      }else{
        //this.toastr.error('', this.translate.instant("generics.Required fields"));
      }
      
    }

    incrementStep() {
      this.stepform++;
      if (this.stepform === 7 && this.initialEventsForm.get('diagnosis').value) {
        this.stepform++;
      }
      if (this.stepform === 10 && this.initialEventsForm.get('treatment').value) {
        this.stepform++;
      }
    }

    prevStep() {
      this.stepform--;
      if (this.stepform === 7 && this.initialEventsForm.get('diagnosis').value) {
        this.stepform--;
      }
      if (this.stepform === 10 && this.initialEventsForm.get('treatment').value) {
        this.stepform--;
      }

      this.submitted = false;
    }


    checkStep() {
      switch (this.stepform) {
        case 1:
          return this.initialEventsForm.get('name').value !== '';
        case 2:
          return this.initialEventsForm.get('dob').value !== '';
          case 3:
          return this.initialEventsForm.get('gender').value !== null;
        case 4:
          this.adjustMeasurementValidators();
          // Asumiendo que el sistema de medición se elige siempre, pero validas los campos de peso y altura basado en el sistema seleccionado.
          if (this.initialEventsForm.get('measurementSystem').value === 'metric') {
            return this.initialEventsForm.get('weightMetric').value !== null && this.initialEventsForm.get('heightCm').value !== null;
          } else {
            return this.initialEventsForm.get('weightImperial').value !== null && this.initialEventsForm.get('heightFt').value !== null && this.initialEventsForm.get('heightIn').value !== null;
          }
        case 5:
          return this.initialEventsForm.get('ethnicGroup').value !== '';
        case 6:
          return this.initialEventsForm.get('knownAllergies').value !== '' && (this.initialEventsForm.get('knownAllergies').value === 'no' || this.initialEventsForm.get('allergiesDetails').value !== '');
        case 7:
          return this.initialEventsForm.get('chronicConditions').value !== '' && (this.initialEventsForm.get('chronicConditions').value === 'no' || this.initialEventsForm.get('diagnosis').value !== '');
        case 8:
          return this.initialEventsForm.get('familyHealthHistory').value !== '' && (this.initialEventsForm.get('familyHealthHistory').value === 'no' || this.initialEventsForm.get('familyHealthHistoryDetails').value !== '');
        case 9:
          return this.initialEventsForm.get('surgicalHistory').value !== '' && (this.initialEventsForm.get('surgicalHistory').value === 'no' || this.initialEventsForm.get('surgicalHistoryDetails').value !== '');
        case 10:
          return this.initialEventsForm.get('currentMedications').value !== '' && (this.initialEventsForm.get('currentMedications').value === 'no' || this.initialEventsForm.get('treatment').value !== '');
        case 11:
          return this.initialEventsForm.get('smokingIntensity').value !== '';
        case 12:
          return this.initialEventsForm.get('alcoholIntake').value !== '';
        case 13:
          return this.initialEventsForm.get('dietaryHabits').value !== '' && (this.initialEventsForm.get('dietaryHabits').value !== 'specificDietPlan' || this.initialEventsForm.get('dietaryHabitsDetails').value !== '');
        case 14:
          return this.initialEventsForm.get('physicalActivityLevel').value !== '';
        case 15:
          return this.initialEventsForm.get('sleepPattern').value !== '';
        case 16:
          return this.initialEventsForm.get('stressLevel').value !== '';
        default:
          return true;
      }
    }

   

    adjustMeasurementValidators() {
      const measurementSystem = this.initialEventsForm.get('measurementSystem').value;
      const metricPattern = "^[0-9]+(?:,[0-9]{1,2})?$"; // Permitir comas para decimales
      const imperialPattern = "^[0-9]+(?:\\.[0-9]{1,2})?$"; // Permitir puntos para decimales
    
      if (measurementSystem === 'metric') {
        this.initialEventsForm.get('weightMetric').setValidators([Validators.required, Validators.pattern(metricPattern)]);
        this.initialEventsForm.get('heightCm').setValidators([Validators.required, Validators.pattern(metricPattern)]);
        this.initialEventsForm.get('weightImperial').clearValidators();
        this.initialEventsForm.get('heightFt').clearValidators();
        this.initialEventsForm.get('heightIn').clearValidators();
      } else if (measurementSystem === 'imperial') {
        this.initialEventsForm.get('weightImperial').setValidators([Validators.required, Validators.pattern(imperialPattern)]);
        this.initialEventsForm.get('heightFt').setValidators([Validators.required, Validators.pattern(imperialPattern)]);
        this.initialEventsForm.get('heightIn').setValidators([Validators.required, Validators.pattern(imperialPattern)]);
        this.initialEventsForm.get('weightMetric').clearValidators();
        this.initialEventsForm.get('heightCm').clearValidators();
      }
    
      // Actualiza el estado y la validez de los campos
      this.initialEventsForm.get('weightMetric').updateValueAndValidity();
      this.initialEventsForm.get('heightCm').updateValueAndValidity();
      this.initialEventsForm.get('weightImperial').updateValueAndValidity();
      this.initialEventsForm.get('heightFt').updateValueAndValidity();
      this.initialEventsForm.get('heightIn').updateValueAndValidity();
    }

    normalizeInput(value: string, toMetric: boolean): string {
      if (toMetric) {
        return value.replace('.', ','); // Convertir puntos a comas
      } else {
        return value.replace(',', '.'); // Convertir comas a puntos
      }
    }
    
    goToPatients(){
      //delete de patientInfo.sub
      this.subscription.add(this.patientService.deletePatient(this.currentPatient)
      .subscribe((res: any) => {
        console.log(res)
        this.authService.setCurrentPatient(null);
        this.authService.setPatientList([]);
        this.patientService.getPatientId().subscribe((res: any) => {
          this.router.navigate(['/patients']);
        });
        
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.router.navigate(['/patients']);
      }));
    }
}