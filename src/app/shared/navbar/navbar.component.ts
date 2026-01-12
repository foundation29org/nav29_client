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
  
  // Mapa para almacenar mensajes pendientes por patientId
  // Estructura: { [patientId: string]: Array<{ parsedData: any, timestamp: number }> }
  pendingMessages: Map<string, Array<{ parsedData: any, timestamp: number }>> = new Map();

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
    var touchDevice = (navigator.maxTouchPoints || ('ontouchstart' in document.documentElement ? 1 : 0));
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
          } else {
            // Calcular total de pacientes (propios + compartidos)
            // Usar authService.getPatientList() como fallback por si patientsList no está actualizado aún
            const ownPatients = this.patientsList?.length > 0 ? this.patientsList : (this.authService.getPatientList() || []);
            const shared = this.sharedPatients || [];
            const totalPatients = ownPatients.length + shared.length;
            
            if (totalPatients === 0) {
              // No hay pacientes, ir a crear uno (o lista para Clinical)
              if (this.authService.getRole() == 'Clinical') {
                this.router.navigate(['/patients']);
              } else {
                this.router.navigate(['/new-patient']);
              }
            } else if (totalPatients === 1) {
              // Solo 1 paciente, auto-seleccionarlo
              const singlePatient = ownPatients.length === 1 ? ownPatients[0] : shared[0];
              this.selectPatient(singlePatient);
            } else {
              // Más de 1 paciente, ir a la lista para que el usuario elija
              this.router.navigate(['/patients']);
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

    this.eventsService.on('get-pending-messages', function (patientId) {
      const pendingMessages = this.getPendingMessages(patientId);
      // Enviar los mensajes pendientes de vuelta al componente home
      this.eventsService.broadcast('pending-messages-response', pendingMessages);
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
      
      // Interceptar mensajes de chat (navigator) y extract events para almacenarlos si son para otro paciente
      if (parsedData.patientId && (parsedData.step === 'navigator' || parsedData.step === 'extract events')) {
        const currentPatient = this.authService.getCurrentPatient();
        const isForCurrentPatient = currentPatient && parsedData.patientId == currentPatient.sub;
        const isOnHome = this.actualUrl === '/home' || this.actualUrl.startsWith('/home') || 
                        this.router.url === '/home' || this.router.url.startsWith('/home');
        
        // Si el mensaje es para otro paciente O no estamos en home, almacenarlo como pendiente
        if (!isForCurrentPatient || !isOnHome) {
          this.storePendingMessage(parsedData);
          
          // Crear notificación solo para respuestas finales o errores
          if (parsedData.step === 'navigator' && 
              (parsedData.status === 'respuesta generada' || parsedData.status === 'error')) {
            this.createChatNotification(parsedData);
          } else if (parsedData.step === 'extract events' && parsedData.status === 'respuesta analizada') {
            this.createEventsNotification(parsedData);
          }
        }
      }
      
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
      // Solo verificar que el step exista y no esté ya terminado
      // Removida la condición steps[3].status !== 'finished' que bloqueaba actualizaciones
      // cuando el resumen terminaba antes que otros pasos
      if (index !== undefined && steps[index] && steps[index].status !== 'finished') {
        steps[index].status = status.includes('error') ? 'failed' : status;
      }
    };

    const statusMap = {
      'inProcess': () => stepsTaskUpload[0].status = 'inProcess',
      'extracted done': () => updateStepStatus(stepsTaskUpload, 'finished', 0),
      'creando resumen': () => stepsTaskUpload[3].status = 'inProcess',
      'resumen ready': () => {
        // Marcar TODOS los steps como finished cuando el resumen está listo
        // Esto es importante si el cliente se conectó tarde y no recibió los mensajes anteriores
        updateStepStatus(stepsTaskUpload, 'finished', 0);
        updateStepStatus(stepsTaskUpload, 'finished', 1);
        updateStepStatus(stepsTaskUpload, 'finished', 2);
        updateStepStatus(stepsTaskUpload, 'finished', 3);
      },
      'timeline ready': () => {
        // Timeline ready indica que la extracción de eventos terminó
        // Marcar steps 0, 1, 2 como finished
        updateStepStatus(stepsTaskUpload, 'finished', 0);
        updateStepStatus(stepsTaskUpload, 'finished', 1);
        updateStepStatus(stepsTaskUpload, 'finished', 2);
      },
      'anomalies found': () => {
        // Anomalías encontradas indica que la extracción de info médica terminó
        // Marcar steps 0, 1, 2 como finished
        updateStepStatus(stepsTaskUpload, 'finished', 0);
        updateStepStatus(stepsTaskUpload, 'finished', 1);
        updateStepStatus(stepsTaskUpload, 'finished', 2);
      },
      'no anomalies found': () => {
        // Sin anomalías también indica que la extracción terminó
        updateStepStatus(stepsTaskUpload, 'finished', 0);
        updateStepStatus(stepsTaskUpload, 'finished', 1);
        updateStepStatus(stepsTaskUpload, 'finished', 2);
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
          // Usar el error específico si existe, sino usar el genérico
          const errorKey = parsedData.error || "messages.errProcFile";
          // Si es una key de traducción (empieza con messages.), traducirla
          const errorMessage = errorKey.startsWith('messages.') 
            ? this.translate.instant(errorKey) 
            : errorKey;
          Swal.fire('', errorMessage, "error");
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

  /**
   * Almacena un mensaje pendiente para un paciente
   * Busca el paciente en todos los lugares posibles y almacena usando el patientId original
   */
  private storePendingMessage(parsedData: any): void {
    if (!parsedData.patientId) {
      return;
    }
    
    const messageData = {
      parsedData: parsedData,
      timestamp: Date.now()
    };
    
    // Almacenar usando el patientId original (puede ser _id de MongoDB o sub encriptado)
    const storageKey = parsedData.patientId;
    if (!this.pendingMessages.has(storageKey)) {
      this.pendingMessages.set(storageKey, []);
    }
    this.pendingMessages.get(storageKey).push(messageData);
    
    // Intentar encontrar el paciente por su _id (MongoDB) o por su sub (encriptado)
    // El backend puede enviar el patientId encriptado o sin encriptar
    const patient = this.patientsList.find(p => 
      p.sub === parsedData.patientId || 
      (p as any)._id === parsedData.patientId
    ) || this.sharedPatients.find(p => 
      p.sub === parsedData.patientId || 
      (p as any)._id === parsedData.patientId
    );
    
    if (patient) {
      // Si encontramos el paciente, almacenar también por su sub (si es diferente)
      if (patient.sub !== parsedData.patientId) {
        if (!this.pendingMessages.has(patient.sub)) {
          this.pendingMessages.set(patient.sub, []);
        }
        this.pendingMessages.get(patient.sub).push(messageData);
        console.log(`💾 Mensaje también almacenado por sub: ${patient.sub}`);
      }
      
      // Si el paciente tiene _id y es diferente, almacenar también por _id
      const patientId = (patient as any)._id;
      if (patientId && patientId !== parsedData.patientId && patientId !== patient.sub) {
        if (!this.pendingMessages.has(patientId)) {
          this.pendingMessages.set(patientId, []);
        }
        this.pendingMessages.get(patientId).push(messageData);
        console.log(`💾 Mensaje también almacenado por _id: ${patientId}`);
      }
    }
    
    console.log(`💾 Mensaje almacenado. Clave principal: ${storageKey}, Total: ${this.pendingMessages.get(storageKey).length}`);
  }

  /**
   * Obtiene y elimina los mensajes pendientes para un paciente
   * Busca por sub del paciente, _id (ID de MongoDB), o patientId original del mensaje
   */
  getPendingMessages(patientIdOrSub: string): Array<{ parsedData: any, timestamp: number }> {
    console.log(`🔍 Buscando mensajes pendientes para: ${patientIdOrSub}`);
    console.log(`  - Claves disponibles en pendingMessages:`, Array.from(this.pendingMessages.keys()));
    
    // PRIMERO: buscar en todos los mensajes pendientes por patientId en parsedData
    // Esto es lo más importante porque los mensajes se almacenan con el patientId original
    const allMessages: Array<{ parsedData: any, timestamp: number }> = [];
    for (const [key, messages] of this.pendingMessages.entries()) {
      const matchingMessages = messages.filter(msg => 
        msg.parsedData.patientId === patientIdOrSub
      );
      if (matchingMessages.length > 0) {
        allMessages.push(...matchingMessages);
        // Eliminar los mensajes encontrados de la lista original
        const remainingMessages = messages.filter(msg => msg.parsedData.patientId !== patientIdOrSub);
        if (remainingMessages.length === 0) {
          this.pendingMessages.delete(key);
        } else {
          this.pendingMessages.set(key, remainingMessages);
        }
      }
    }
    if (allMessages.length > 0) {
      console.log(`📤 Obtenidos ${allMessages.length} mensajes pendientes buscando por patientId en parsedData: ${patientIdOrSub}`);
      return allMessages;
    }
    
    // Si no se encontró por patientId directo, intentar encontrar el paciente y buscar por su _id
    // Esto es útil cuando se busca por sub pero los mensajes tienen el _id como patientId
    const foundPatient = this.patientsList.find(p => p.sub === patientIdOrSub || (p as any)._id === patientIdOrSub) ||
                    this.sharedPatients.find(p => p.sub === patientIdOrSub || (p as any)._id === patientIdOrSub);
    
    if (foundPatient) {
      // Si el paciente tiene un _id, buscar mensajes que tengan ese _id como patientId en parsedData
      const foundPatientId = (foundPatient as any)._id;
      if (foundPatientId) {
        const patientMessages: Array<{ parsedData: any, timestamp: number }> = [];
        for (const [key, messages] of this.pendingMessages.entries()) {
          const matchingMessages = messages.filter(msg => msg.parsedData.patientId === foundPatientId);
          if (matchingMessages.length > 0) {
            patientMessages.push(...matchingMessages);
            // Eliminar los mensajes encontrados de la lista original
            const remainingMessages = messages.filter(msg => msg.parsedData.patientId !== foundPatientId);
            if (remainingMessages.length === 0) {
              this.pendingMessages.delete(key);
            } else {
              this.pendingMessages.set(key, remainingMessages);
            }
          }
        }
        if (patientMessages.length > 0) {
          console.log(`📤 Obtenidos ${patientMessages.length} mensajes pendientes buscando por patientId (_id) en parsedData: ${foundPatientId}`);
          return patientMessages;
        }
      }
    }
    
    // SEGUNDO: buscar por la clave exacta (puede ser patientId original o sub)
    if (this.pendingMessages.has(patientIdOrSub)) {
      const messages = this.pendingMessages.get(patientIdOrSub);
      this.pendingMessages.delete(patientIdOrSub);
      console.log(`📤 Obtenidos ${messages.length} mensajes pendientes para ${patientIdOrSub} (búsqueda exacta)`);
      return messages;
    }
    
    // TERCERO: intentar buscar el paciente y usar su _id o sub
    const patient = this.patientsList.find(p => p.sub === patientIdOrSub || (p as any)._id === patientIdOrSub) ||
                    this.sharedPatients.find(p => p.sub === patientIdOrSub || (p as any)._id === patientIdOrSub);
    
    if (patient) {
      // Buscar por sub del paciente
      if (this.pendingMessages.has(patient.sub)) {
        const messages = this.pendingMessages.get(patient.sub);
        this.pendingMessages.delete(patient.sub);
        console.log(`📤 Obtenidos ${messages.length} mensajes pendientes para ${patient.sub} (buscado por sub)`);
        return messages;
      }
      
      // Buscar por _id del paciente
      const patientId = (patient as any)._id;
      if (patientId && this.pendingMessages.has(patientId)) {
        const messages = this.pendingMessages.get(patientId);
        this.pendingMessages.delete(patientId);
        console.log(`📤 Obtenidos ${messages.length} mensajes pendientes para ${patientId} (buscado por _id)`);
        return messages;
      }
    }
    
    // CUARTO: buscar en TODOS los mensajes pendientes y verificar si alguno corresponde al paciente actual
    // Esto maneja el caso cuando el backend envía el patientId encriptado o sin encriptar
    if (patient) {
      const allPatientMessages: Array<{ parsedData: any, timestamp: number }> = [];
      const patientSub = patient.sub;
      const patientId = (patient as any)._id;
      
      // Buscar en todos los mensajes pendientes
      for (const [key, messages] of this.pendingMessages.entries()) {
        // Para cada mensaje, verificar si el patientId corresponde al paciente actual
        const matchingMessages = messages.filter(msg => {
          const msgPatientId = msg.parsedData.patientId;
          if (!msgPatientId) return false;
          
          // Comparar directamente con sub y _id del paciente
          if (msgPatientId === patientSub || msgPatientId === patientId) {
            return true;
          }
          
          // Si el patientId del mensaje es un _id de MongoDB, buscar el paciente correspondiente
          const patientWithThisId = this.patientsList.find(p => (p as any)._id === msgPatientId) ||
                                     this.sharedPatients.find(p => (p as any)._id === msgPatientId);
          
          // Si encontramos un paciente con ese _id y es el mismo que estamos buscando
          if (patientWithThisId && patientWithThisId.sub === patientSub) {
            return true;
          }
          
          return false;
        });
        
        if (matchingMessages.length > 0) {
          allPatientMessages.push(...matchingMessages);
          // Eliminar los mensajes encontrados de la lista original
          const remainingMessages = messages.filter(msg => {
            const msgPatientId = msg.parsedData.patientId;
            if (!msgPatientId) return true;
            
            if (msgPatientId === patientSub || msgPatientId === patientId) {
              return false;
            }
            
            const patientWithThisId = this.patientsList.find(p => (p as any)._id === msgPatientId) ||
                                       this.sharedPatients.find(p => (p as any)._id === msgPatientId);
            
            return !(patientWithThisId && patientWithThisId.sub === patientSub);
          });
          
          if (remainingMessages.length === 0) {
            this.pendingMessages.delete(key);
          } else {
            this.pendingMessages.set(key, remainingMessages);
          }
        }
      }
      
      if (allPatientMessages.length > 0) {
        console.log(`📤 Obtenidos ${allPatientMessages.length} mensajes pendientes para paciente ${patientSub}`);
        return allPatientMessages;
      }
    }
    
    console.log(`⚠️ No se encontraron mensajes pendientes para: ${patientIdOrSub}`);
    return [];
  }

  /**
   * Crea una notificación para mensajes de chat
   */
  private createChatNotification(parsedData: any): void {
    const existingIndex = this.tasks.findIndex(
      task => task.type === 'chat-response' && task.patientId === parsedData.patientId
    );
    
    const notificationTask = {
      type: 'chat-response',
      patientId: parsedData.patientId,
      createdDate: Date.now(),
      title: this.translate.instant('messages.chatResponseReady') || 'Respuesta del chat lista',
      message: this.translate.instant('messages.newChatResponse') || 'Hay una nueva respuesta en el chat',
      parsedData: parsedData,
      messageId: `chat_${parsedData.patientId}_${Date.now()}`
    };
    
    if (existingIndex > -1) {
      this.tasks[existingIndex] = notificationTask;
    } else {
      this.tasks.unshift(notificationTask);
    }
    
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  /**
   * Crea una notificación para eventos extraídos
   */
  private createEventsNotification(parsedData: any): void {
    const notificationType = parsedData.status === 'respuesta analizada' ? 'events-extracted' : 'appointments-extracted';
    const existingIndex = this.tasks.findIndex(
      task => task.type === notificationType && task.patientId === parsedData.patientId
    );
    
    const notificationTask = {
      type: notificationType,
      patientId: parsedData.patientId,
      createdDate: Date.now(),
      title: notificationType === 'events-extracted' 
        ? (this.translate.instant('messages.eventsExtracted') || 'Eventos extraídos')
        : (this.translate.instant('messages.appointmentsExtracted') || 'Citas extraídas'),
      message: notificationType === 'events-extracted'
        ? (this.translate.instant('messages.eventsHaveBeenExtracted') || 'Se han extraído nuevos eventos médicos')
        : (this.translate.instant('messages.appointmentsHaveBeenExtracted') || 'Se han extraído nuevas citas'),
      parsedData: parsedData,
      messageId: `${notificationType}_${parsedData.patientId}_${Date.now()}`
    };
    
    if (existingIndex > -1) {
      this.tasks[existingIndex] = notificationTask;
    } else {
      this.tasks.unshift(notificationTask);
    }
    
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  /**
   * Navega a home y muestra los mensajes pendientes para un paciente
   * El backend ya guarda todo, solo necesitamos navegar al paciente correcto
   * y getMessages() se encargará de cargar todo desde la BD
   */
  async seePendingMessages(task: any) {
    console.log('🔵 seePendingMessages llamado para:', task.type, 'patientId:', task.patientId);
    
    const currentPatient = this.authService.getCurrentPatient();
    const isOnHome = this.router.url === '/home' || this.router.url.startsWith('/home');
    
    // Asegurarse de tener pacientes compartidos cargados
    if (!this.sharedPatients || this.sharedPatients.length === 0) {
      try {
        const sharedPatientsResult = await this.getSharedPatients().toPromise();
        if (sharedPatientsResult) {
          this.sharedPatients = sharedPatientsResult;
        }
      } catch (err) {
        console.error('Error obteniendo pacientes compartidos:', err);
      }
    }
    
    // Buscar el paciente objetivo
    let targetPatient = null;
    if (task.patientId) {
      targetPatient = this.patientsList.find(p => p.sub === task.patientId) ||
        this.sharedPatients.find(p => p.sub === task.patientId) ||
        this.patientsList.find(p => (p as any)._id === task.patientId) ||
        this.sharedPatients.find(p => (p as any)._id === task.patientId);
    }
    
    const needsPatientChange = targetPatient && currentPatient && currentPatient.sub !== targetPatient.sub;
    const needsNavigation = !isOnHome;
    
    // CASO 1: Necesita cambio de paciente
    // selectPatient dispara patientChanged → handlePatientChanged → getMessages()
    if (needsPatientChange) {
      console.log('🔄 Cambiando al paciente:', targetPatient.patientName);
      this.selectPatient(targetPatient);
      
      // Si también necesitamos navegar, lo hacemos después del cambio de paciente
      if (needsNavigation) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.router.navigate(['/home']);
      }
      // getMessages() ya se llamó automáticamente por patientChanged
    }
    // CASO 2: Mismo paciente pero no estamos en home
    else if (needsNavigation) {
      console.log('🔄 Navegando a home');
      await this.router.navigate(['/home']);
      // getMessages() se llamará en ngOnInit/initEnvironment
    }
    // CASO 3: Ya estamos en el paciente correcto y en home
    else {
      console.log('✅ Ya estamos en el paciente correcto, recargando mensajes');
      // Forzar recarga de mensajes desde el servidor
      this.eventsService.broadcast('reload-messages', null);
    }
    
    // Eliminar la notificación
    const index = this.tasks.findIndex(t => t.type === task.type && t.messageId === task.messageId);
    if (index > -1) {
      this.tasks.splice(index, 1);
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    }
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
