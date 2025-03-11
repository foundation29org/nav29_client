import { Component, Output, EventEmitter, OnDestroy, OnInit, AfterViewInit, ChangeDetectorRef, HostListener, Injector, ViewChild, TemplateRef } from '@angular/core';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { LayoutService } from '../services/layout.service';
import { Subscription } from 'rxjs';
import { ConfigService } from '../services/config.service';
import { UntypedFormControl } from '@angular/forms';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { AuthService } from 'app/shared/auth/auth.service';
import { EventsService } from 'app/shared/services/events.service';
import { WebPubSubService } from 'app/shared/services/web-pub-sub.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { PatientService } from 'app/shared/services/patient.service';
import { environment } from 'environments/environment';
import { filter, tap } from 'rxjs/operators';
import Swal from 'sweetalert2';

declare global {
  interface Navigator {
    app: {
      exitApp: () => any; // Or whatever is the type of the exitApp function
    }
  }
}

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.scss"]
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  placement = "bottom-right";
  logoUrl = 'assets/img/logo.png';
  menuPosition = 'Side';
  isSmallScreen = false;
  protected innerWidth: any;
  transparentBGClass = "";
  hideSidebar: boolean = true;
  public isCollapsed = true;
  layoutSub: Subscription;
  configSub: Subscription;

  @Output()
  toggleHideSidebar = new EventEmitter<Object>();

  control = new UntypedFormControl();

  public config: any = {};
  actualUrl: string = '';
  isAndroid: boolean = false;
  tasks: any[] = [];
  private subscription: Subscription = new Subscription();
  documentStatus: string;
  private messageSubscription: Subscription;
  translateExtractingTheText: string = '';
  translateYouCanAskInChat: string = '';
  translateExtractingMedicalEvents: string = '';
  translateGeneratingSummary: string = '';
  translateAnonymizingDocument: string = '';
  translateSummaryPatient: string = '';
  translateAnomalies: string = '';
  isConnected: boolean = false;
  connectionInterval: any;
  loadedPatientId: boolean = false;
  patientsList: any[] = [];
  isMenuExpanded = false;
  isMenuExpanded2 = false;
  checking = true;
  userInfo: any = {};
  sharedPatients: any = [];
  @ViewChild('shareCustom', { static: false }) contentshareCustom: TemplateRef<any>;
  modalReference: NgbModalRef;
  mode = 'Custom';
  recentActivities: any = [];

  constructor(public translate: TranslateService,
    private layoutService: LayoutService,
    private router: Router,
    private configService: ConfigService, private cdr: ChangeDetectorRef, public authService: AuthService, private eventsService: EventsService, private webPubSubService: WebPubSubService, private http: HttpClient, private inj: Injector, private route: ActivatedRoute, public insightsService: InsightsService, private patientService: PatientService, private modalService: NgbModal) {

    this.config = this.configService.templateConf;
    this.innerWidth = window.innerWidth;

    this.layoutSub = layoutService.toggleSidebar$.subscribe(
      isShow => {
        this.hideSidebar = !isShow;
      });

    this.router.events.pipe(
      filter((event: any) => event instanceof NavigationEnd)
    ).subscribe(event => {
      const tempUrl = (event.url).toString().split('?');
      this.actualUrl = tempUrl[0];
    });

    this.isAndroid = false;
    var touchDevice = (navigator.maxTouchPoints || 'ontouchstart' in document.documentElement);
    if (touchDevice > 1 && /Android/i.test(navigator.userAgent)) {
      this.isAndroid = true;
    }

    this.webPubSubService.connectionStatus.subscribe(
      isConnected => this.handleConnectionStatus(isConnected)
    );

  }

  private handleConnectionStatus(isConnected: boolean) {
    this.isConnected = isConnected;
    if (isConnected) {
      this.getSharedPatients().toPromise()
        .then(() => {
          Promise.all([
            this.getEventsWebPubSub(),
            this.initEnvironment(),
            this.getUserInfo()
          ]).catch(error => {
            console.error('Error in initialization:', error);
          });
        })
        .catch(error => {
          console.error('Error getting shared patients:', error);
        });
    }
  }

  getUserInfo() {
    this.checking = true;
    this.subscription.add(this.http.get(environment.api + '/api/users/name/' + this.authService.getIdUser())
      .subscribe((res: any) => {
        this.userInfo = res;
        this.checking = false;
      }, (err) => {
        console.log(err);
        //this.checking = false;
      }));

  }

  getUserInitials(): string {
    const email = this.userInfo.email;
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return '';
  }

  initEnvironment() {
    this.loadPatientId();
    this.subscription = this.authService.patientListSubject.subscribe(
      (patientList) => {
        patientList.sort((a, b) => a.patientName.localeCompare(b.patientName));
        this.patientsList = patientList;
      }
    );
  }

  getSharedPatients() {
    return this.patientService.getSharedPatients(this.authService.getIdUser())
      .pipe(
        tap((res: any) => {
          this.sharedPatients = res;
        })
      );
  }

  selectPatient(patient) {
    //emit the old patient
    this.eventsService.broadcast('patientChanged', this.authService.getCurrentPatient());
    this.authService.setCurrentPatient(patient);
    this.router.navigate(['/home']);
  }

  addNewPatient() {
    this.router.navigate(['/new-patient']);
  }

  navigateToPatients() {
    this.router.navigate(['/patients']);
  }

  loadPatientId() {
    this.loadedPatientId = false;
    this.subscription.add(this.patientService.getPatientId()
      .subscribe(async (res: any) => {
        console.log(res);
        if (res == null) {
          if (this.authService.getRole() == 'Unknown') {
            this.router.navigate(['/welcome']);
          } else{
            if (this.sharedPatients && this.sharedPatients.length > 0) {
              this.selectPatient(this.sharedPatients[0]);
            } else {
              if (this.authService.getRole() == 'Clinical') {
                this.router.navigate(['/patients']);
              } else {
                this.router.navigate(['/new-patient']);
              }
            }
          }
          
        } else {
          this.loadedPatientId = true;
        }
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
      }));
  }

  callIsVerified() {
    this.subscription.add(this.http.get(environment.api + '/api/verified/' + this.authService.getIdUser())
      .subscribe((res: any) => {
        if (!res.infoVerified.isVerified) {
          this.router.navigate(['/welcome']);
        } else {
        }
      }, (err) => {
        console.log(err);
      }));

  }

  async ngOnInit() {


    if (this.innerWidth < 1200) {
      this.isSmallScreen = true;
    }
    else {
      this.isSmallScreen = false;
    }

    this.eventsService.on('tasksUpload', function (task) {
      (async () => {
        console.log('tasksUpload eventsService')
        //this.tasks.push(task);
      })();
    }.bind(this));

    this.eventsService.on('recentActivity', function (task) {
      (async () => {
        console.log('recentActivity');
        if (task.info.activity.length == 0) {
          // Eliminar todas las tareas de recentActivity para este paciente
          const indexesToRemove = this.tasks
            .map((t, index) => t.type === 'recentActivity' && t.patientId === task.info.patientId ? index : -1)
            .filter(index => index !== -1)
            .reverse(); // Reverse para eliminar desde el final y no afectar los índices

          indexesToRemove.forEach(index => {
            this.tasks.splice(index, 1);
          });
        } else {
          // Buscar si existe una tarea para este paciente específico
          const index = this.tasks.findIndex(t => 
            t.type === 'recentActivity' && 
            t.patientId === task.info.patientId
          );

          if (index !== -1) {
            // Actualizar la tarea existente
            this.tasks[index] = {
              ...task,
              patientId: task.info.patientId,
              createdDate: Date.now()
            };
          } else {
            // Añadir nueva tarea
            this.tasks.push({
              ...task,
              patientId: task.info.patientId,
              createdDate: Date.now()
            });
          }
        }
      })();
    }.bind(this));

    this.eventsService.on('recentAppointments', function (task) {
      (async () => {
        console.log('recentAppointments');
        if (task.count == 0) {
         // Eliminar todas las tareas de recentAppointments para este paciente
         const indexesToRemove = this.tasks
            .map((t, index) => t.type === 'recentAppointments' && t.patientId === task.patientId ? index : -1)
            .filter(index => index !== -1)
            .reverse(); // Reverse para eliminar desde el final y no afectar los índices

          indexesToRemove.forEach(index => {
            this.tasks.splice(index, 1);
          });
        } else {
          // Buscar si existe una tarea para este paciente específico
          const index = this.tasks.findIndex(t => 
            t.type === 'recentAppointments' && 
            t.patientId === task.patientId
          );


          if (index !== -1) {
            // Actualizar la tarea existente
            this.tasks[index] = {
              ...task,
              patientId: task.patientId,
              createdDate: Date.now()
            };

          } else {
            // Añadir nueva tarea
            this.tasks.push({
              ...task,
              patientId: task.patientId,
              createdDate: Date.now()
            });

          }
        }
      })();
    }.bind(this));


    this.eventsService.on('changelang', function (task) {
      (async () => {
        this.getTranslations();
      })();
    }.bind(this));


    this.getTranslations();

    /*this.initEnvironment();
    this.getSharedPatients();
    this.getUserInfo();*/
  }

  getActivityIcon(type: string) {
    //add the icon for the type of activity: event or document
    return type === 'event' ? 'fa-calendar' : 'fa-file-alt';
  }

  seeRecentActivity(info: any, PanelRecentActivity: any) {
    this.recentActivities = info;
    if(this.modalReference){
      this.modalReference.close();
    }
    let ngbModalOptions: NgbModalOptions = {
      backdrop : 'static',
      keyboard : false,
      windowClass: 'ModalClass-xl'// xl, lg, sm
    };
    this.modalReference  = this.modalService.open(PanelRecentActivity, ngbModalOptions);
    //this.modalReference = this.modalService.open(PanelRecentActivity, { size: 'xl' });
    /*Swal.fire({
      html: info.summary,
      icon: 'info',
      showCancelButton: false,
      confirmButtonText: 'ok'
    });*/
  }

  seeRecentAppointments(patientId: any) {
    //set the patient is not the current patient
    const patient = this.patientsList.find(patient => patient.sub === patientId);
      if (patient) {
        this.selectPatient(patient);
      } else {
        if (this.sharedPatients && this.sharedPatients.length > 0) {
          const sharedPatient = this.sharedPatients.find(patient => patient.sub === patientId);
          if (sharedPatient) {
            this.selectPatient(sharedPatient);
          }
        }

      }
    this.eventsService.broadcast('changeView', 'diary');


  }

  getTranslations() {
    this.translateExtractingTheText = this.translate.instant('messages.m1.1');
    this.translateYouCanAskInChat = this.translate.instant('messages.m2.1');
    this.translateExtractingMedicalEvents = this.translate.instant('messages.m4.1');
    this.translateGeneratingSummary = this.translate.instant('messages.m3.1');
    this.translateAnonymizingDocument = this.translate.instant('messages.m5.1');
    this.translateSummaryPatient = this.translate.instant('messages.m6.1');
    this.translateAnomalies = this.translate.instant('messages.m7.1');
  }

  getEventsWebPubSub() {
    let steps = {
      upload: this.initializeSteps('upload'),
      anonymize: this.initializeSteps('anonymize'),
      summary: this.initializeSteps('summary')
    };

    this.messageSubscription = this.webPubSubService.getMessageObservable().subscribe(message => {
      //console.log('Message received in component:', message);
      const parsedData = JSON.parse(message.data);
      const index = this.tasks.findIndex(task => task.docId === parsedData.docId && (parsedData.step ? task.step === parsedData.step : true));

      if (index > -1) {
        steps = this.assignStepsToTask(parsedData, index);
      } else {
        steps = {
          upload: this.initializeSteps('upload'),
          anonymize: this.initializeSteps('anonymize'),
          summary: this.initializeSteps('summary')
        };
      }

      this.updateTaskSteps(parsedData, steps.upload, steps.anonymize, steps.summary);

      if (!parsedData.step) {
        parsedData.steps = steps.upload;
        parsedData.step = 'upload';
      } else {
        this.assignParsedDataSteps(parsedData, steps.anonymize, steps.summary);
      }

      this.updateTaskList(parsedData, index);
    });
  }

  private initializeSteps(type: string) {
    const stepsMap = {
      upload: [
        { name: this.translateExtractingTheText, status: 'pending' },
        { name: this.translateExtractingMedicalEvents, status: 'pending' },
        { name: this.translateYouCanAskInChat, status: 'pending' },
        { name: this.translateGeneratingSummary, status: 'pending' }
      ],
      anonymize: [
        { name: this.translateAnonymizingDocument, status: 'pending', time: undefined }
      ],
      summary: [
        { name: this.translateSummaryPatient, status: 'pending', time: undefined }
      ]
    };
    return stepsMap[type] || stepsMap.upload;
  }

  private assignStepsToTask(parsedData: any, index: number) {
    let steps = {
      upload: this.initializeSteps('upload'),
      anonymize: this.initializeSteps('anonymize'),
      summary: this.initializeSteps('summary')
    };

    if (!parsedData.step) {
      steps.upload = this.tasks[index].steps;
    } else if (parsedData.step === 'anonymize') {
      steps.anonymize = this.tasks[index].steps;
    } else if (parsedData.step === 'summary') {
      steps.summary = this.tasks[index].steps;
    }

    return steps;
  }

  private updateTaskSteps(parsedData: any, stepsTaskUpload: any[], stepsTaskAnonimize: any[], stepsTaskSummary: any[]) {
    const updateStepStatus = (steps: any[], status: string, index: number) => {
      if (index !== undefined && steps[index] && steps[index].status !== 'finished' && steps[3].status !== 'finished') {
        steps[index].status = status.includes('error') ? 'failed' : status;
      }
    };

    const statusMap = {
      'inProcess': () => stepsTaskUpload[0].status = 'inProcess',
      'extracted done': () => updateStepStatus(stepsTaskUpload, 'finished', 0),
      'creando resumen': () => stepsTaskUpload[3].status = 'inProcess',
      'resumen ready': () => {
        updateStepStatus(stepsTaskUpload, 'finished', 0);
        updateStepStatus(stepsTaskUpload, 'finished', 3);
      },
      'categorizando texto': () => stepsTaskUpload[1].status = 'inProcess',
      'clean ready': () => {
        updateStepStatus(stepsTaskUpload, 'finished', 0);
        updateStepStatus(stepsTaskUpload, 'finished', 1);
        updateStepStatus(stepsTaskUpload, 'finished', 2);
      },
      'error cleaning': () => {
        updateStepStatus(stepsTaskUpload, 'failed', 1);
        updateStepStatus(stepsTaskUpload, 'failed', 2);
      },
      'failed': () => {
        stepsTaskUpload.forEach((step, idx) => updateStepStatus(stepsTaskUpload, 'failed', idx));
        if (this.actualUrl !== '/welcome' && this.actualUrl !== '/new-patient') {
          Swal.fire('', this.translate.instant("messages.errProcFile"), "error");
        }
      },
      'error summarize': () => updateStepStatus(stepsTaskUpload, 'failed', 3),
      'error anomalies': () => updateStepStatus(stepsTaskUpload, 'failed', 3),
      'error timeline': () => updateStepStatus(stepsTaskUpload, 'failed', 3),
      'new events extracted': () => {
        updateStepStatus(stepsTaskUpload, 'finished', 0);
        stepsTaskUpload[1].data = parsedData.data + ' ' + this.translate.instant("messages.m4.3");
      },
      'anonimizando documentos': () => {
        if (stepsTaskAnonimize[0].status !== 'finished') {
          stepsTaskAnonimize[0].status = 'inProcess';
        }
      },
      'anonymize ready': () => stepsTaskAnonimize[0].status = 'finished',
      'error anonymize': () => {
        if (stepsTaskAnonimize[0].status !== 'finished') {
          stepsTaskAnonimize[0].status = 'failed';
        }
      },
      'patient card started': () => {
        const stepsTime = stepsTaskSummary[0].time ? new Date(stepsTaskSummary[0].time) : null;
        const parsedTime = new Date(parsedData.time);
        if (stepsTaskSummary[0].status !== 'finished' || !stepsTime || stepsTime < parsedTime) {
          stepsTaskSummary[0].status = 'inProcess';
          stepsTaskSummary[0].time = parsedData.time;
        }
      },
      'patient card ready': () => stepsTaskSummary[0].status = 'finished',
      'patient card fail': () => {
        const stepsTime = stepsTaskSummary[0].time ? new Date(stepsTaskSummary[0].time) : null;
        const parsedTime = new Date(parsedData.time);
        if (stepsTaskSummary[0].status !== 'finished' || !stepsTime || stepsTime < parsedTime) {
          stepsTaskSummary[0].status = 'failed';
          stepsTaskSummary[0].time = parsedData.time;
        }
      }
    };

    if (statusMap[parsedData.status]) {
      statusMap[parsedData.status]();
    }
  }

  private assignParsedDataSteps(parsedData: any, stepsTaskAnonimize: any[], stepsTaskSummary: any[]) {
    if (parsedData.step === 'anonymize') {
      parsedData.steps = stepsTaskAnonimize;
      parsedData.step = 'anonymize';
    } else if (parsedData.step === 'summary') {
      parsedData.steps = stepsTaskSummary;
      parsedData.step = 'summary';
    }
  }

  private updateTaskList(parsedData: any, index: number) {
    if (index > -1) {
      parsedData.createdDate = this.tasks[index].createdDate;
      this.tasks[index] = parsedData;
    } else {
      if (parsedData.step !== 'navigator' && parsedData.step !== 'extract events') {
        parsedData.createdDate = Date.now();
        this.tasks.push(parsedData);
      }
    }
  }

  getPatientName(patientId: string): string {
    const patient = this.patientsList.find(p => p.sub === patientId) ||
      this.sharedPatients.find(p => p.sub === patientId);
    return patient ? patient.patientName : 'Unknown Patient';
  }

  async onMessageClick(step, task) {
    this.patientsList = this.authService.getPatientList();
    const currentPatient = this.authService.getCurrentPatient();
    if (currentPatient && currentPatient.sub !== task.patientId) {
      const patient = this.patientsList.find(patient => patient.sub === task.patientId);
      if (patient) {
        this.selectPatient(patient);
      } else {
        if (this.sharedPatients && this.sharedPatients.length > 0) {
          const sharedPatient = this.sharedPatients.find(patient => patient.sub === task.patientId);
          if (sharedPatient) {
            this.selectPatient(sharedPatient);
          }
        }

      }
    }

    if (step.status === 'finished' &&
      step.name !== this.translateYouCanAskInChat &&
      (step.name === this.translateGeneratingSummary ||
        step.name === this.translateAnonymizingDocument ||
        step.name === this.translateSummaryPatient)) {

      Swal.fire({
        title: this.translate.instant("generics.Please wait"),
        showCancelButton: false,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
      });

      if (this.router.url != '/home') {
        await this.router.navigate(['/home']);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));

      const info = {
        'task': task,
        'step': step
      };
      this.eventsService.broadcast('eventTask', info);
      Swal.close();
    }
  }

  timeSinceNotification(date): string {
    const currentTime = Date.now();
    const timeDifference = currentTime - date;
    const minutesDifference = Math.floor(timeDifference / 1000 / 60);

    let msg;
    if (minutesDifference < 60) {
      msg = this.translate.instant("messages.minago", { value: minutesDifference });
    } else if (minutesDifference < 1440) { // 1440 minutos en un día
      const hoursDifference = Math.floor(minutesDifference / 60);
      msg = this.translate.instant("messages.hourago", { value: hoursDifference });
    } else {
      const daysDifference = Math.floor(minutesDifference / 1440);
      msg = this.translate.instant("messages.dayago", { value: daysDifference });
    }

    return `${msg}`;
  }

  ngAfterViewInit() {

    this.configSub = this.configService.templateConf$.subscribe((templateConf) => {
      if (templateConf) {
        this.config = templateConf;
      }
      this.loadLayout();
      this.cdr.markForCheck();

    })
  }

  ngOnDestroy() {
    if (this.layoutSub) {
      this.layoutSub.unsubscribe();
    }
    if (this.configSub) {
      this.configSub.unsubscribe();
    }
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.eventsService.destroy();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.innerWidth = event.target.innerWidth;
    if (this.innerWidth < 1200) {
      this.isSmallScreen = true;
    }
    else {
      this.isSmallScreen = false;
    }
  }

  loadLayout() {

    if (this.config.layout.menuPosition && this.config.layout.menuPosition.toString().trim() != "") {
      this.menuPosition = this.config.layout.menuPosition;
    }

    if (this.config.layout.variant === "Light") {
      this.logoUrl = 'assets/img/logo.png';
    }
    else {
      this.logoUrl = 'assets/img/logo.png';
    }

    if (this.config.layout.variant === "Transparent") {
      this.transparentBGClass = this.config.layout.sidebar.backgroundColor;
    }
    else {
      this.transparentBGClass = "";
    }

  }

  toggleNotificationSidebar() {
    this.layoutService.toggleNotificationSidebar(true);
  }

  toggleSidebar() {
    const appSidebar = document.getElementsByClassName("app-sidebar")[0];
    if (appSidebar.classList.contains("hide-sidebar")) {
      this.toggleHideSidebar.emit(false);
    } else {
      this.toggleHideSidebar.emit(true);
    }
  }

  toggleMenu() {
    this.isMenuExpanded = !this.isMenuExpanded;
  }

  closeMenu() {
    this.isMenuExpanded = false;
    this.isMenuExpanded2 = false;
  }

  logout() {
    this.authService.logout();
  }

  exit() {
    navigator.app.exitApp();
  }

  deleteTasks() {
    this.tasks = [];
  }

  toggleMenu2(): void {
    this.isMenuExpanded2 = !this.isMenuExpanded2;
  }

  share() {
    this.openModal(this.contentshareCustom);
  }

  openModal(modaltemplate) {
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
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

}
