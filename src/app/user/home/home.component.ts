import { Component, OnInit, OnDestroy,AfterViewChecked, ViewChild, TemplateRef, HostListener, ChangeDetectorRef, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, NavigationStart } from '@angular/router';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { AuthGuard } from 'app/shared/auth/auth-guard.service';
import { PatientService } from 'app/shared/services/patient.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../app/shared/auth/auth.service';
import { SortService } from 'app/shared/services/sort.service';
import { DateService } from 'app/shared/services/date.service';
import { SearchService } from 'app/shared/services/search.service';
import { ApiDx29ServerService } from 'app/shared/services/api-dx29-server.service';
import { TrackEventsService } from 'app/shared/services/track-events.service';
import { Subscription, finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { EventsService } from 'app/shared/services/events.service';
import { WebPubSubService } from 'app/shared/services/web-pub-sub.service';
import { jsPDFService } from 'app/shared/services/jsPDF.service'
import { Clipboard } from "@angular/cdk/clipboard"
import { jsPDF } from "jspdf";
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
Chart.register(...registerables, annotationPlugin);

import { InsightsService } from 'app/shared/services/azureInsights.service';
import { LangService } from 'app/shared/services/lang.service';
import { SpeechRecognitionService } from 'app/shared/services/speech-recognition.service';
import * as QRCode from 'qrcode';
import { FeedbackSummaryPageComponent } from 'app/user/feedback-summary/feedback-summary-page.component';
import { EditMedicalEventComponent } from 'app/user/edit-event-modal/edit-medical-event.component';
import { NewMedicalEventComponent } from 'app/user/new-event-modal/new-medical-event.component';
import { LanguageSelectModalComponent } from 'app/user/language-select/language-select.component';
declare var webkitSpeechRecognition: any;
import * as hopscotch from 'hopscotch';
import { HighlightService } from 'app/shared/services/highlight.service';
import { interval } from 'rxjs';
import { filter, take, timeout } from 'rxjs/operators';
import { ActivityService } from 'app/shared/services/activity.service';

// Interfaces para tipar los datos (como dataclasses en Python)
interface DxGptDiagnosis {
  diagnosis: string;
  description: string;
  symptoms_in_common: string[];
  symptoms_not_in_common: string[];
}

interface DxGptAnonymization {
  hasPersonalInfo: boolean;
  anonymizedText: string;
  anonymizedTextHtml: string;
}

interface DxGptAnalysis {
  result: string;
  data: DxGptDiagnosis[];
  anonymization: DxGptAnonymization;
  detectedLang: string;
}

interface DxGptResponse {
  success: boolean;
  analysis?: DxGptAnalysis; // El ? significa que es opcional (puede ser undefined)
  error?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  animations: [
    trigger('cardAnimation', [
      state('center', style({ transform: 'translateX(0)', opacity: 1 })),
      state('left', style({ transform: 'translateX(-100%)', opacity: 0 })),
      state('right', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('top', style({ transform: 'translateY(-100%)', opacity: 0 })),
      state('enterFromRight', style({ transform: 'translateX(0)', opacity: 1 })),
      state('enterFromLeft', style({ transform: 'translateX(0)', opacity: 1 })),
      state('voidRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('voidLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      transition('center => left, center => right, center => top', [animate('0.5s ease-out')]),
      transition('voidRight => enterFromRight', [animate('0.5s ease-out')]),
      transition('voidLeft => enterFromLeft', [animate('0.5s ease-out')]),
    ]),
    trigger('messageAnimation', [
      transition(':enter', [
        style({ 
          opacity: 0, 
          transform: 'translateX(-20px)'
        }),
        animate('0.6s ease-out', 
          style({ 
            opacity: 1, 
            transform: 'translateX(0)'
          })
        )
      ])
    ]),
    trigger('slideOut', [
      state('in', style({ 
        transform: 'translateX(0)', 
        opacity: 1 
      })),
      state('out', style({ 
        transform: 'translateX(100%)', 
        opacity: 0 
      })),
      transition('in => out', [
        animate('300ms ease-out')
      ])
    ]),
    trigger('slideDown', [
      transition(':enter', [
        style({
          height: 0,
          overflow: 'hidden'
        }),
        animate('0.3s ease-out', 
          style({
            height: '*'
          })
        )
      ]),
      transition(':leave', [
        style({
          height: '*',
          overflow: 'hidden'
        }),
        animate('0.3s ease-out', 
          style({
            height: 0
          })
        )
      ])
    ])
  ]
})

export class HomeComponent implements OnInit, OnDestroy, AfterViewChecked {
  private subscription: Subscription = new Subscription();
  eventsForm: FormGroup;
  dataFile: any = {};
  tempDocs: any = [];
  submitted = false;
  showTimeField = false;
  saving: boolean = false;
  showTextAreaFlag: boolean = false;
  medicalText: string = '';
  summaryDx29: string = '';
  loadedDocs: boolean = false;
  docs: any = [];

  query: string = '';
  queryCopy: string = '';
  callinglangchainraito: boolean = false;
  responseLangchain: string = '';
  savedRecommendations: any = [];
  actualDoc: any = {};
  tempDoc: any = {};
  modalReference: NgbModalRef;
  modalReference2: NgbModalRef;
  modalReferenceSummary: NgbModalRef;

  messages = [];
  message = '';
  callingOpenai: boolean = false;
  chatRecording: boolean = false;
  chatMode: 'fast' | 'advanced' = 'fast'; // Modo de respuesta: fast (gpt-4.1-mini) o advanced (gpt5mini)
  showChatOptions: boolean = false; // Mostrar menú de opciones del chat
  chatVoiceSupported: boolean = false;
  private chatSpeechSubscription: Subscription;
  lastProcessedAnswerId: string = ''; // Para evitar procesar respuestas duplicadas

  tempInput: string = '';
  detectedLang: string = 'en';
  preferredResponseLanguage: string = 'en';
  intent: string = '';
  context = [];

  callingTextAnalytics: boolean = false;
  resTextAnalyticsSegments: any;
  events = [];
  allEvents = [];
  allTypesEvents = [];
  subtypes = [];
  metadata: any = [];

  pendingDoc: boolean = false;

  notallergy: boolean = true;
  defaultDoc: any = {};

  loadedEvents: boolean = false;
  loadedAllEvents: boolean = false;

  loadingAppointments: boolean = false;
  appointments = [];

  accessToken = {
    // tslint:disable-next-line:max-line-length
    sasToken: null,
    blobAccountUrl: environment.blobAccountUrl,
    containerName: '',
    patientId: ''
  };
  resultText: string = '';
  summaryDoc: any = {};
  summaryJson: any = {};
  needFeedback: boolean = true;
  private messageSubscription: Subscription;
  private processedAnomalies: Set<string> = new Set(); // Control para evitar duplicados de anomalías
  @ViewChild('contentviewSummary', { static: false }) contentviewSummary: TemplateRef<any>;
  @ViewChild('contentviewDoc', { static: false }) contentviewDoc: TemplateRef<any>;
  @ViewChild('contentSummaryDoc', { static: false }) contentSummaryDoc: TemplateRef<any>;
  @ViewChild('documentContextModal', { static: false }) documentContextModal: TemplateRef<any>;
  @ViewChild('contentviewProposedEvents', { static: false }) contentviewProposedEvents: TemplateRef<any>;
  @ViewChild('shareCustom', { static: false }) contentshareCustom: TemplateRef<any>;
  @ViewChild('qrPanel', { static: false }) contentqrPanel: TemplateRef<any>;
  @ViewChild('dxGptModal', { static: false }) dxGptModal: TemplateRef<any>;
  @ViewChild('notesModal', { static: false }) notesModal: TemplateRef<any>;
  @ViewChild('rarescopeModal', { static: false }) rarescopeModal: TemplateRef<any>;
  @ViewChild('diaryModal', { static: false }) diaryModal: TemplateRef<any>;
  @ViewChild('timelineModal', { static: false }) timelineModal: TemplateRef<any>;
  @ViewChild('prepareConsultModal', { static: false }) prepareConsultModal: TemplateRef<any>;
  @ViewChild('soapModal', { static: false }) soapModal: TemplateRef<any>;
  @ViewChild('trackingModal', { static: false }) trackingModal: TemplateRef<any>;
  @ViewChild('trackingEvolutionChart', { static: false }) trackingEvolutionChartRef: ElementRef;
  @ViewChild('trackingTimeChart', { static: false }) trackingTimeChartRef: ElementRef;

  // Variables para Preparar Consulta
  prepareConsultData = {
    specialist: '',
    consultDate: '',
    comments: ''
  };
  prepareConsultEditMode = {
    specialist: false,
    consultDate: false,
    comments: false
  };
  
  // Variables para SOAP Notes (Clinical)
  soapStep = 1;
  soapLoading = false;
  soapData = {
    patientSymptoms: '',
    suggestedQuestions: [] as Array<{question: string, answer: string}>,
    result: null as {subjective: string, objective: string, assessment: string, plan: string} | null
  };
  
  // Variables para Patient Tracking (Clinical)
  trackingStep = 1;
  trackingLoading = false;
  isDragOver = false;
  trackingEvolutionChart: any = null;
  trackingTimeChart: any = null;
  trackingCombinedChart: any = null;
  
  // Filtros para tracking
  trackingFilters = {
    groupBy: 'month' as 'day' | 'month' | 'year',
    dateRange: 'all' as 'all' | '1year' | '6months' | '3months' | '1month' | 'custom',
    customStartDate: '',
    customEndDate: '',
    seizureType: 'all',
    maxSeizureScale: null as number | null,
    maxMedicationScale: null as number | null,
    showMedicationChanges: true,
    selectedYears: [] as number[]  // Años seleccionados para filtrar
  };
  availableSeizureTypes: string[] = [];
  availableYears: number[] = [];  // Años disponibles para el slicer
  
  // Variables para gestión de datos
  deleteRangeStart = '';
  deleteRangeEnd = '';
  
  trackingData = {
    patientId: '',
    conditionType: 'epilepsy' as 'epilepsy',  // Solo epilepsia
    entries: [] as Array<{
      date: Date;
      type: string;
      duration?: number;
      severity?: number;
      triggers?: string[];
      notes?: string;
      value?: number;
      customFields?: Record<string, any>;
    }>,
    medications: [] as Array<{
      name: string;
      dose: string;
      startDate: Date;
      endDate?: Date;
      sideEffects?: string[];
    }>,
    metadata: {
      source: 'manual' as 'seizuretracker' | 'manual' | 'other',
      importDate: new Date(),
      originalFile: ''
    }
  };
  trackingManualEntry = {
    conditionType: 'epilepsy' as 'epilepsy',  // Solo epilepsia
    date: '',
    type: 'Tonic Clonic',  // Tipo por defecto
    duration: 0,
    severity: 5,  // Severidad por defecto
    triggers: [] as string[],
    notes: ''
  };
  trackingImportPreview: {
    type: string;
    entriesCount: number;
    medicationsCount: number;
    dateRange: string;
    rawData: any;
  } | null = null;
  trackingStats = {
    totalEvents: 0,
    daysSinceLast: 0,
    monthlyAvg: 0,
    trend: '' as 'improving' | 'worsening' | '',
    trendPercent: 0
  };
  trackingInsights: Array<{
    icon: string;
    title: string;
    description: string;
  }> = [];
  availableTriggers = ['Stress', 'Sleep deprivation', 'Missed medication', 'Alcohol', 'Illness', 'Hormonal', 'Diet', 'Light sensitivity', 'Overheated', 'Other'];
  
  tasksUpload: any[] = [];
  taskAnonimize: any[] = [];
  translateYouCanAskInChat: string = '';
  translateExtractingMedicalEvents: string = '';
  translateGeneratingSummary: string = '';
  translateAnonymizingDocument: string = '';
  translateSummaryPatient: string = '';
  messagesExpect: string = '';
  messagesExpectOutPut: string = '';
  suggestions: any[] = [];
  suggestions2: any[] = [];
  suggestionFromSummary: any[] = [];
  suggestions_pool: string[] = [];
  newSuggestions: string[] = [];
  usedNewSuggestions: string[] = [];
  isDonating: boolean = false;
  changingDonation: boolean = true;
  dxGptResults: any;
  isDxGptLoading: boolean = false;
  hasChangesEvents: boolean = false;
  expandedDiagnosisCards: Set<number> = new Set();
  expandedQuestions: Map<number, number> = new Map(); // cardIndex -> questionIndex
  visitedQuestions: Map<number, Set<number>> = new Map(); // cardIndex -> Set of visited questionIndexes
  loadingQuestions: Map<string, boolean> = new Map(); // `${cardIndex}-${questionIndex}` -> loading state
  questionResponses: Map<string, string> = new Map(); // `${cardIndex}-${questionIndex}` -> response content
  private questionSymptoms = new Map<string, any[]>();
  isEditingPatientInfo: boolean = false;
  editedPatientInfo: string = '';
  isPatientInfoExpanded: boolean = false;
  isLoadingMoreDiagnoses: boolean = false;
  loadingDoc: boolean = false;
  summaryDate: Date = null;
  generatingPDF: boolean = false;
  regeneratingSummary: boolean = false;
  msgDownload: string;
  msgtoDownload: string;
  actualStatus: string = '';
  private intervalId: any;
  sendingVote: boolean = false;
  actualParam: string = '';
  proposedEvents = [];
  currentPatient: string = '';
  actualPatient: any = {};
  containerName: string = '';
  hasShownCountryWarning: boolean = false;
  gettingSuggestions: boolean = false;
  newPermission: any;
  mode: string = 'Custom';
  loadedShareData: boolean = false;
  generateUrlQr = '';
  listCustomShare = [];
  showNewCustom: boolean = false;
  urlOpenNav29: string = environment.api + '/login';
  widthPanelCustomShare = null;
  haveInfo: boolean = false;
  screenWidth: number;
  showOptionsData: string = 'general';
  numOfSuggestions: number = 4;
  welcomeMsg: string = '';
  initialEvents: any[] = [];

  genderOptions = [
  ];

  categoriesPatients = []
  categoriesCaregivers = []
  summaryTypes = []

  actualCategory: any = null;
  stepPhoto = 1;
  capturedImage: any;
  nameFileCamera: string = '';
  sortKey: string = 'date';
  sortDirection: number = -1;

  timeline: any = [];
  eventsNeedingReviewCount: number = 0;
  
  // Timeline consolidado
  consolidatedTimeline: any = null;
  loadingConsolidatedTimeline: boolean = false;
  showConsolidatedView: boolean = true; // Por defecto mostrar vista consolidada
  consolidatedTimelineError: string = null;

  updateNeedingReviewCount(): void {
    if (!this.allEvents || this.allEvents.length === 0) {
      this.eventsNeedingReviewCount = 0;
      return;
    }
    this.eventsNeedingReviewCount = this.allEvents.filter(event => 
      event.needsDateReview || 
      (event.date === null && event.dateConfidence === 'missing') || 
      event.dateConfidence === 'estimated'
    ).length;
  }
  showFilters = false;
  groupedEvents: any = [];
  startDate: Date;
  endDate: Date;
  selectedEventType: string = null;
  originalEvents: any[];
  isOldestFirst = false;
  userId = '';
  openingSummary = false;
  generatingInfographic = false;
  infographicImageData: string = null;
  role = 'Unknown';
  medicalLevel: string = '1';
  valueGeneralFeedback: string = '';
  openingResults = false;
  eventsDoc: any = [];
  selectedIndexTab: number = 0;
  sidebarOpen = false;
  notesSidebarOpen: boolean = false;
  leftSidebarCollapsed: boolean = false;
  rightSidebarCollapsed: boolean = false;
  rightSidebarOpenMobile: boolean = false;
  scrollToBottomVisible: boolean = false;
  notes: { _id: string, content: string, date: Date, isEditing?: boolean, editContent?: string }[] = [];
  newNoteContent: string = '';
  savingNote: boolean = false;
  editableDiv: ElementRef | null = null;
  deletingNote: boolean = false;
  selectedNoteForModal: any = null;
  noteMaxLength: number = 500; // Límite de caracteres para mostrar preview
  editingNoteIndex: number | null = null; // Índice de la nota que se está editando en el modal
  
  // Quill Editor Configuration
  quillConfig = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],               // custom button values
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
      [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
      [{ 'direction': 'rtl' }],                         // text direction
      [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],                                         // remove formatting button
      ['link', 'image']                                 // link and image, video
    ]
  };
  
  quillEditorStyles = {
    height: '300px',
    'min-height': '200px'
  };
  selectAllDocuments: boolean = true;
  searchTerm: string = '';
  filteredDocs: any[] = [];
  recognition: any;
  recording = false;
  supported = false;
  timer: number = 0;
  timerDisplay: string = '00:00';
  private interval: any;
  private accumulatedText: string = '';
  private speechSubscription: Subscription;
  tempFileName: string = '';
  showCameraButton: boolean = false;
  langs: any[] = [];
  editingTitle: boolean = false;
  @ViewChild('titleInput', { static: false }) titleInput: ElementRef;
  currentView: string = 'chat';
  
  // RareScope variables
  additionalNeeds: string[] = [];
  rarescopeNeeds: string[] = [''];
  deletingStates: { [key: number]: boolean } = {};
  isLoadingRarescope: boolean = false;
  rarescopeError: string = null;
  previousView: string;
  private isInitialLoad = true;
  currentPatientId: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService, public translate: TranslateService, private formBuilder: FormBuilder, private authGuard: AuthGuard, public toastr: ToastrService, private patientService: PatientService, private sortService: SortService, private modalService: NgbModal, private apiDx29ServerService: ApiDx29ServerService, private dateService: DateService, private eventsService: EventsService, private webPubSubService: WebPubSubService, private searchService: SearchService, public jsPDFService: jsPDFService, private clipboard: Clipboard, public trackEventsService: TrackEventsService, private route: ActivatedRoute, public insightsService: InsightsService, private cdr: ChangeDetectorRef, private router: Router, private langService: LangService, private highlightService: HighlightService, private activityService: ActivityService, private speechRecognitionService: SpeechRecognitionService) {
    this.screenWidth = window.innerWidth;
    this.categoriesPatients = [
      { "title": this.translate.instant('categoriesPatients.list.cat1'), "icon": "data:image/webp;base64,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", "idCat": "treatAndDrugs", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat2'), "icon": "data:image/webp;base64,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", "idCat": "symtomsauto", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat3'), "icon": "data:image/webp;base64,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", "idCat": "eduandResources", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat4'), "icon": "data:image/webp;base64,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", "idCat": "bienestar", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat5'), "icon": "data:image/webp;base64,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", "idCat": "nutriestilo", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat6'), "icon": "data:image/webp;base64,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", "idCat": "comunicacion", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat7'), "icon": "data:image/webp;base64,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", "idCat": "actividades", "questions": [] },
    ];

    this.categoriesCaregivers = [
      { "title": this.translate.instant('categoriesCaregivers.list.cat1'), "icon": "data:image/webp;base64,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", "idCat": "treatAndDrugs", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat2'), "icon": "data:image/webp;base64,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", "idCat": "nutridiet", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat3'), "icon": "data:image/webp;base64,UklGRugFAABXRUJQVlA4WAoAAAAwAAAAOwAAOwAASUNDUKACAAAAAAKgbGNtcwRAAABtbnRyUkdCIFhZWiAH5wAMAAQACwAFABNhY3NwTVNGVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1kZXNjAAABIAAAAEBjcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaGFkAAABrAAAACxyWFlaAAAB2AAAABRiWFlaAAAB7AAAABRnWFlaAAACAAAAABRyVFJDAAACFAAAACBnVFJDAAACFAAAACBiVFJDAAACFAAAACBjaHJtAAACNAAAACRkbW5kAAACWAAAACRkbWRkAAACfAAAACRtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACQAAAAcAEcASQBNAFAAIABiAHUAaQBsAHQALQBpAG4AIABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABQAHUAYgBsAGkAYwAgAEQAbwBtAGEAaQBuAABYWVogAAAAAAAA9tYAAQAAAADTLXNmMzIAAAAAAAEMQgAABd7///MlAAAHkwAA/ZD///uh///9ogAAA9wAAMBuWFlaIAAAAAAAAG+gAAA49QAAA5BYWVogAAAAAAAAJJ8AAA+EAAC2xFhZWiAAAAAAAABilwAAt4cAABjZcGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltjaHJtAAAAAAADAAAAAKPXAABUfAAATM0AAJmaAAAmZwAAD1xtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAEcASQBNAFBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJBTFBIYgEAAAGQQ23boTnv2ratyrZtBpVts0sqVk5t27adKpk/trHGU3zfzJ55p9wmIiaAhse6Whso9+f1IMMs7ga+VBsj7w6kO6MZ2Y/P9LEOzV/xGBrPzErzso6tbmAwBjpG6TdRj2Qmb3OmGed9cNZr4f6k+e/5FSR1AMAnB6I4XpOBH4HPIV4kIvrAaiI0SkyG6jBCt6Ioq4ULivJGJUG/sZLbXqQ58Y8kUL9cSRkNcZXETL8gSe5QlgsviWGHcNxOW8gn4TCHUwLeX7l4eZGw9eLVe10Ql3NYLhEvCm+hnsAhDPj4T4sied2Bd8TyHFpatXQIHd7bsIRHHk7TFeG1BVEIxJXO33978KADGO2jAMCh3IpnwgXrTZhLTL0+dRQnCKqH7CfgHLHN6Bh4reH9OJo+aPLkQ7kdUN9mFnUIphDiHG9Se3FkEOe9iLfDhkEZ0LGQ+Cfuk/xe702GDFqyb/sIRxruDFZQOCC4AQAAUAkAnQEqPAA8AD4xFIlCoiEhFAZUIAMEs4ArvP1G2o5//zzB0uxhvN7zAEMbMzoSbkFB+e36YHQT2767HidTf90M7mOlvgGBw4dYUTtaIaL4sQAA/v6eyXM390n6n+i+1clrC/+o82jFPyLaEU7+34dOJ60B499RWa/+wX0Cp2GMh7dUYcH//5/aU15gqm9s+UUMAAsUejlKgj01JqI9Y5YKSZkZ4C7MZy0s1xX6CNzSYGRGKm/5gjweOytOq4v4ps3NKPv9rZZdYP8AMvnz1PpaposK9kmf3hn+K3pr8dc/szDpRmLQ7/5zml5AQ+ZIsst46bCH5J4E2SJAEfxW5h7EPs54VuWPEzn4f5elbO5Lg+7x2aEhcPYuZawrmNNB/+Tbl/83qg0+55blVVS8lEv7+j18YnOfGr2CnNyDR2+JRRLan049d7UZQ7kGdLgvNI7HZniQBNoCc6yEyL2d42KEjHypTCNZqvdt9mnxPY5KaMZL6I0eXVtw3uCKrGQ3P98OuM/jBrcw9P5XCTiKmhf3hpzqYv3XW98Jhcb+P//njak4YUGwCLZ4HzQ0c50FgkPoqAAAAAA=", "idCat": "emeaid", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat4'), "icon": "data:image/webp;base64,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", "idCat": "suppment", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat5'), "icon": "data:image/webp;base64,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", "idCat": "commuhealth", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat6'), "icon": "data:image/webp;base64,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", "idCat": "comunicacion", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat7'), "icon": "data:image/webp;base64,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", "idCat": "actividades", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat8'), "icon": "data:image/webp;base64,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", "idCat": "monifollow", "questions": [] }
    ];

    this.summaryTypes = [
      { id: 'timeline', title: 'summaryoptions.timeline.title', description: 'summaryoptions.timeline.description' },
      { id: 'detailed', title: 'summaryoptions.detailed.title', description: 'summaryoptions.detailed.description' },
      { id: 'nextAppointment', title: 'summaryoptions.nextConsultation.title', description: 'summaryoptions.nextConsultation.description' },
      { id: 'symptoms', title: 'summaryoptions.symptomsTracking.title', description: 'summaryoptions.symptomsTracking.description' },
      { id: 'family', title: 'summaryoptions.familyCaregivers.title', description: 'summaryoptions.familyCaregivers.description' },
      { id: 'secondOpinion', title: 'summaryoptions.secondOpinion.title', description: 'summaryoptions.secondOpinion.description' },
      { id: 'recentTests', title: 'summaryoptions.recentTestsResults.title', description: 'summaryoptions.recentTestsResults.description' },
      { id: 'medications', title: 'summaryoptions.medicationsTreatments.title', description: 'summaryoptions.medicationsTreatments.description' },
      { id: 'insurance', title: 'summaryoptions.insuranceFormalities.title', description: 'summaryoptions.insuranceFormalities.description' }
    ];

    this.userId = this.authService.getIdUser();
    //this.detectedLang = this.translate.currentLang;
    this.getLangs();
  }

  getLangs() {
    this.subscription.add(this.patientService.getPreferredLang().subscribe((res) => {
      if (res.preferredResponseLanguage === null) {
        this.subscription.add(this.langService.getAllLangs().subscribe((res2) => {
          this.langs = res2;
          let ngbModalOptions: NgbModalOptions = {
            backdrop: 'static',
            keyboard: false,
            windowClass: 'ModalClass-xs'// xl, lg, sm
          };
          this.modalReference = this.modalService.open(LanguageSelectModalComponent, ngbModalOptions);
          this.modalReference.componentInstance.title = this.translate.instant('lang.Select the language of the responses');
          this.modalReference.componentInstance.text = `<p>${this.translate.instant('lang.ExplainLang')}</p><p>${this.translate.instant('lang.ExplainLang1')}</p><p>${this.translate.instant('lang.ExplainLang2')}</p>`;
          this.modalReference.componentInstance.languageOptions = this.langs.map(lang => ({ code: lang.code, name: lang.nativeName }));
          this.modalReference.componentInstance.selectedLang = res.lang;


          this.modalReference.result.then((selectedLangCode) => {
            console.log('Selected language code:', selectedLangCode);
            this.patientService.updatePreferredLang(selectedLangCode).subscribe((res3) => {
              console.log(res3);
              this.modalReference.close();
              this.preferredResponseLanguage = selectedLangCode;
              this.detectedLang = selectedLangCode;
              this.getParams();
            });
          }, (reason) => {
            console.log('Modal dismissed:', reason);
            this.getParams();
          });
        }));

      } else {
        this.detectedLang = res.preferredResponseLanguage;
        this.preferredResponseLanguage = res.preferredResponseLanguage;
        this.getParams();
      }

    }));
  }

  getParams(){
    const firstPatient = this.route.snapshot.paramMap.get('firstPatient');
    console.log('Matrix param firstPatient:', firstPatient);
    if (firstPatient === 'true') {
      interval(1000).pipe(
        filter(() => this.loadedDocs === true),
        take(1)
      ).subscribe(async () => {
        this.previousView = this.currentView;
        let isSmallScreen = this.isSmallScreen();
        if(!isSmallScreen){
          this.setView('chat');
          await this.delay(1500);
          this.startTutorial();
        }
      });;
    }

  }

  startTutorial(){
    // Destroy running tour
    hopscotch.endTour(true);
    // Configura el tour
    hopscotch.configure({
      onEnd: () => {
        console.log('Tour ended');
        this.currentView = this.previousView;
      },
      onClose: () => {
        console.log('Tour closed');
        this.currentView = this.previousView;
      }
    });
    // Initialize new tour
    hopscotch.startTour(this.tourSteps());
  }

  tourSteps(): any {
    let docsyOffset = 60;
    let docsxOffset = 10;
    let notesyOffset = 60;
    let notesxOffset = 10;
    const windowWidth = window.innerWidth;
    const tourWidth = windowWidth < 350 ? 200 : windowWidth < 768 ? 300 : 400;
    
    if(!this.sidebarOpen && this.isSmallScreen()){
      docsyOffset = -10;
      docsxOffset = 40;
    }
    if(!this.notesSidebarOpen){
      notesyOffset = -10;
      notesxOffset = -50;
    }

    let steps = 
    [
      {
        title: this.translate.instant('tutorial.docsTitle'),
        content: this.translate.instant('tutorial.docsContent'),
        target: "sidebar-content",
        placement: "right",
        xOffset: docsxOffset,
        yOffset: docsyOffset,
        arrowOffset: 0,
        width: tourWidth
      },
      {
        title: this.translate.instant('tutorial.chatTitle'),
        content: this.translate.instant('tutorial.chatContent'),
        target: "chat-container",
        placement: "top",
        xOffset: 10,
        arrowOffset: -10,
        showArrow: false,
        width: tourWidth
      },
      {
        title: this.translate.instant('tutorial.notesTitle'),
        content: this.translate.instant('tutorial.notesContent'),
        target: "notes-title",
        placement: "bottom",
        xOffset: notesxOffset,
        yOffset: notesyOffset,
        arrowOffset: 0,
        width: tourWidth
      },
      {
        title: this.translate.instant('tutorial.diaryTitle'),
        content: this.translate.instant('tutorial.diaryContent'),
        target: "diary-title",
        placement: "bottom",
        xOffset: notesxOffset,
        yOffset: notesyOffset,
        arrowOffset: 0,
        width: tourWidth
      }
    ];

    return {
      id: 'demo-tour',
      showPrevButton: true,
      steps: steps
    }
  }

  async changeOptionData(option) {
    this.showOptionsData = option;
    /*if(this.showOptionsData){
      let currentLang = this.translate.currentLang;
      await this.updateSuggestions(currentLang);      
      this.suggestions2 = this.getAllSuggestions(6);
    }*/
  }



  async selectCategorie(categorie) {


    this.actualCategory = categorie;
    try {
      let categoriTitle = 'categoriesPatients'
      if (this.showOptionsData == 'categoriesCaregivers') {
        categoriTitle = 'categoriesCaregivers'
      }
      // Get the 'suggestions' object from the translation file
      const index = categoriTitle + '.' + categorie.idCat;
      let suggestions = await firstValueFrom(this.translate.get(index));
      let suggestionKeys = Object.keys(suggestions);

      let translationPromises = suggestionKeys.map((key) => firstValueFrom(this.translate.get(index + '.' + key)));
      let translations = await Promise.all(translationPromises);
      this.actualCategory.questions = translations;
    } catch (error) {
      console.error('Error al obtener las traducciones:', error);
    }
  }

  private async updateSuggestions(lang: string): Promise<void> {
    this.translate.use(lang);

    // Get the 'suggestions' object from the translation file
    let suggestions = await firstValueFrom(this.translate.get('suggestionsPatient'));
    let suggestionKeys = Object.keys(suggestions);

    let translationPromises = suggestionKeys.map((key) => firstValueFrom(this.translate.get('suggestionsPatient.' + key)));

    let translations = await Promise.all(translationPromises);

    // Keep the last 5 suggestions separate in newSuggestions
    this.newSuggestions = translations.slice(-5);
    this.suggestions_pool = translations;
  }

  get ef() { return this.eventsForm.controls; }

  async ngOnDestroy() {
    // Detener reconocimiento de voz si está activo
    if (this.recording) {
      this.speechRecognitionService.stop();
    }
    
    // Detener reconocimiento de voz del chat si está activo
    if (this.chatRecording) {
      this.speechRecognitionService.stop();
    }
    
    // Limpiar suscripciones de reconocimiento de voz
    if (this.speechSubscription) {
      this.speechSubscription.unsubscribe();
    }
    
    // Limpiar suscripciones de reconocimiento de voz del chat
    if (this.chatSpeechSubscription) {
      this.chatSpeechSubscription.unsubscribe();
    }
    
    // El backend ahora guarda los mensajes automáticamente

    // Unsubscribe de todas las subscripciones
    this.subscription.unsubscribe();
    
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.eventsService.destroy();
    hopscotch.endTour(true);

    if (this.modalReference) {
      this.modalReference.dismiss();
    }
  }

  ngAfterViewChecked() {
    this.highlightService.highlightAll();
  }

  /**
   * Elimina todos los mensajes del chat en el servidor
   */
  deleteMessagesFromServer(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.subscription.add(
        this.http.delete(environment.api + '/api/messages/' + this.authService.getIdUser() + '/' + this.currentPatient)
          .subscribe(
            (res: any) => {
              console.log('✅ Mensajes eliminados del servidor');
              resolve(res);
            },
            (err) => {
              console.error('Error eliminando mensajes:', err);
              this.insightsService.trackException(err);
              resolve(err);
            }
          )
      );
    });
  }

  getMessages() {
    this.subscription.add(this.http.get(environment.api + '/api/messages/' + this.authService.getIdUser() + '/' + this.currentPatient)
      .subscribe(async (res: any) => {
        console.log('getMessages', res);
        if (res.messages != undefined) {
          if (res.messages.length > 0) {
            // Procesar referencias de documentos en mensajes cargados de la BD
            this.messages = res.messages.map((msg: any) => {
              if (!msg.isUser && msg.text) {
                msg.text = this.processDocumentReferences(msg.text, msg.references);
              }
              return msg;
            });
          } else {
            this.messages = [];
          }
        } else {
          this.messages = [];
        }
        
        // Cargar sugerencias del último mensaje si el backend las devuelve
        if (res.lastSuggestions && res.lastSuggestions.length > 0) {
          this.translateSuggestions(res.lastSuggestions);
        }
        
        await this.delay(200);
        this.scrollToBottom();
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
      }));
  }

  getTranslations() {
    this.translate.get('generics.Download').subscribe((res: string) => {
      this.msgDownload = res;
    });
    this.translate.get('generics.To download the file').subscribe((res: string) => {
      this.msgtoDownload = res;
    });

    this.translateYouCanAskInChat = this.translate.instant('messages.m2.1');
    this.translateExtractingMedicalEvents = this.translate.instant('messages.m4.1');
    this.translateGeneratingSummary = this.translate.instant('messages.m3.1');
    this.translateAnonymizingDocument = this.translate.instant('messages.m5.1');
    this.translateSummaryPatient = this.translate.instant('messages.m6.1');
    this.messagesExpect = this.translate.instant("messages.expect0")
    this.welcomeMsg = this.translate.instant('home.botmsg1')
    //replace \n\n with <br><br>
    this.welcomeMsg = this.welcomeMsg.replace(/\n\n/g, '<br><br>');
    this.genderOptions = [
      { value: 'male', viewValue: this.translate.instant('personalinfo.Male') },
      { value: 'female', viewValue: this.translate.instant('personalinfo.Female') }
    ];
  }


  isStepInProcessChat(): boolean {
    let value = false;
    for (let task of Object.values(this.tasksUpload)) {
      if (task.steps[0].status === 'inProcess' || task.steps[1].status === 'inProcess' || task.steps[2].status === 'inProcess') {
        value = true;
      }
    }
    return value;
  }

  isStepInProcess(): boolean {
    let value = false;
    for (let task of Object.values(this.tasksUpload)) {
      for (let step of task.steps) {
        if (step.status === 'inProcess') {
          value = true;
        }
      }
    }
    return value;
  }

  isDateMissing(date: any): boolean {
    if (date === null || date === undefined) {
      return true;
    }
    // También verificar si es una fecha inválida (como 1 de enero de 1970 que puede ser un valor por defecto)
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return true;
    }
    // Si la fecha es 1 de enero de 1970 (epoch 0), considerarla como fecha faltante
    if (dateObj.getTime() === 0) {
      return true;
    }
    return false;
  }

  /**
   * Maneja los cambios en el paciente actual de forma centralizada
   * @param patient - El paciente actual o null
   */
  private handlePatientChange(patient: any): void {
    console.log('patient', patient);
    
    if (patient) {
      // Paciente válido
      this.isInitialLoad = false;
      this.currentPatientId = patient.sub;
      
      // IMPORTANTE: Resetear estados de carga del chat cuando cambias de paciente
      // Esto evita que el chat quede bloqueado si había una petición pendiente del paciente anterior
      this.callingOpenai = false;
      this.gettingSuggestions = false;
      
      // Limpiar sugerencias del paciente anterior
      this.suggestions = [];
      
      // Limpiar mensajes del paciente anterior mientras se cargan los nuevos
      this.messages = [];
      
      // Limpiar contexto de conversación del paciente anterior
      this.context = [{ role: 'system', content: '' }];
      
      // Limpiar control de anomalías procesadas del paciente anterior
      this.processedAnomalies.clear();
      
      this.initEnvironment();
      
      // Limpiar resultados de DxGPT siempre cuando cambias de paciente
      this.dxGptResults = null;
      this.isDxGptLoading = false;
      
      // Limpiar datos de Rarescope (Mis Necesidades) cuando cambias de paciente
      this.rarescopeNeeds = [''];
      this.additionalNeeds = [];
      this.rarescopeError = null;
      this.isLoadingRarescope = false;
      
      // Limpiar timeline cuando cambias de paciente
      this.timeline = [];
      this.consolidatedTimeline = null;
      this.loadingConsolidatedTimeline = false;
      this.consolidatedTimelineError = null;
    } else {
      // No hay paciente
      this.currentPatientId = null;
      this.dxGptResults = null;
      this.suggestions = [];
      this.messages = [];
      
      // Redirigir solo si no es la carga inicial
      if (!this.isInitialLoad) {
        console.log('patient is null, redirecting to patients');
        this.router.navigate(['/patients']);
      }
      this.isInitialLoad = false;
    }
  }

  async ngOnInit() {
    this.showCameraButton = this.isMobileDevice();

    // Inicializar soporte de voz para el chat
    this.chatVoiceSupported = this.speechRecognitionService.isSupported();
    
    // Suscribirse a los resultados del reconocimiento de voz para el chat
    if (this.chatVoiceSupported) {
      let lastFinalText = '';
      let lastInterimText = '';
      this.chatSpeechSubscription = this.speechRecognitionService.results$.subscribe((result) => {
        if (result && result.text && this.chatRecording) {
          if (result.isFinal) {
            // Para resultados finales, extraer solo el nuevo texto
            const newText = result.text.replace(lastFinalText, '').trim();
            if (newText) {
              // Remover el último texto intermedio si existe
              if (lastInterimText && this.message.endsWith(lastInterimText)) {
                this.message = this.message.slice(0, -lastInterimText.length);
              }
              this.message = (this.message.trim() ? this.message.trim() + ' ' : '') + newText;
            }
            lastFinalText = result.text;
            lastInterimText = '';
          } else {
            // Para resultados intermedios, reemplazar el último texto intermedio
            if (lastInterimText && this.message.endsWith(lastInterimText)) {
              this.message = this.message.slice(0, -lastInterimText.length) + result.text;
            } else {
              // Si no hay texto intermedio previo, añadir el nuevo
              const baseMessage = this.message.trim();
              this.message = (baseMessage ? baseMessage + ' ' : '') + result.text;
            }
            lastInterimText = result.text;
          }
          
          // Forzar el redimensionamiento del textarea cuando se actualiza el mensaje por voz
          setTimeout(() => {
            const textarea = document.querySelector('#chat-container textarea') as HTMLTextAreaElement;
            if (textarea) {
              // Disparar evento input para que autoResize se ejecute
              const event = new Event('input', { bubbles: true });
              textarea.dispatchEvent(event);
            }
          }, 0);
        }
      });

      // Suscribirse a errores del reconocimiento de voz del chat
      this.speechRecognitionService.errors$.subscribe((error) => {
        if (error && this.chatRecording) {
          this.toastr.error('', error);
          this.chatRecording = false;
        }
      });
    }

    // Precargar imagen DxGPT
    const dxGptLogo = new Image();
    dxGptLogo.src = 'assets/img/logo-dxgpt.png';

    // Una sola suscripción que maneja toda la lógica del paciente
    this.subscription.add(
      this.authService.currentPatient$.subscribe(patient => {
        this.handlePatientChange(patient);
      })
    );
    let currentLang = this.translate.currentLang;
    await this.updateSuggestions(currentLang);
    this.getTranslations();
    this.suggestions = this.getAllSuggestions(4);
    
    this.messageSubscription = this.webPubSubService.getMessageObservable().subscribe(message => {
      this.handleMessage(message);
    });

    this.eventsService.on('eventTask', this.handleEventTask.bind(this));
    this.eventsService.on('changelang', this.handleChangeLang.bind(this));
    this.eventsService.on('changeView', this.handleChangeView.bind(this));
    this.eventsService.on('reload-messages', () => this.getMessages());
    

    /*if (this.authService.getRole() === 'Caregiver') {
      this.currentView = 'diary';
    } else {
      this.currentView = 'chat';
    }*/
      this.currentView = 'chat';
  }

  async setView(view: string) {
    this.currentView = view;
    
    // Cerrar el sidebar móvil de herramientas cuando se cambia a cualquier vista
    // (las herramientas no son una vista, solo un sidebar que se muestra sobre chat)
    if (this.isSmallScreen() && this.rightSidebarOpenMobile) {
      this.rightSidebarOpenMobile = false;
    }
    
    if(view === 'documents'){
      this.sidebarOpen = true;
      this.notesSidebarOpen = false;
    }else if(view === 'diary'){
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
    }else if(view === 'chat'){
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
      //scroll to bottom
      await this.delay(200);
      this.scrollToBottom();
    }else if(view === 'notes'){
      this.sidebarOpen = false;
      this.notesSidebarOpen = true;
    }else if(view === 'dxgpt'){
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
      // Opcional: podrías llamar a fetchDxGptResults() aquí si quieres que se auto-cargue
      // al cambiar a la vista, o dejar que el usuario pulse el botón.
      // Por ahora, lo dejamos para el botón.
    }else if(view === 'rarescope'){
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
      this.loadRarescopeData();
    }else{
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
    } 
    //this.scrollToTop();
  }

  handleChangeView(view: string) {
    this.currentView = view;
  }


  async scrollToTop() {
    await this.delay(200);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // RareScope methods
  addNewNeed() {
    this.additionalNeeds.push('');
    // Guardar el nuevo estado
    this.saveRarescopeData();
  }

  // Función para optimizar el trackBy en *ngFor
  trackByIndex(index: number, item: any): number {
    return index;
  }

  // Función para guardar cuando se pierde el foco
  onNeedBlur(event: any, index: number) {
    const content = event.target.innerText.trim();
    if (index === 0) {
      this.rarescopeNeeds[0] = content;
    } else {
      this.additionalNeeds[index - 1] = content;
    }
    // Guardar los cambios
    this.saveRarescopeData();
  }

  onDropNeed(event: any) {
    // Importar CdkDragDrop del CDK
    if (event.previousIndex !== event.currentIndex) {
      // Crear un array temporal con todos los needs
      const allNeeds = [this.rarescopeNeeds[0] || '', ...this.additionalNeeds];
      
      // Mover el elemento usando la función moveItemInArray de CDK si está disponible
      // Si no, usar el método manual
      const movedItem = allNeeds.splice(event.previousIndex, 1)[0];
      allNeeds.splice(event.currentIndex, 0, movedItem);
      
      // Actualizar los arrays - Con [(ngModel)] esto se sincroniza automáticamente
      this.rarescopeNeeds[0] = allNeeds[0];
      this.additionalNeeds = allNeeds.slice(1);
      
      // Forzar detección de cambios para asegurar que la UI se actualice
      this.cdr.detectChanges();
      
      // Guardar los cambios
      this.saveRarescopeData();
    }
  }
  
  saveRarescopeData() {
    if (!this.currentPatient?.sub) {
      console.warn('No hay paciente seleccionado para guardar datos de Rarescope');
      return;
    }

    const rarescopeData = {
      mainNeed: this.rarescopeNeeds[0],
      additionalNeeds: this.additionalNeeds,
      updatedAt: new Date().toISOString()
    };

    // Guardar en la base de datos
    this.http.post(environment.api + '/api/rarescope/save/'+this.authService.getCurrentPatient().sub, rarescopeData)
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            console.log('Datos de Rarescope guardados exitosamente');
          } else {
            console.error('Error al guardar datos de Rarescope:', response.error);
          }
        },
        error: (error) => {
          console.error('Error al guardar datos de Rarescope:', error);
        }
      });
  }
  
  loadRarescopeData() {
    const currentPatient = this.authService.getCurrentPatient();
    if (!currentPatient?.sub) {
      console.warn('No hay paciente seleccionado para cargar datos de Rarescope');
      return;
    }

    // Cargar desde la base de datos
    this.http.get(environment.api + '/api/rarescope/load/'+currentPatient.sub)
      .subscribe({
        next: (response: any) => {
          if (response.success && response.data) {
            const data = response.data;
            this.rarescopeNeeds[0] = data.mainNeed || '';
            this.additionalNeeds = data.additionalNeeds || [];
            // Forzar detección de cambios
            this.cdr.detectChanges();
          } else {
            // Si no hay datos guardados, hacer el análisis inicial
            if (this.rarescopeNeeds[0] === '' && this.additionalNeeds.length === 0) {
              this.fetchRarescopeAnalysis();
            }
          }
        },
        error: (error) => {
          console.error('Error al cargar datos de Rarescope:', error);
          // En caso de error, intentar hacer el análisis inicial
          if (this.rarescopeNeeds[0] === '' && this.additionalNeeds.length === 0) {
            this.fetchRarescopeAnalysis();
          }
        }
      });
  }
  
  deleteNeed(index: number) {
    // Marcar como eliminándose
    this.deletingStates[index] = true;
    
    // Esperar a que termine la animación antes de eliminar
    setTimeout(() => {
      if (index === 0) {
        // Si es el primer elemento, mover el primero de additionalNeeds a rarescopeNeeds
        if (this.additionalNeeds.length > 0) {
          this.rarescopeNeeds[0] = this.additionalNeeds.shift();
        } else {
          this.rarescopeNeeds[0] = '';
        }
      } else {
        // Eliminar del array additionalNeeds
        this.additionalNeeds.splice(index - 1, 1);
      }
      
      // Limpiar el estado de eliminación
      delete this.deletingStates[index];
      
      // Guardar cambios
      this.saveRarescopeData();
      
      // Forzar detección de cambios
      this.cdr.detectChanges();
    }, 300); // Duración de la animación
  }

  async fetchRarescopeAnalysis() {
    if (this.isLoadingRarescope) return;
    
    this.isLoadingRarescope = true;
    this.rarescopeError = null;
    
    // Clear existing data when fetching new analysis
    this.rarescopeNeeds = [''];
    this.additionalNeeds = [];
    this.cdr.detectChanges();
    
    try {
      const response = await this.apiDx29ServerService.getRarescopeAnalysis(this.actualPatient.sub).toPromise();
      
      if (response.success && response.analysis) {
        // Parse the analysis to extract unmet needs
        const unmetNeeds = response.analysis;
        
        if (unmetNeeds.length > 0) {
          // Set the first need
          this.rarescopeNeeds[0] = unmetNeeds[0];
          
          // Add the rest as additional needs
          if (unmetNeeds.length > 1) {
            this.additionalNeeds = unmetNeeds.slice(1);
          }
          
          // Save the data
          this.saveRarescopeData();
        }
      }
    } catch (error) {
      console.error('Error fetching Rarescope analysis:', error);
      this.rarescopeError = 'Error al obtener el análisis. Por favor, intente nuevamente.';
    } finally {
      this.isLoadingRarescope = false;
      this.cdr.detectChanges();
    }
  }


  private async handleMessage(message: any) {
    console.log('Message received in component:', message);
    
    // Verificar si el usuario está autenticado antes de procesar mensajes
    if (!this.authService.isAuthenticated()) {
      console.warn('⚠️ Mensaje WebPubSub recibido pero usuario no autenticado, ignorando:', message);
      return;
    }
    
    // Validar que el mensaje no sea demasiado antiguo (más de 5 minutos)
    try {
      const parsedData = JSON.parse(message.data);
      
      // Manejar mensajes de DxGPT (procesamiento asíncrono)
      if (parsedData.type === 'dxgpt-processing' || parsedData.type === 'dxgpt-result') {
        this.handleDxGptMessage(parsedData);
        return;
      }
      
      if (parsedData.time) {
        const messageTime = new Date(parsedData.time).getTime();
        const currentTime = Date.now();
        const messageAge = currentTime - messageTime;
        const maxAge = 5 * 60 * 1000; // 5 minutos en milisegundos
        
        if (messageAge > maxAge) {
          console.warn(`⚠️ Mensaje WebPubSub demasiado antiguo (${Math.round(messageAge / 1000 / 60)} minutos), ignorando:`, parsedData);
          return;
        }
      }
    } catch (error) {
      console.error('Error parsing message data:', error);
      // Continuar con el procesamiento normal si hay error al parsear
    }
    
    this.actualStatus = '';

    const parsedData = JSON.parse(message.data);

    if (!parsedData.step) {
      if (this.isActualPatient(parsedData.patientId)) {
        this.handleNoStep(parsedData);
      }
    } else {
      // IMPORTANTE: Para mensajes de navigator y extract events, validar patientId ANTES de procesar
      // Si el mensaje no es para el paciente actual, ignorarlo completamente
      // El navbar se encargará de almacenarlo como pendiente
      if (parsedData.step === 'navigator' || parsedData.step === 'extract events') {
        if (parsedData.patientId && !this.isActualPatient(parsedData.patientId)) {
          console.log('⚠️ Mensaje de', parsedData.step, 'ignorado: no corresponde al paciente actual');
          console.log('  - Mensaje patientId:', parsedData.patientId);
          console.log('  - Paciente actual:', this.authService.getCurrentPatient()?.sub);
          console.log('  - El navbar almacenará este mensaje como pendiente');
          return; // Ignorar completamente el mensaje
        }
      }
      
      // Para otros tipos de mensajes, intentar cambiar de paciente si es necesario
      if (!this.isActualPatient(parsedData.patientId)) {
        //change patient
        const patientsList = this.authService.getPatientList();
        let patient = patientsList.find(patient => patient.sub === parsedData.patientId);
        if (!patient) {
          this.subscription.add(this.patientService.getSharedPatients(this.authService.getIdUser())
            .subscribe((res: any) => {
              patient = res.find(p => p.sub === parsedData.patientId);
              if (patient) {
                this.authService.setCurrentPatient(patient);
                this.initEnvironment();
              }
            }, (err) => {
              console.log(err);
              this.insightsService.trackException(err);
            }));
        } else {
          this.authService.setCurrentPatient(patient);
          this.initEnvironment();
        }

      }
      this.handleStep(parsedData);
    }
  }

  /**
   * Maneja mensajes de WebPubSub relacionados con DxGPT
   */
  private handleDxGptMessage(parsedData: any) {
    console.log('📨 Mensaje DxGPT recibido:', parsedData);
    console.log('📨 Current patient ID:', this.currentPatientId);
    
    // Validar que el mensaje sea para el paciente actual
    if (parsedData.patientId && this.currentPatientId) {
      // El servidor envía el patientId encriptado, comparar con el actual
      const currentEncrypted = this.currentPatientId; // Ya viene encriptado desde el componente
      console.log('📨 Comparando patientIds:');
      console.log('  - Mensaje patientId:', parsedData.patientId);
      console.log('  - Paciente actual:', currentEncrypted);
      console.log('  - ¿Coinciden?', parsedData.patientId === currentEncrypted);
      
      if (parsedData.patientId !== currentEncrypted) {
        console.log('⚠️ Mensaje DxGPT ignorado: no corresponde al paciente actual');
        return;
      }
      console.log('✅ PatientId válido, procesando mensaje...');
    } else {
      console.log('⚠️ Mensaje DxGPT sin patientId o sin paciente actual seleccionado');
      console.log('  - parsedData.patientId:', parsedData.patientId);
      console.log('  - this.currentPatientId:', this.currentPatientId);
      // Continuar de todas formas si no hay patientId (por compatibilidad)
    }
    
    if (parsedData.type === 'dxgpt-processing') {
      // Actualización de progreso
      if (parsedData.message) {
        const timeMessage = this.translate.instant('dxgpt.async.timeMessage') || 'Este proceso puede tardar varios minutos dependiendo del número de documentos.';
        
        // Actualizar el mensaje de SweetAlert si está abierto
        Swal.update({
          html: `<div style="text-align: left;">
            <p><strong>${parsedData.message}</strong></p>
            ${parsedData.progress ? `<div class="progress" style="margin-top: 10px; margin-bottom: 10px;">
              <div class="progress-bar" role="progressbar" style="width: ${parsedData.progress}%">${parsedData.progress}%</div>
            </div>` : ''}
            <p style="font-size: 0.9em; color: #666; margin-top: 10px;"><em>${timeMessage}</em></p>
          </div>`
        });
      }
    } else if (parsedData.type === 'dxgpt-result') {
      // Resultado final
      Swal.close();
      
      if (parsedData.success && parsedData.analysis) {
        this.dxGptResults = {
          success: true,
          analysis: parsedData.analysis
        };
        this.isDxGptLoading = false;
        this.cdr.detectChanges();
        
        Swal.fire({
          title: this.translate.instant('dxgpt.async.completed') || 'Análisis completado',
          text: this.translate.instant('dxgpt.async.success') || 'El análisis de diagnóstico diferencial se ha completado correctamente.',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else {
        this.dxGptResults = {
          success: false,
          analysis: parsedData.error || this.translate.instant('dxgpt.errorMessage')
        };
        this.isDxGptLoading = false;
        this.cdr.detectChanges();
        
        Swal.fire({
          title: this.translate.instant('dxgpt.async.error') || 'Error en el análisis',
          text: parsedData.error || this.translate.instant('dxgpt.errorMessage'),
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
  }

  isActualPatient(patientId: string): boolean {
    if (!patientId) {
      return false;
    }
    
    const currentPatient = this.authService.getCurrentPatient();
    if (!currentPatient) {
      return false;
    }
    
    // Comparar por sub (usar == para comparación débil)
    if (currentPatient.sub == patientId) {
      return true;
    }
    
    // Si no coincide por sub, comparar por _id (ID de MongoDB)
    const currentPatientId = (currentPatient as any)._id;
    if (currentPatientId && currentPatientId == patientId) {
      return true;
    }
    
    return false;
  }
  private handleNoStep(parsedData: any) {
    if (parsedData.docId && parsedData.status) {
      this.updateDocumentStatus(parsedData);
      if (parsedData.status === 'timeline ready') {
        this.loadEnvironmentMydata();
      }
    }
    if (!this.tasksUpload[parsedData.docId]) {
      this.initializeTask(parsedData);
    }
    this.updateTaskStatus(parsedData);
  }

  private handleStep(parsedData: any) {
    switch (parsedData.step) {
      case 'navigator':
        this.handleNavigator(parsedData);
        break;
      case 'extract events':
        this.handleExtractEvents(parsedData);
        break;
      case 'summary':
        if (parsedData.status == 'patient card ready' && !this.openingSummary && this.modalReference == undefined) {
          this.getPatientSummary(false);
        }
        break;
    }
  }

  private updateDocumentStatus(parsedData: any) {
    const docIndex = this.docs.findIndex(d => d._id === parsedData.docId);
    if (docIndex !== -1) {
      const doc = { ...this.docs[docIndex] };

      if (parsedData.status === 'categoriria done') {
        const oldOriginalDate = doc.originaldate;
        doc.badge = this.getBadgeClass(parsedData.value);
        doc.categoryTag = this.getTranslatedCategoryTag(parsedData.value);
        doc.originaldate = this.isValidDate(parsedData.date) ? new Date(parsedData.date) : null;
        this.docs[docIndex] = doc;
        
        // Si cambió el originaldate (de null a fecha o viceversa), reordenar
        const hadOriginalDate = !this.isDateMissing(oldOriginalDate);
        const hasOriginalDate = !this.isDateMissing(doc.originaldate);
        if (hadOriginalDate !== hasOriginalDate) {
          this.reorderDocumentsByStatus();
        }
      }

      if (!this.isDocStatusFinal(doc.status)) {
        const oldStatus = doc.status;
        doc.status = this.getNewDocStatus(parsedData.status);
        this.docs[docIndex] = doc;
        
        // Si el estado cambió de 'inProcess' a otro, reordenar los documentos
        if (oldStatus === 'inProcess' && doc.status !== 'inProcess') {
          this.reorderDocumentsByStatus();
        }
      }
    }
  }

  // Ordena un array de documentos: procesando -> sin fecha original -> con fecha original
  private sortDocumentsByStatus(documents: any[]): any[] {
    // Separar en 3 grupos: procesando, sin fecha original, con fecha original
    const processingDocs = documents.filter(doc => doc.status === 'inProcess');
    const docsWithoutOriginalDate = documents.filter(doc => doc.status !== 'inProcess' && this.isDateMissing(doc.originaldate));
    const docsWithOriginalDate = documents.filter(doc => doc.status !== 'inProcess' && !this.isDateMissing(doc.originaldate));
    
    // Ordenar documentos en procesamiento por fecha de subida (más recientes primero)
    processingDocs.sort(this.sortService.DateSortInver("date"));
    
    // Ordenar documentos sin fecha original por fecha de subida (más recientes primero)
    docsWithoutOriginalDate.sort(this.sortService.DateSortInver("date"));
    
    // Ordenar documentos con fecha original por originaldate (más recientes primero)
    docsWithOriginalDate.sort((a, b) => {
      const dateA = a.originaldate ? new Date(a.originaldate).getTime() : 0;
      const dateB = b.originaldate ? new Date(b.originaldate).getTime() : 0;
      return dateB - dateA; // Más recientes primero
    });
    
    // Combinar: procesando -> sin fecha original -> con fecha original
    return [...processingDocs, ...docsWithoutOriginalDate, ...docsWithOriginalDate];
  }

  // Reordena los documentos: procesando -> sin fecha original -> con fecha original
  reorderDocumentsByStatus() {
    this.docs = this.sortDocumentsByStatus(this.docs);
    this.updateDocumentSelection();
  }

  private isValidDate(date: string | null | undefined): boolean {
    if (date === null || date === undefined || date === '') {
      return false;
    }
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }

  private isDocStatusFinal(status: string): boolean {
    return ['done', 'finished', 'resumen ready'].includes(status);
  }

  private getNewDocStatus(status: string): string {
    const statusMapping: { [key: string]: string } = {
      'error summarize': 'failed',
      'error cleaning': 'failed',
      'failed': 'failed',
      'error anomalies': 'failed',
      'error timeline': 'failed',
      'resumen ready': 'finished'
    };

    return statusMapping[status] || 'inProcess';
  }

  scrollToBottom(): void {
    try {
      document.getElementById('chatContainer').scrollIntoView(true);
    } catch (err) { }
  }

  scrollToBottomPage(): void {
    window.scroll({
      top: document.body.scrollHeight,
      left: 0,
      behavior: 'smooth'
    });
  }

  @HostListener("window:scroll", [])
  onWindowScroll() {
    // Solo detectar scroll cuando estamos en la vista de chat
    if (this.currentView !== 'chat') {
      this.scrollToBottomVisible = false;
      return;
    }

    let number = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // Scroll to bottom button visibility
    // Mostrar cuando estamos cerca del inicio y ocultar cuando nos acercamos al final
    if (number < (documentHeight - windowHeight - 600)) {
      this.scrollToBottomVisible = true;
    } else {
      this.scrollToBottomVisible = false;
    }
  }

  addMessage(message: any) {
    if (message.text) {
      // Procesar referencias de documentos usando las referencias del backend si están disponibles
      // (guardadas temporalmente desde processNavigatorAnswer)
      const references = (this as any).pendingReferences || message.references;
      message.text = this.processDocumentReferences(message.text, references);
      
      message.text = message.text.replace(/<h1>/g, '<h6>').replace(/<\/h1>/g, '</h5>');
      message.text = message.text.replace(/<h2>/g, '<h6>').replace(/<\/h2>/g, '</h6>');
      message.text = message.text.replace(/<h3>/g, '<h6>').replace(/<\/h3>/g, '</h6>');
    }
    // Add timestamp to track new messages
    message.timestamp = Date.now();
    message.isNew = true;
    this.messages.push(message);
    
    // Remove the isNew flag after animation completes
    setTimeout(() => {
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage && lastMessage.timestamp === message.timestamp) {
        lastMessage.isNew = false;
      }
    }, 500);
    
    this.scrollToBottom();
  }

  private initializeTask(parsedData: any) {
    const msg1 = this.translate.instant("messages.m0", { value: parsedData.filename });
    this.tasksUpload[parsedData.docId] = this.createNewTask(parsedData);
    this.addMessage({
      text: msg1,
      isUser: false,
      task: this.tasksUpload[parsedData.docId],
      index: parsedData.docId
    });
  }

  private createNewTask(parsedData: any): any {
    return {
      index: this.messages.length,
      steps: [
        { name: this.translate.instant('messages.m1.1'), status: 'inProcess' },
        { name: this.translate.instant('messages.m4.1'), status: 'pending' },
        { name: this.translateYouCanAskInChat, status: 'pending' },
        {
          name: this.translate.instant('messages.m3.1'),
          status: 'pending',
          action: `<resumen id='${parsedData.docId}' class="round ml-1 btn btn-success btn-sm bg-light-success">${this.translate.instant('generics.View')}</resumen>`
        }
      ]
    };
  }

  private updateTaskStatus(parsedData: any) {
    const task = this.tasksUpload[parsedData.docId];

    const stepStatusMapping: { [key: string]: number } = {
      'inProcess': 0,
      'extracted done': 0,
      'creando resumen': 3,
      'resumen ready': 3,
      'categorizando texto': 1,
      'clean ready': 1,
      'anomalies found': 1,
      'new events extracted': 0,
      'error cleaning': 1,
      'error summarize': 3,
      'error anomalies': 3,
      'error timeline': 3,
      'failed': 3
    };

    const stepIndex = stepStatusMapping[parsedData.status];

    // Only update the step if its status is not already 'finished' and stepIndex is valid
    if (stepIndex !== undefined && task.steps[stepIndex] && task.steps[stepIndex].status !== 'finished') {
      task.steps[stepIndex].status = parsedData.status.includes('error') ? 'failed' : parsedData.status.includes('finished') ? 'finished' : parsedData.status;

      if (parsedData.status === 'new events extracted') {
        task.steps[1].data = parsedData.data;
      }

      if (parsedData.status === 'Tipo de documento detectado') {
        this.handleDocTypeDetected(parsedData);
      }

      if (parsedData.status === 'clean ready') {
        task.steps[1].status = 'finished';
        task.steps[0].status = 'finished';
        task.steps[2].status = 'finished';
        if (this.isStepInProcessChat() == false) {
          this.loadEnvironmentMydata();
        }
      }

      // Specific checks for other statuses
      if (parsedData.status === 'inProcess') {
        task.steps[0].status = 'inProcess';
      } else if (parsedData.status === 'extracted done') {
        task.steps[0].status = 'finished';
      } else if (parsedData.status === 'creando resumen') {
        task.steps[3].status = 'inProcess';
        task.steps[0].status = 'finished';
      } else if (parsedData.status === 'resumen ready') {
        task.steps[3].status = 'finished';
        task.steps[0].status = 'finished';
        this.getSuggestionsFromSummary(parsedData.docId);
      } else if (parsedData.status === 'categorizando texto') {
        task.steps[1].status = 'inProcess';
        task.steps[0].status = 'finished';
      } else if (parsedData.status === 'failed') {
        task.steps.forEach(step => {
          step.status = 'failed';
        });
      } else if (parsedData.status === 'error summarize' || parsedData.status === 'error anomalies' || parsedData.status === 'error timeline') {
        task.steps[3].status = 'failed';
      } else if (parsedData.status === 'error cleaning' && task.steps[1].status !== 'finished') {
        task.steps[1].status = 'failed';
        task.steps[2].status = 'failed';
        task.steps[3].status = 'failed';
      }

      // Update the task object in the tasksUpload list
      this.tasksUpload[parsedData.docId] = { ...task };
      this.messages[task.index].task.steps = [...task.steps];
    }

    if (parsedData.status === 'anomalies found') {
      // Crear un ID único para esta anomalía para evitar duplicados
      const anomalyKey = `${parsedData.docId}_${parsedData.filename}_anomalies`;
      
      // Solo procesar si no se ha mostrado ya
      if (!this.processedAnomalies.has(anomalyKey)) {
        this.processedAnomalies.add(anomalyKey);
        
        this.translateAnomalies(parsedData.anomalies).then(translatedAnomalies => {
          this.addMessage({
            text: '<span class="badge badge-warning mb-1 mr-2"><i class="fa fa-exclamation-triangle"></i></span><strong>' + parsedData.filename + '</strong>: ' + this.translate.instant('messages.anomaliesFound') + '<br>' + translatedAnomalies,
            isUser: false
          });
        });
      } else {
        console.log('⚠️ Anomalías ya mostradas para:', anomalyKey);
      }
    }
  }

  /**
   * Inicializa paneles de progreso para documentos que están en proceso
   * pero no tienen un panel creado (ej: usuario viene del wizard)
   */
  private initializeInProgressDocuments() {
    const inProgressStatuses = ['pending', 'inProcess', 'extracted done', 'extracted_translated done', 
                                 'categorizando texto', 'clean ready', 'creando resumen'];
    
    for (const doc of this.docs) {
      if (inProgressStatuses.includes(doc.status)) {
        const docIdEnc = doc._id; // El ID ya viene encriptado del servidor
        
        // Solo crear el panel si no existe
        if (!this.tasksUpload[docIdEnc]) {
          console.log(`[initializeInProgressDocuments] Creando panel para doc en proceso: ${doc.title} (${doc.status})`);
          
          // Crear el panel de progreso
          const task = {
            index: this.messages.length,
            steps: [
              { name: this.translate.instant('messages.m1.1'), status: 'pending' },
              { name: this.translate.instant('messages.m4.1'), status: 'pending' },
              { name: this.translateYouCanAskInChat, status: 'pending' },
              {
                name: this.translate.instant('messages.m3.1'),
                status: 'pending',
                action: `<resumen id='${docIdEnc}' class="round ml-1 btn btn-success btn-sm bg-light-success">${this.translate.instant('generics.View')}</resumen>`
              }
            ]
          };
          
          // Actualizar estados basados en el status actual del documento
          if (doc.status === 'extracted done' || doc.status === 'extracted_translated done') {
            task.steps[0].status = 'finished';
          } else if (doc.status === 'categorizando texto') {
            task.steps[0].status = 'finished';
            task.steps[1].status = 'inProcess';
          } else if (doc.status === 'clean ready') {
            task.steps[0].status = 'finished';
            task.steps[1].status = 'finished';
            task.steps[2].status = 'finished';
          } else if (doc.status === 'creando resumen') {
            task.steps[0].status = 'finished';
            task.steps[1].status = 'finished';
            task.steps[2].status = 'finished';
            task.steps[3].status = 'inProcess';
          } else if (doc.status === 'inProcess') {
            task.steps[0].status = 'inProcess';
          }
          
          this.tasksUpload[docIdEnc] = task;
          
          const msg1 = this.translate.instant("messages.m0", { value: doc.title });
          this.addMessage({
            text: msg1,
            isUser: false,
            task: task,
            index: docIdEnc
          });
        }
      }
    }
  }

  private handleDocTypeDetected(parsedData: any) {
    const docTypeMapping: { [key: string]: string } = {
      'Report': this.translate.instant('messages.doctype1'),
      'Analysis': this.translate.instant('messages.doctype2'),
      'Other': this.translate.instant('messages.doctype3')
    };
    const typeDoc = docTypeMapping[parsedData.docType.type] || docTypeMapping['Other'];
    this.addMessage({
      text: `<strong>${parsedData.filename}</strong>: ${typeDoc}`,
      isUser: false
    });
  }

  private handleNavigator(parsedData: any) {
    // Validar una vez más que el mensaje sea para el paciente actual
    // Esto es una doble verificación por si acaso
    if (parsedData.patientId && !this.isActualPatient(parsedData.patientId)) {
      console.warn('⚠️ handleNavigator: mensaje ignorado, no corresponde al paciente actual');
      console.warn('  - Mensaje patientId:', parsedData.patientId);
      console.warn('  - Paciente actual:', this.authService.getCurrentPatient()?.sub);
      return;
    }
    
    if (parsedData.status === 'generando sugerencias') {
      // Solo activar gettingSuggestions si no estamos procesando una respuesta
      if (this.callingOpenai) {
        this.gettingSuggestions = true;
      }
    } else if (parsedData.status === 'respuesta generada') {
      this.processNavigatorAnswer(parsedData);
    } else if (parsedData.status === 'sugerencias generadas') {
      this.translateSuggestions(parsedData.suggestions);
    } else if (parsedData.status === 'error') {
      // Limpiar el estado cuando hay un error
      this.callingOpenai = false;
      this.gettingSuggestions = false;
      
      // Manejar diferentes tipos de errores
      const errorMessage = parsedData.message || parsedData.error || 'ERROR_PROCESSING_REQUEST';
      const errorDetails = parsedData.error || errorMessage;
      
      console.error('Error en navigator:', errorDetails, parsedData);
      
      // Registrar el error en insights
      this.insightsService.trackException(new Error(`Navigator error: ${errorMessage}`));
      
      // Mostrar mensaje de error al usuario
      if (errorMessage === 'ERROR_PROCESSING_REQUEST') {
        this.toastr.error(
          this.translate.instant('messages.errorProcessingRequest') || 'Error procesando la solicitud. Por favor, inténtalo de nuevo.',
          this.translate.instant('generics.Error') || 'Error'
        );
      } else {
        this.toastr.error(
          errorMessage,
          this.translate.instant('generics.Error') || 'Error'
        );
      }
    } else {
      this.updateNavigatorStatus(parsedData);
    }
  }

  /**
   * Procesa las referencias de documentos en el texto HTML y las convierte en enlaces clickeables
   * Usa las referencias estructuradas del backend cuando están disponibles, o hace fallback a búsqueda local
   * @param htmlText Texto HTML con referencias en formato [filename, date]
   * @param references Array de referencias estructuradas del backend (opcional)
   */
  /**
   * Procesa las referencias de documentos en el texto HTML y las convierte en enlaces clickeables
   * Soporta múltiples referencias separadas por punto y coma dentro de los mismos corchetes
   * @param htmlText Texto HTML con referencias en formato [filename, date] o [file1, date1; file2, date2]
   * @param references Array de referencias estructuradas del backend (opcional)
   */
  private processDocumentReferences(htmlText: string, references?: any[]): string {
    if (!htmlText) {
      return htmlText;
    }

    // Contador para superíndices
    let refCounter = 0;

    // Patrones para detectar placeholders internos que no deben mostrarse
    const internalPlaceholders = /^\[?(PATIENT PROFILE|PERFIL DEL PACIENTE|PROFIL PATIENT|PATIENTENPROFIL|RELEVANT CLINICAL DATA|DATOS CLÍNICOS|HISTORICAL CONTEXT|CONTEXTO HISTÓRICO)/i;

    // Patrón para capturar todo lo que hay dentro de corchetes
    const bracketPattern = /\[([^\]]+?)\]/g;

    return htmlText.replace(bracketPattern, (fullMatch, content) => {
      // Ocultar placeholders internos del curateContext
      if (internalPlaceholders.test(content)) {
        return '';
      }

      // Referencias sin coma pero que son memorias/contexto (ej: "Memoria de conversación reciente 1")
      if (!content.includes(',')) {
        // Detectar si es una referencia a memoria/contexto/conversación
        const memoryPattern = /(memoria|memory|contexto|context|historial|history|conversaci[oó]n|conversation)/i;
        if (memoryPattern.test(content)) {
          refCounter++;
          const tooltipText = content.trim();
          return `<span class="context-reference" style="cursor: help;" title="${tooltipText}"><sup style="font-size: 0.7em; background: #f3e5f5; color: #6f42c1; padding: 1px 4px; border-radius: 3px;">💬${refCounter}</sup></span>`;
        }
        // No es una cita válida, dejarlo como está
        return fullMatch;
      }

      // Dividir el contenido por punto y coma para manejar múltiples citas
      const parts = content.split(';');
      
      const processedParts = parts.map(part => {
        const trimmedPart = part.trim();
        // Intentar capturar nombre de archivo y fecha/undated
        // El regex busca el último fragmento después de la última coma como la fecha
        const lastCommaIndex = trimmedPart.lastIndexOf(',');
        if (lastCommaIndex === -1) {
          return trimmedPart;
        }

        const fileName = trimmedPart.substring(0, lastCommaIndex).trim();
        let date = trimmedPart.substring(lastCommaIndex + 1).trim();
        const displayDate = date; // Guardar la fecha original para mostrar

        // Normalizar formato de fecha: aceptar YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
        const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
        const euDatePattern = /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/;
        // Equivalentes de "undated" en varios idiomas
        const undatedPattern = /^(undated|sin fecha|ohne datum|sans date|sem data|senza data|no date|fecha desconocida|unknown date)$/i;
        
        if (isoDatePattern.test(date)) {
          // Ya está en formato correcto YYYY-MM-DD
        } else if (euDatePattern.test(date)) {
          // Convertir DD-MM-YYYY o DD/MM/YYYY a YYYY-MM-DD
          const match = date.match(euDatePattern);
          date = `${match[3]}-${match[2]}-${match[1]}`;
        } else if (undatedPattern.test(date)) {
          // Normalizar a "undated" internamente
          date = 'undated';
        } else {
          // Fecha no reconocida, devolver sin procesar
          return trimmedPart;
        }

        refCounter++;
        const partFullCitation = `[${fileName}, ${date}]`;

        // 1. Intentar usar las referencias del backend si existen
        if (references && references.length > 0) {
          const ref = references.find(r => r.fullCitation === partFullCitation || r.filename === fileName);
          if (ref && ref.documentId) {
            const tooltipText = `${fileName} (${displayDate})`;
            return `<a href="javascript:void(0)" 
                        class="document-reference-link" 
                        data-doc-id="${ref.documentId}"
                        style="color: #007bff; text-decoration: none; cursor: pointer;"
                        title="${tooltipText}"><sup style="font-size: 0.7em; background: #e3f2fd; padding: 1px 4px; border-radius: 3px;">📄${refCounter}</sup></a>`;
          }
        }

        // 2. Detectar si NO es un archivo real (sin extensión conocida)
        // Las citaciones de contexto/conversación no tienen extensión de archivo
        const hasFileExtension = /\.(pdf|docx?|txt|xlsx?|csv|png|jpg|jpeg|gif|html?|xml|json)$/i.test(fileName);

        // 3. Búsqueda local por nombre (solo si parece un archivo)
        if (hasFileExtension && this.docs && this.docs.length > 0) {
          // Función para normalizar nombres (quitar tildes, guiones, etc.)
          const normalize = (str: string) => str
            .toLowerCase()
            .trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar tildes
            .replace(/[-_\s]+/g, '') // Normalizar separadores
            .replace(/\.(pdf|txt|docx?)$/i, ''); // Quitar extensión
          
          // Extraer posible ID numérico del nombre (ej: 19702982 de "Hematología-19702982.pdf")
          const numericIdMatch = fileName.match(/(\d{8,})/);
          const searchNumericId = numericIdMatch ? numericIdMatch[1] : null;
          
          const searchFileName = normalize(fileName);
          
          const doc = this.docs.find(d => {
            if (!d.title && !d.url) return false;
            const docTitle = normalize(d.title || '');
            const docFileName = normalize((d.url || '').split('/').pop() || '');
            
            // Match exacto normalizado
            if (docTitle === searchFileName || docFileName === searchFileName) return true;
            
            // Match parcial (uno contiene al otro)
            if (docTitle.includes(searchFileName) || searchFileName.includes(docTitle)) return true;
            if (docFileName.includes(searchFileName) || searchFileName.includes(docFileName)) return true;
            
            // Match por ID numérico
            if (searchNumericId && (docTitle.includes(searchNumericId) || docFileName.includes(searchNumericId))) return true;
            
            return false;
          });

          if (doc) {
            const docId = doc._id || doc.id || '';
            const tooltipText = `${fileName} (${displayDate})`;
            return `<a href="javascript:void(0)" 
                        class="document-reference-link" 
                        data-doc-id="${docId}"
                        style="color: #007bff; text-decoration: none; cursor: pointer;"
                        title="${tooltipText}"><sup style="font-size: 0.7em; background: #e3f2fd; padding: 1px 4px; border-radius: 3px;">📄${refCounter}</sup></a>`;
          }
        }

        // 4. Si no es archivo o no se encontró: mostrar como referencia de contexto (morado)
        // o como documento no encontrado (gris) dependiendo del caso
        if (!hasFileExtension) {
          // Es una referencia al contexto/conversación/historial - mostrar en morado compacto
          const tooltipText = `${fileName} (${displayDate})`;
          return `<span class="context-reference" style="cursor: help;" title="${tooltipText}"><sup style="font-size: 0.7em; background: #f3e5f5; color: #6f42c1; padding: 1px 4px; border-radius: 3px;">👤${refCounter}</sup></span>`;
        } else {
          // Es un archivo pero no se encontró - mostrar en gris compacto
          const tooltipText = `${fileName} (${displayDate})`;
          const bgColor = date === 'undated' ? '#fff3cd' : '#f5f5f5';
          return `<span class="document-reference" style="cursor: help;" title="${tooltipText}"><sup style="font-size: 0.7em; background: ${bgColor}; color: #6c757d; padding: 1px 4px; border-radius: 3px;">📄${refCounter}</sup></span>`;
        }
      });

      // En modo compacto, no envolvemos con corchetes
      return processedParts.join('');
    });
  }

  private async processNavigatorAnswer(parsedData: any) {
    // Protección contra respuestas duplicadas: usar timestamp + answer como ID único
    const answerId = `${parsedData.time || Date.now()}_${parsedData.answer?.substring(0, 50) || ''}`;
    if (this.lastProcessedAnswerId === answerId) {
      console.warn('⚠️ Respuesta duplicada detectada (mismo ID), ignorando:', answerId);
      return;
    }
    this.lastProcessedAnswerId = answerId;
    
    // Limpiar el estado inmediatamente al recibir la respuesta
    this.callingOpenai = false;
    this.gettingSuggestions = false;
    this.actualStatus = '';
    
    // Si el mensaje NO viene de notificación, añadir también la pregunta al contexto
    const isFromNotification = parsedData.fromNotification === true;
    if (!isFromNotification) {
      const messageToUse = this.tempInput || this.message;
      this.context.push({ role: 'user', content: messageToUse });
    }
    
    // Añadir la respuesta al contexto
    this.context.push({ role: 'assistant', content: parsedData.answer });
    
    // Mostrar el mensaje (el backend ya traduce y guarda)
    try {
      const references = parsedData.references || [];
      (this as any).pendingReferences = references;
      await this.translateInverse(parsedData.answer);
      (this as any).pendingReferences = null;
    } catch (error) {
      console.error('Error al procesar el mensaje:', error);
      this.insightsService.trackException(error);
      (this as any).pendingReferences = null;
    }
    
    // Detectar eventos del navegador (extracción automática de eventos de la respuesta)
    // Los eventos se obtienen de la BD en el servidor para asegurar datos frescos
    const messageToUse = this.tempInput || this.message;
    const query = {
      question: messageToUse,
      answer: parsedData.answer,
      userId: this.authService.getIdUser(),
      patientId: this.currentPatient
    };

    this.subscription.add(
      this.http.post(environment.api + '/api/eventsnavigator/', query).subscribe(
        () => { },
        err => {
          console.error(err);
          this.insightsService.trackException(err);
        }
      )
    );
  }

  private updateNavigatorStatus(parsedData: any) {
    const statusMapping: { [key: string]: string } = {
      // Nuevos estados del pipeline
      'detectando intención': this.translate.instant('navigator.detecting_intent') || 'Analizando tu pregunta...',
      'intent detectado': this.translate.instant('navigator.intent_detected') || 'Pregunta analizada',
      'recuperando historial': this.translate.instant('navigator.retrieving_history') || 'Recuperando historial...',
      'buscando en documentos': this.translate.instant('navigator.searching_documents') || 'Buscando en tus documentos...',
      'analizando documentos': this.translate.instant('navigator.analyzing_documents') || `Analizando ${parsedData.documentsFound || ''} documentos...`,
      'extrayendo datos clínicos': this.translate.instant('navigator.extracting_data') || 'Extrayendo datos clínicos...',
      'preparando contexto': this.translate.instant('navigator.preparing_context') || 'Preparando contexto...',
      'invocando modelo': this.translate.instant('navigator.invoking_model') || 'Pensando...',
      // Estados existentes
      'generando respuesta': this.translate.instant('navigator.generating_response') || 'Generando respuesta...',
      'generando sugerencias': this.translate.instant('navigator.generating_suggestions') || 'Generando sugerencias...',
      'respuesta generada': this.translate.instant('navigator.response_generated') || 'Respuesta generada',
      'sugerencias generadas': this.translate.instant('navigator.suggestions_generated') || 'Sugerencias generadas'
    };

    const actionMapping: { [key: string]: string } = {
      'Patient Context': 'Patient Context',
      'Raw Patient Documents': 'Raw Patient Documents',
      'Dravet Syndrome Book': 'Dravet Syndrome Book',
      'PubMed': 'PubMed',
      'Arxiv': 'Arxiv',
      'Bing Search': 'Bing Search',
      'MediSearch': 'MediSearch',
      'Clinical Trials Search': 'Clinical Trials Search',
      'Final Answer': 'Final Answer',
      'Drug Search': 'Drug Search'
    };

    if (parsedData.status in statusMapping) {
      this.actualStatus = statusMapping[parsedData.status];
      this.statusChange();
    } else if (parsedData.status === 'action' && parsedData.action.action in actionMapping) {
      this.actualStatus = actionMapping[parsedData.action.action];
      this.statusChange();
    }
  }

  private handleExtractEvents(parsedData: any) {
    if (parsedData.status === 'analizando respuesta') {
      this.setLastMessageLoading();
    } else if (parsedData.status === 'respuesta analizada') {
      this.processExtractedEvents(parsedData.events);
    }
  }

  private setLastMessageLoading() {
    let index = this.messages.length - 1;
    while (index >= 0) {
      if (!this.messages[index].isUser) {
        this.messages[index].loading = true;
        break;
      }
      index--;
    }
  }

  private processExtractedEvents(events: any) {
    let index = this.messages.length - 1;
    while (index >= 0) {
      if (!this.messages[index].isUser && events.length > 0) {
        this.messages[index].events = events;
        this.translateEvents(events);
        break;
      }
      index--;
    }
  }

  private async translateEvents(events: any) {
    const jsontestLangText = events.map((event: any) => ({ Text: event.insight }));
    if (this.detectedLang !== 'en') {
      try {
        const res2 = await this.apiDx29ServerService.getTranslationInvert(this.detectedLang, jsontestLangText).toPromise();
        res2.forEach((translation: any, i: number) => {
          events[i].insight = translation.translations[0].text;
        });
        this.proposedEvents = events;
      } catch (err) {
        console.error(err);
        this.insightsService.trackException(err);
        this.proposedEvents = events;
      }
    } else {
      this.proposedEvents = events;
    }

  }

  private async handleEventTask(info: any) {
    const doc = this.docs.find(x => x._id === info.task.docId);
    if (info.step.name === this.translateGeneratingSummary) {
      this.openResults(doc, this.contentSummaryDoc);
    } else if (info.step.name === this.translateAnonymizingDocument) {
      this.openAnonymizedResults(doc, this.contentviewDoc, 'anonymized.txt');
    } else if (info.step.name === this.translateSummaryPatient && !this.openingSummary) {
      this.getPatientSummary(false);
    }
  }

  private async handleChangeLang() {
    this.getTranslations();
  }

  private statusChange() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.messagesExpectOutPut = '';

    // actualStatus ya viene traducido del statusMapping, usarlo directamente
    this.messagesExpect = this.actualStatus;
    this.delay(100);
    const words = this.messagesExpect.split(' ');
    let index = 0;

    // 100ms is the speed at which characters appear in the typing animation
    this.intervalId = setInterval(() => {
      if (index < this.messagesExpect.length && (this.callingOpenai || this.gettingSuggestions)) {
        const char = this.messagesExpect[index];
        this.messagesExpectOutPut += char;
        index++;
      } else {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }, 7);
  }

  private showRandomMsg() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.messagesExpectOutPut = '';
    const randomIndex = Math.floor(Math.random() * 6);
    this.messagesExpect = this.translate.instant(`messages.expect${randomIndex}`);
    this.delay(1000);
    const words = this.messagesExpect.split(' ');
    let index = 0;

    this.intervalId = setInterval(() => {
      if (index < words.length && this.callingOpenai) {
        const word = words[index];
        this.messagesExpectOutPut += (index > 0 ? ' ' : '') + word;
        index++;
      } else {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }, 120);
  }

  onMessageClick(event: MouseEvent, index: number) {
    const target = event.target as HTMLElement;
    
    // Manejar clics en enlaces de documentos
    if (target.classList.contains('document-reference-link') || target.closest('.document-reference-link')) {
      event.preventDefault();
      const linkElement = target.classList.contains('document-reference-link') 
        ? target 
        : target.closest('.document-reference-link') as HTMLElement;
      
      if (linkElement) {
        const docId = linkElement.getAttribute('data-doc-id');
        if (docId) {
          const doc = this.docs.find(x => x._id === docId);
          if (doc) {
            this.openResults(doc, this.contentSummaryDoc);
          } else {
            this.toastr.warning(
              this.translate.instant('messages.documentNotFound') || 'Documento no encontrado',
              ''
            );
          }
        }
      }
      return;
    }

    // Manejar clics en enlaces de contexto (conversation_context)
    if (target.classList.contains('context-reference-link') || target.closest('.context-reference-link')) {
      event.preventDefault();
      this.openTimelineModal(this.timelineModal);
      return;
    }
    
    // Manejar clics en elementos resumen (código original)
    if (target.tagName.toLowerCase() === 'resumen') {
      event.preventDefault();
      //search in docs where _id = target.id
      const doc = this.docs.find(x => x._id === target.id);
      if (doc) {
        this.openResults(doc, this.contentSummaryDoc);
      }
    }
  }

  initChat() {
    if (this.messages.length < 2) {
      this.messages = [];
      if (this.docs.length == 0) {
        /*this.addMessage({({
          text: this.translate.instant('home.botmsg1'),
          isUser: false
        });*/
      } else {
        /*this.addMessage({({
          text: this.translate.instant('home.botmsg2'),
          isUser: false
        });*/
      }
    }

  }

  async deleteChat() {
    this.showOptionsData = "general";
    this.messages = [];
    this.suggestions = [];
    this.proposedEvents = [];
    this.initChat();
    this.context.splice(1, this.context.length - 1);
    
    // Eliminar mensajes en el backend
    await this.deleteMessagesFromServer();
    // get 4 random suggestions from the hardcoded pool or the summary
    try {
      this.suggestions = this.getAllSuggestions(4);
    } catch (error) {
      console.error(error.message);
      this.insightsService.trackException(error);
      this.suggestions = [];
    }
  }

  initEnvironment() {
    this.actualPatient = this.authService.getCurrentPatient();
    this.currentPatient = this.authService.getCurrentPatient().sub;
    // containerName se obtiene del servidor en getAzureBlobSasToken()
    this.getDocs();
    this.getAzureBlobSasToken();
    this.getMessages();
    //this.getStateDonation();
    this.loadEnvironmentMydata();
    this.getRoleMedicalLevel();
    this.getNotes();
    this.loadRecentActivity();
    this.loadRecentAppointments();
  }

  loadRecentActivity() {
    this.subscription.add(
      this.activityService.getRecentActivity().subscribe(
        (activities: any) => {
          let task = {type: 'recentActivity', info: activities};
          this.eventsService.broadcast('recentActivity', task);
        },
        (err) => {
          console.error(err);
          this.insightsService.trackException(err);
        }
      )
    );
  }
  loadRecentAppointments() {
    this.subscription.add(
      this.activityService.getRecentAppointments().subscribe(
        (appointments: any) => {
          console.log(appointments);
          let task = {type: 'recentAppointments', count: appointments.appointments.length, patientId: appointments.patientId};
          this.eventsService.broadcast('recentAppointments', task);
        },
        (err) => {
          console.error(err);
          this.insightsService.trackException(err);
        }
      )
    );
  }

  getRoleMedicalLevel() {
    this.subscription.add(this.patientService.getRoleMedicalLevel()

      .subscribe((res: any) => {
        this.role = res.role;
        this.medicalLevel = res.medicalLevel;
      }, (err) => {
        console.log(err);
      }));
  }

  getAzureBlobSasToken() {
    this.accessToken.patientId = this.currentPatient;

    this.subscription.add(this.apiDx29ServerService.getAzureBlobSasTokenForPatient(this.currentPatient)
      .subscribe((res: any) => {
        this.accessToken.sasToken = '?' + res.containerSAS;
        this.accessToken.containerName = res.containerName;
        this.containerName = res.containerName;
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
      }));
  }

  async loadEnvironmentMydata() {
    this.loadedAllEvents = false;
    await this.loadEvents(false);
    this.loadedAllEvents = true;
    this.showTimeline();
  }

  getDocs() {
    this.actualDoc = {};
    this.defaultDoc = {};
    this.docs = [];
    this.loadedDocs = false;
    this.pendingDoc = false;
    this.subscription.add(this.patientService.getDocuments()
      .subscribe((resDocs: any) => {
        console.log(resDocs)
        if (resDocs.length > 0) {
          // Ordenar documentos: procesando -> sin fecha original -> con fecha original
          this.docs = this.sortDocumentsByStatus(resDocs);
          
          for (var i = 0; i < this.docs.length; i++) {
            const fileName = this.docs[i].url.split("/").pop();
            this.docs[i].title = fileName;
            if (this.docs[i].categoryTag) {
              this.docs[i].badge = this.getBadgeClass(this.docs[i].categoryTag)
              this.docs[i].categoryTag = this.getTranslatedCategoryTag(this.docs[i].categoryTag);
            }
          }
          this.docs.forEach(doc => doc.selected = true);
          this.updateDocumentSelection();
          this.defaultDoc = this.docs[0];
          
          // Inicializar paneles de progreso para documentos que están en proceso
          // (por si el usuario viene del wizard y los eventos WebPubSub se perdieron)
          this.initializeInProgressDocuments();
        }
        this.loadedDocs = true;
        //this.assignFeedbackToDocs(this.docs);
        
        // Hacer scroll después de que se carguen los documentos
        setTimeout(() => {
          this.scrollToBottom();
        }, 300);
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.loadedDocs = true;
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  assignFeedbackToDocs(docs) {
    this.valueGeneralFeedback = '';
    this.subscription.add(this.http.post(environment.api + '/api/generalfeedback/get/' + this.authService.getCurrentPatient().sub, docs)
      .subscribe((response: any) => {
        const currentVersion = environment.version + ' - ' + environment.subversion;

        // Filtrar feedbacks individuales por la versión actual
        const individualFeedbacks = response.individualFeedbacks.filter(feedback => feedback.version.startsWith(environment.version));
        const generalFeedback = response.generalFeedback;

        // Asignar feedback individual a cada documento
        for (let doc of docs) {
          for (let feedback of individualFeedbacks) {
            for (let feedbackDoc of feedback.documents) {
              if (doc._id === feedbackDoc._id) {
                doc.feedback = feedback.value;
                break;
              }
            }
          }
        }

        // Asignar feedback general si está presente y la versión es la actual
        if (generalFeedback && generalFeedback.version.startsWith(environment.version)) {
          this.valueGeneralFeedback = generalFeedback.value.pregunta1;
        }

      }, (err) => {
        this.insightsService.trackException(err);
        console.log(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }


  sortDocs(key: string): void {
    this.sortKey = key;
    this.sortDirection = this.sortKey === key ? this.sortDirection * -1 : 1;
    this.filteredDocs = [...this.filteredDocs].sort((a, b) => {
      let comparison = 0;
      if (a[key] && b[key]) {
        const valA = key === 'date' ? new Date(a[key]) : a[key].toLowerCase();
        const valB = key === 'date' ? new Date(b[key]) : b[key].toLowerCase();

        comparison = valA < valB ? -1 : valA > valB ? 1 : 0;
      }
      return comparison * this.sortDirection;
    });
  }

  async loadEvents(newEvent): Promise<void> {
    this.subtypes = [];
    this.loadedEvents = false;
    this.events = [];
    this.metadata = [];
    this.initialEvents = [];
    if (!newEvent) {
      this.allEvents = [];
      this.allTypesEvents = [];
    }

    try {
      const eventsResponse: any = await this.http.get(environment.api + '/api/events/' + this.currentPatient).toPromise();

      if (!eventsResponse.message && eventsResponse.length > 0) {
        eventsResponse.sort(this.sortService.DateSort("date"));
        if (!newEvent) {
          this.allTypesEvents = eventsResponse;
          this.allEvents = eventsResponse;
        }
        for (let i = 0; i < eventsResponse.length; i++) {
          eventsResponse[i].dateInput = new Date(eventsResponse[i].dateInput);
          let dateWithoutTime = '';
          let dateWithTime = '';
          let dateEndWithoutTime = '';
          if (eventsResponse[i].date != undefined && eventsResponse[i].date.indexOf("T") != -1) {
            dateWithoutTime = eventsResponse[i].date.split("T")[0];
            // For appointments and reminders, include the time if it's not midnight
            const timePart = eventsResponse[i].date.split("T")[1];
            if (timePart && !timePart.startsWith("00:00")) {
              const timeOnly = timePart.substring(0, 5); // Get HH:mm
              dateWithTime = `${dateWithoutTime} ${timeOnly}`;
            } else {
              dateWithTime = dateWithoutTime;
            }
          }
          if (eventsResponse[i].dateEnd != undefined && eventsResponse[i].dateEnd.indexOf("T") != -1) {
            dateEndWithoutTime = eventsResponse[i].dateEnd.split("T")[0];
          }
          if (eventsResponse[i].key != undefined) {
            const initialEvent: any = {
              "insight": eventsResponse[i].name,
              "date": dateWithoutTime,
              "key": eventsResponse[i].key
            };
            if (dateEndWithoutTime) {
              initialEvent.dateEnd = dateEndWithoutTime;
            }
            this.initialEvents.push(initialEvent);
          }
          // For appointments and reminders, include time in metadata so the AI knows the scheduled time
          const isTimeSensitive = eventsResponse[i].key === 'appointment' || eventsResponse[i].key === 'reminder';
          const metadataItem: any = { 
            name: eventsResponse[i].name, 
            date: isTimeSensitive ? dateWithTime : dateWithoutTime 
          };
          if (dateEndWithoutTime) {
            metadataItem.dateEnd = dateEndWithoutTime;
          }
          this.metadata.push(metadataItem);
        }
        this.events = eventsResponse;
      }
      await this.loadBasicData();
      await this.loadAppointments();

      if (this.appointments.length > 0) {
        for (let i = 0; i < this.appointments.length; i++) {
          this.appointments[i].date = new Date(this.appointments[i].date);
          const appointmentDate = this.appointments[i].date;
          const hours = appointmentDate.getHours();
          const minutes = appointmentDate.getMinutes();
          // Include time if it's not midnight
          let dateStr = appointmentDate.toISOString().split('T')[0];
          if (hours !== 0 || minutes !== 0) {
            const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            dateStr = `${dateStr} ${timeStr}`;
          }
          this.metadata.push({ name: this.appointments[i].notes, date: dateStr });
        }
      }

      const patientInfo = this.metadata;
      if (this.context.length > 0) {
        this.context[0] = { role: "assistant", content: patientInfo };
      } else {
        this.context.push({ role: "assistant", content: patientInfo });
      }

      // Calcular eventos que necesitan revisión de fecha
      this.updateNeedingReviewCount();

      this.loadedEvents = true;
    } catch (err) {
      console.log(err);
      this.insightsService.trackException(err);
      this.loadedEvents = true;
    }
  }

  loadBasicData() {
    return this.http.get(environment.api + '/api/patients/basic/' + this.currentPatient).toPromise().then((res: any) => {
      if (res.gender) {
        this.metadata.push({ name: 'Gender:' + res.gender, date: undefined });
      }
      if (res.birthDate) {
        this.metadata.push({ name: 'BirthDate:' + res.birthDate, date: undefined });
      }
      return res;
    }).catch((err) => {
      console.log(err);
      this.insightsService.trackException(err);
    });
  }

  async loadAppointments() {
    if (this.loadingAppointments) {
      return;
    }
    this.appointments = [];
    this.loadingAppointments = true;
    try {
      let res: any = await this.http.get(environment.api + '/api/appointments/' + this.currentPatient).toPromise();
      if (!res.message && res.length > 0) {
        res.sort(this.sortService.DateSort("date"));
        this.appointments = res;
      }
    } catch (err) {
      console.log(err);
      this.insightsService.trackException(err);
    } finally {
      this.loadingAppointments = false;
    }
  }


  openUpdateDocDate(doc, PanelChangeDate) {
    // create a copy on this.tempDoc
    this.tempDoc = JSON.parse(JSON.stringify(doc));
    
    // Si no hay originaldate, usar la fecha de subida (date) como valor por defecto
    if (!this.tempDoc.originaldate) {
      this.tempDoc.originaldate = this.tempDoc.date ? new Date(this.tempDoc.date) : new Date();
    } else {
      // Asegurar que originaldate sea un objeto Date si es una cadena
      this.tempDoc.originaldate = new Date(this.tempDoc.originaldate);
    }
    
    if (this.modalReference2 != undefined) {
      this.modalReference2.close();
      this.modalReference2 = undefined;
    }
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-xs'// xl, lg, sm
    };
    this.modalReference2 = this.modalService.open(PanelChangeDate, ngbModalOptions);

  }

  async closeModal2() {
    if (this.modalReference2 != undefined) {
      this.modalReference2.close();
      this.modalReference2 = undefined;
    }
  }

  updateDocDate() {
    this.subscription.add(this.http.post(environment.api + '/api/document/updatedate/'+this.authService.getCurrentPatient().sub + '/' + this.tempDoc._id, { originaldate: this.tempDoc.originaldate })
      .subscribe(
        (response: any) => {
          console.log('Date updated successfully', response);
          this.docs.find(x => x._id === this.tempDoc._id).originaldate = this.tempDoc.originaldate;
          this.toastr.success(this.translate.instant("generics.Data saved successfully"));
          this.closeModal2();
        },
        (error) => {
          console.error('Error updating date:', error);
          this.toastr.error(this.translate.instant("generics.Data saved fail"));
        }
      ));
  }


  deleteDoc(doc) {
    Swal.fire({
      title: this.translate.instant("generics.Are you sure?"),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0CC27E',
      cancelButtonColor: '#FF586B',
      confirmButtonText: this.translate.instant("generics.Delete"),
      cancelButtonText: this.translate.instant("generics.No, cancel"),
      showLoaderOnConfirm: true,
      allowOutsideClick: false
    }).then((result) => {
      if (result.value) {
        this.confirmDeleteDoc(doc);
      }
    });
  }

  private confirmDeleteDoc(doc: any) {
    this.loadedDocs = false;

    this.subscription.add(
      this.patientService.deleteDocument(doc._id)
        .pipe(
          finalize(() => {
            if (this.modalReference) {
              this.modalReference.close();
              this.modalReference = undefined;
            }
          })
        )
        .subscribe({
          next: () => {
            this.handleSuccessfulDeletion(doc._id);
          },
          error: (err) => {
            console.log(err);
            this.insightsService.trackException(err);
            this.loadedDocs = true;
            this.toastr.error('', this.translate.instant("generics.error try again"));
          }
        })
    );
  }

  private handleSuccessfulDeletion(docId: string) {
    // Remove related message if exists
    const foundElement = this.searchService.search(this.messages, 'index', docId);
    if (foundElement) {
      const index = this.messages.indexOf(foundElement);
      if (index > -1) {
        this.messages.splice(index, 1);
      }
    }

    // Update UI and show success message
    this.toastr.success('', this.translate.instant("generics.Deleted successfully"));

    // Refresh data
    Promise.all([
      this.getDocs(),
      this.loadEnvironmentMydata()
    ]).then(() => {
      this.loadedDocs = true;
    });
  }

  async startEditing() {
    this.editingTitle = true;
  }
  
  // Calcular el ancho del input basado en el contenido
  getInputWidth(text: string): number {
    if (!text) return 200; // Ancho mínimo
    // Aproximadamente 8px por carácter (ajustable según la fuente)
    const charWidth = 8;
    const minWidth = 200;
    const maxWidth = 600;
    const calculatedWidth = text.length * charWidth + 40; // +40 para padding
    return Math.max(minWidth, Math.min(calculatedWidth, maxWidth));
  }
  
  // Ajustar el ancho del input mientras se escribe
  adjustInputWidth(event: any) {
    const input = event.target;
    const text = input.value;
    const newWidth = this.getInputWidth(text);
    input.style.width = newWidth + 'px';
  }

  cancelEditing() {
    this.editingTitle = false;
    const originalFileName = this.actualDoc.url.split("/").pop();
    this.actualDoc.title = originalFileName;
  }

  saveTitle() {
    this.editingTitle = false;

     // Obtener la extensión original del archivo
  const originalFileName = this.actualDoc.url.split("/").pop();
  const fileExtension = originalFileName.substring(originalFileName.lastIndexOf('.'));
  
  // Asegurarse de que el nuevo título mantiene la extensión original
  if (!this.actualDoc.title.endsWith(fileExtension)) {
    this.actualDoc.title = this.actualDoc.title + fileExtension;
  }
  if (this.actualDoc.title === originalFileName) {
    // No hay cambios, no es necesario hacer la llamada al servidor
    return;
  }
  
  
    // Aquí deberías agregar la lógica para guardar el título en tu backend
    this.subscription.add(this.http.post(environment.api + '/api/document/updatetitle/'+this.authService.getCurrentPatient().sub + '/' + this.actualDoc._id, { title: this.actualDoc.title, url: this.actualDoc.url })
      .subscribe((response: any) => {
        if(response.message == 'Done' || response.message == 'No changes needed'){
          this.docs.find(x => x._id === this.actualDoc._id).title = this.actualDoc.title;
          this.actualDoc.url = response.newUrl;
          this.docs.find(x => x._id === this.actualDoc._id).url = this.actualDoc.url;
          this.toastr.success(this.translate.instant("generics.Data saved successfully"));
        }else{
          this.toastr.error(this.translate.instant("generics.Data saved fail"));
          const originalFileName = this.actualDoc.url.split("/").pop();
          this.actualDoc.title = originalFileName;
        }
      }, (error) => {
        console.error('Error updating title:', error);
        this.toastr.error(this.translate.instant("generics.Data saved fail"));
        const originalFileName = this.actualDoc.url.split("/").pop();
        this.actualDoc.title = originalFileName;
      }));
  }

  getFileNameWithoutExtension(fileName: string): string {
    return fileName.substring(0, fileName.lastIndexOf('.'));
  }

  async onFileChangeStep(event) {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }

    let files = event.target.files;

    if (files.length > 5) {
      this.insightsService.trackEvent('Files limit reached', { files: files.length });
      Swal.fire(this.translate.instant("messages.errorFilesLimit"), '', "warning");
      return;
    }
    for (let file of files) {
      await this.processFile(file);
    }

    if (this.tempDocs.length > 0) {
      this.processFilesSequentially();
    } else {
      console.log("All files were either invalid or cancelled.");
    }
  }

  processFile(file) {
    return new Promise<void>((resolve, reject) => {
      if (file) {
        var reader = new FileReader();
        reader.readAsDataURL(file); // read file as data url
        reader.onload = (event2: any) => { // called once readAsDataURL is completed
          var filename = file.name;
          var extension = filename.substr(filename.lastIndexOf('.'));
          var pos = filename.lastIndexOf('.')
          pos = pos - 4;
          if (pos > 0 && extension == '.gz') {
            extension = filename.substr(pos);
          }
          filename = filename.split(extension)[0];

          // Comprobar si el archivo ya existe
          let fileExists = this.docs.some(doc => doc.title === file.name);
          const proceedWithFile = () => {
            if (extension == '.jpg' || extension == '.png' || extension == '.jpeg' || file.type == 'application/pdf' || extension == '.docx' || file.type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type == 'text/plain' || extension == '.txt') {
              var uniqueFileName = this.getUniqueFileName();
              filename = 'raitofile/' + uniqueFileName + '/' + filename + extension;
              let dataFile = { event: file, url: filename, name: file.name };
              this.tempDocs.push({ dataFile: dataFile, state: 'false' });
              console.log('preparado');
              resolve();
            } else {
              Swal.fire(this.translate.instant("dashboardpatient.error extension"), '', "warning");
              this.insightsService.trackEvent('Invalid file extension', { extension: extension });
              resolve(); // Continuar con los demás archivos aunque este sea inválido.
            }
          };

          if (fileExists) {
            Swal.fire({
              title: this.translate.instant("dashboardpatient.file exists"),
              text: this.translate.instant("dashboardpatient.rename file"),
              input: 'text',
              inputValue: filename,
              showCancelButton: true,
              confirmButtonText: this.translate.instant("dashboardpatient.confirm"),
              cancelButtonText: this.translate.instant("generics.Cancel")
            }).then((result) => {
              if (result.value) {
                filename = result.value; // Actualizar el nombre del archivo
                proceedWithFile();
              } else {
                // Continuar con los demás archivos aunque se cancele este.
                resolve();
              }
            });
          } else {
            proceedWithFile();
          }
        }
      }
    });
  }


  processFilesSequentially(index = 0) {
    if (this.tempDocs.length > 5) {
      this.insightsService.trackEvent('Files limit reached', { files: this.tempDocs.length });
      Swal.fire(this.translate.instant("messages.errorFilesLimit"), '', "warning");
      this.tempDocs = [];
      return;
    }
    if (index < this.tempDocs.length) {
      const formData = new FormData();
      formData.append("thumbnail", this.tempDocs[index].dataFile.event);
      formData.append("url", this.tempDocs[index].dataFile.url);
      formData.append("containerName", this.containerName);
      formData.append("userId", this.authService.getIdUser());
      formData.append("medicalLevel", this.medicalLevel);
      formData.append("preferredResponseLanguage", this.preferredResponseLanguage);
      this.sendFile(formData, index).then(() => {
        // Una vez que se envía el archivo actual, procesa el siguiente.
        this.processFilesSequentially(index + 1);
      }).catch((error) => {
        console.error("Error uploading file:", error);
        this.tempDocs[index].state = 'failed';
        this.addMessage({
          text: 'The document ' + this.tempDocs[index].dataFile.name + ' ' + this.tempDocs[index].state,
          isUser: false
        });
      });
    } else {
      this.allFilesUploaded();
    }
  }

  allFilesUploaded() {
    this.hideTextArea();
    console.log("Todos los archivos han sido subidos correctamente.");
    this.tempDocs = [];
    //delete the patientSummary
    this.subscription.add(this.http.delete(environment.api + '/api/deletesummary/' + this.currentPatient)
      .subscribe((resDocs: any) => {
        console.log(resDocs)
      }, (err) => {
        console.log(err);
      }));
    this.getDocs();
  }

  openFileInput(fileInput: any): void {
    fileInput.click();
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

  prepareFile(index) {
    if (this.tempDocs[index].dataFile.url == undefined) {
      console.log('invalid')
      this.tempDocs[index].state = 'invalid';
      return;
    }
    if (this.authGuard.testtoken()) {
      this.onFileChangeStep2(index);
    } else {
      console.log('no token')
      this.tempDocs[index].state = 'invalid';
    }
  }

  onFileChangeStep2(index) {
    this.tempDocs[index].state = 'uploading';
    const formData = new FormData();
    formData.append("thumbnail", this.tempDocs[index].dataFile.event);
    formData.append("url", this.tempDocs[index].dataFile.url);
    formData.append("containerName", this.containerName);
    formData.append("userId", this.authService.getIdUser());
    formData.append("medicalLevel", this.medicalLevel);
    formData.append("preferredResponseLanguage", this.preferredResponseLanguage);
    this.sendFile(formData, index);
  }

  sendFile(formData, indextempDoc): Promise<any> {
    return new Promise((resolve, reject) => {
      var fileInfo = { name: this.tempDocs[indextempDoc].dataFile.event.name, docId: null }
      //if this.messages have file type, delete this.addMessage({ file: 'new file'});
      var foundElement = this.searchService.search(this.messages, 'file', 'new file');
      if (foundElement) {
        var index = this.messages.indexOf(foundElement);
        this.messages.splice(index, 1);
        //and delete de previous message
        this.messages.splice(index, 1);
      }
      this.subscription.add(this.http.post(environment.api + '/api/upload/' + this.currentPatient, formData)
        .subscribe((res: any) => {
          if (res.message == 'Done' && res.docId) {
            //send broadcast to wait signalR
            fileInfo.docId = res.docId;
            this.eventsService.broadcast('tasksUpload', fileInfo);
          }
          this.tempDocs[indextempDoc].state = 'done';
          resolve(res);
        }, (err) => {
          this.tempDocs[indextempDoc].state = 'failed';
          console.log(err);
          reject(err);
          this.insightsService.trackException(err);
          if (err.error.message == 'Token expired' || err.error.message == 'Invalid Token') {
            this.authGuard.testtoken();
          } else {
            var msgFail = this.translate.instant("generics.Data saved fail");
            if (err.error.message) {
              this.toastr.error(err.error.message, msgFail);
            } else {
              this.toastr.error('', msgFail);
            }

          }
        }));
    });


  }

  showTextArea() {
    this.showTextAreaFlag = true;
  }

  hideTextArea() {
    this.showTextAreaFlag = false;
  }


  async closeModal() {

    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    /*await this.delay(1000);
    this.actualDoc = undefined;*/
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  changeAllergies(value) {
    this.notallergy = value;
  }

  onChatInputKeydown(event: KeyboardEvent) {
    // Si se presiona Enter sin Shift, enviar el mensaje
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevenir el salto de línea
      this.sendMessage();
    }
    // Si se presiona Shift+Enter, permitir el salto de línea (comportamiento por defecto)
  }

  sendMessage() {
    // Limpiar espacios en blanco y saltos de línea al inicio y final
    const trimmedMessage = this.message ? this.message.trim() : '';
    
    if (!trimmedMessage) {
      Swal.fire(this.translate.instant("generics.Please write a message"), '', "warning");
      return;
    }
    if (this.callingOpenai) {
      Swal.fire(this.translate.instant("generics.Please wait"), '', "warning");
      return;
    }

    // Guardar el mensaje antes de limpiarlo
    const messageToSend = trimmedMessage;
    
    this.addMessage({
      text: messageToSend,
      isUser: true
    });
    this.suggestions = [];
    this.message = ''; // Limpiar el textarea después de enviar
    
    // Pasar el mensaje guardado a detectIntent
    this.tempInput = messageToSend;
    this.detectIntent(messageToSend);
  }

  selectCustomSuggestion(suggestion) {
    this.closeModal();
    //this.message = suggestion;
    this.message = this.getLiteral(suggestion);
    this.sendMessage();
  }

  selectSummaryType(suggestion) {
    this.closeModal();
    //this.message = suggestion;
    this.message = this.getLiteral(suggestion);
    this.sendMessage();
  }


  selectOptionSuggestion(suggestion) {
    this.closeModal();
    let suggestionText = this.getLiteral(suggestion);
    if (this.newSuggestions.includes(suggestionText)) {
      this.usedNewSuggestions.push(suggestionText);
    }
    this.message = suggestionText;
  }

  selectSuggestion(suggestion) {
    this.closeModal();

    // If a new suggestion is selected, mark it as "used"
    if (this.newSuggestions.includes(suggestion)) {
      this.usedNewSuggestions.push(suggestion);
    }
    // Use a regular expression to check if the suggestion is a template
    const regex = /`[^`]*`/g;

    if (regex.test(suggestion)) {
      // If it's a template, put it in the input text box
      this.message = suggestion;
    } else {
      // If it's not a template, send the message directly
      this.message = suggestion;
      this.sendMessage();
    }
  }

  detectIntent(msg?: string) {
    // Protección adicional: evitar múltiples llamadas simultáneas
    if (this.callingOpenai) {
      console.warn('detectIntent: Ya hay una llamada en curso, ignorando esta solicitud');
      return;
    }
    
    // Usar el mensaje pasado como parámetro, o this.message como fallback
    const messageToProcess = msg || this.message || this.tempInput;
    
    if (!messageToProcess || messageToProcess.trim() === '') {
      console.error('detectIntent: No hay mensaje para procesar!');
      return;
    }
    
    this.proposedEvents = [];
    this.actualStatus = this.translate.instant('navigator.processing') || 'Procesando...';
    this.statusChange();

    // La detección de idioma y traducción ahora se hace en el backend
    // Simplemente llamar directamente a continueSendIntent con el mensaje original
    // continueSendIntent establecerá callingOpenai = true
    this.tempInput = messageToProcess;
    this.continueSendIntent(messageToProcess);
  }

  private initializeContext() {
    // Initialize context with default values if it's empty
    console.warn('Initializing context:' + this.metadata);
    this.context = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "assistant", content: JSON.stringify(this.metadata) }
    ];
  }

  continueSendIntent(msg) {
    // Protección adicional: evitar múltiples llamadas simultáneas a callnavigator
    // Usar verificación síncrona inmediata para evitar condiciones de carrera
    if (this.callingOpenai) {
      console.warn('continueSendIntent: Ya hay una llamada en curso, ignorando esta solicitud. Mensaje:', msg?.substring(0, 50));
      return;
    }
    
    // Verificar si ya hay una llamada pendiente con el mismo mensaje (protección contra duplicados)
    const msgHash = msg ? msg.substring(0, 50).replace(/\s+/g, '') : '';
    const lastCallKey = `lastCall_${msgHash}`;
    const lastCallTime = (this as any)[lastCallKey];
    const now = Date.now();
    
    if (lastCallTime && (now - lastCallTime) < 5000) { // 5 segundos de protección
      console.warn(`continueSendIntent: Llamada duplicada detectada (última llamada hace ${Math.round((now - lastCallTime) / 1000)}s), ignorando. Mensaje:`, msg?.substring(0, 50));
      return;
    }
    
    // Guardar el tiempo de esta llamada
    (this as any)[lastCallKey] = now;
    
    // Marcar que estamos haciendo una llamada INMEDIATAMENTE para evitar condiciones de carrera
    this.callingOpenai = true;
    console.log('continueSendIntent: Iniciando llamada a callnavigator. Mensaje:', msg?.substring(0, 50));
    
    console.log('Context before call:', this.context);
    // Ensure context is not empty
    if (!this.context || this.context.length === 0) {
      console.warn('Context is empty, initializing with default values');
      this.initializeContext();
    }

    let docsSelected = this.docs.filter(doc => doc.selected && (doc.status == 'finished' || doc.status == 'done' || doc.status == 'resumen ready')).map(doc => doc.url);
    console.log(docsSelected)
    
    // Generar un ID único para esta llamada para rastrear llamadas duplicadas
    const callId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`[${callId}] continueSendIntent: Preparando llamada HTTP a callnavigator`);
    
    // Mostrar aviso si el paciente no tiene país configurado (solo una vez por sesión)
    if (!this.hasShownCountryWarning && this.actualPatient && !this.actualPatient.country) {
      this.hasShownCountryWarning = true;
      this.toastr.info(
        this.translate.instant('messages.countryNotConfiguredDesc') || 'Puedes añadirlo desde la lista de pacientes para obtener respuestas más contextualizadas.',
        this.translate.instant('messages.countryNotConfigured') || 'País no configurado',
        { timeOut: 8000, positionClass: 'toast-bottom-right' }
      );
    }
    
    var query = { "question": msg, "context": this.context, "containerName": this.containerName, "index": this.currentPatient, "userId": this.authService.getIdUser(), "docs": docsSelected, "detectedLang": this.detectedLang, "chatMode": this.chatMode };
    this.subscription.add(this.http.post(environment.api + '/api/callnavigator/'+this.authService.getCurrentPatient().sub, query)
      .subscribe(async (res: any) => {
        console.log(`[${callId}] continueSendIntent: Respuesta HTTP recibida:`, res.action);
        if (res.action == 'Data') {

        } else if (res.action == 'Question') {
          // Respuesta HTTP antigua - ignorar, la respuesta real viene por WebPubSub
          // No hacer nada aquí para evitar respuestas duplicadas
          console.warn(`[${callId}] continueSendIntent: Recibida respuesta HTTP antigua (Question), ignorando. La respuesta real viene por WebPubSub`);
        } else if (res.action == 'Processing') {
          // Respuesta HTTP indicando que se procesará por WebPubSub
          // No hacer nada, esperar la respuesta por WebPubSub
          console.log(`[${callId}] continueSendIntent: Respuesta HTTP Processing recibida, esperando respuesta por WebPubSub`);
        } else if (res.action == 'Share') {
          this.message = '';
          this.addMessage({
            text: this.translate.instant("messages.The sharing panel has been displayed"),
            isUser: false
          });
          this.share(this.contentshareCustom, 'Custom')
          this.callingOpenai = false;
        } else if (res.action == 'Quiz') {
          this.message = '';
          this.addMessage({
            text: 'Show Form to take quiz',
            isUser: false
          });
          this.callingOpenai = false;
        } else if (res.action == 'Document') {
          this.message = '';
          this.addMessage({ file: 'new file' });
          this.callingOpenai = false;
        } else if (res.action == 'Contact') {
          this.message = '';
          this.addMessage({
            text: 'Show Form contact',
            isUser: false
          });
          this.share(this.contentshareCustom, 'Custom')
          this.callingOpenai = false;
        } else {
          //this.message = '';
          /*this.addMessage({
            text: '<strong>'+this.translate.instant("generics.error try again")+'</strong>',
            isUser: false
          });*/
          //this.toastr.error('', this.translate.instant("generics.error try again"));
          this.callingOpenai = false;
        }

      }, (err) => {
        this.callingOpenai = false;
        console.error(`[${callId}] Error en continueSendIntent:`, err);
        this.insightsService.trackException(err);
        
        // Si es un error CORS o de red, no mostrar mensaje de error al usuario
        // ya que puede ser una llamada duplicada que se canceló
        if (err.status === 0 || err.status === null) {
          console.warn(`[${callId}] Error de red/CORS detectado, probablemente llamada duplicada cancelada. Ignorando.`);
          return;
        }
        
        //this.message = '';
        this.addMessage({
          text: '<strong>' + this.translate.instant("generics.error try again") + '</strong>',
          isUser: false
        });
        /*this.addMessage({
          text: '<strong>'+this.translate.instant("generics.error try again")+'</strong> <span class="d-block">'+err.message+'</span>',
          isUser: false
        });*/
        //this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  private translateAnomalies(anomalies): Promise<string> {
    return new Promise((resolve, reject) => {
      let anomaliesList = anomalies.map(anomaly => anomaly.anomaly);
      console.log(this.translate.currentLang);
      if (this.translate.currentLang != 'en') {
        let jsontestLangText = anomaliesList.map(text => ({ "Text": text }));

        this.subscription.add(this.apiDx29ServerService.getTranslationInvert(this.translate.currentLang, jsontestLangText)
          .subscribe((res2: any) => {
            if (res2[0] != undefined) {
              for (let i = 0; i < res2.length; i++) {
                if (res2[i].translations[0] != undefined) {
                  anomaliesList[i] = res2[i].translations[0].text;
                }
              }
              console.log(anomaliesList);
            }
            let anomaliesTranslated = anomaliesList.map(anomaly => `<br>${anomaly}`).join('');
            resolve(anomaliesTranslated);
          }, (err) => {
            console.log(err);
            this.insightsService.trackException(err);
            let anomaliesTranslated = anomaliesList.map(anomaly => `<br>${anomaly}`).join('');
            resolve(anomaliesTranslated);
          }));
      } else {
        let anomaliesTranslated = anomaliesList.map(anomaly => `<br>${anomaly}`).join('');
        resolve(anomaliesTranslated);
      }
    });
  }

  /**
   * Asigna las sugerencias directamente (ya vienen traducidas del backend)
   */
  setSuggestions(suggestions: string[]) {
    this.suggestions = suggestions || [];
    this.gettingSuggestions = false;
  }

  /**
   * Asigna las sugerencias (ya vienen traducidas del backend)
   */
  translateSuggestions(info, hardcodedSuggestion = undefined) {
    // El backend ahora devuelve las sugerencias ya traducidas
    this.suggestions = info || [];
    this.gettingSuggestions = false;
  }


  shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length;
    let temporaryValue: T;
    let randomIndex: number;

    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  getNewSuggestions() {
    // Filter out used new suggestions
    let unusedNewSuggestions = this.newSuggestions.filter(suggestion => !this.usedNewSuggestions.includes(suggestion));

    if (unusedNewSuggestions.length === 0) {
      throw new Error("All new suggestions have been used");
    }
    this.shuffle(unusedNewSuggestions);

    // After shuffling, return the last element
    let selectedSuggestion = unusedNewSuggestions.pop();

    return selectedSuggestion;
  }

  getSuggestions() {
    if (this.suggestions_pool.length === 0) {
      throw new Error("All suggestions have been used");
    }

    this.shuffle(this.suggestions_pool);

    // After shuffling, pop the last element which will remove it from the array
    let selectedSuggestion = this.suggestions_pool.pop();

    return selectedSuggestion;
  }

  getAllSuggestions(numOfSuggestions) {
    // Get 4 random suggestions from the pool except the summary suggestion are ready generated
    if (this.suggestionFromSummary.length > 0) {
      this.suggestions = this.suggestionFromSummary;
      this.suggestionFromSummary = []; // Doubt
      return this.suggestions;
    } else {
      let suggestions = [];
      this.numOfSuggestions = numOfSuggestions;
      for (let i = 0; i < this.numOfSuggestions; i++) {
        suggestions.push(this.getSuggestions());
      }
      return suggestions;
    }
  }

  getSuggestionsFromSummary(docId) {
    var info = { containerName: this.containerName }
    this.subscription.add(this.http.post(environment.api + '/api/summarysuggest/'+this.authService.getCurrentPatient().sub + '/' + docId, info)
      .subscribe(async (res: any) => {
        if (res.suggestions.length > 0) {
          this.suggestionFromSummary = await this.translateSuggestionsFromSummary(res.suggestions);
        }
        this.suggestions = this.getAllSuggestions(4);
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  async translateSuggestionsFromSummary(info, hardcodedSuggestion = undefined) {
    if (this.detectedLang !== 'en') {
      const jsontestLangText = info
        .filter(suggestion => suggestion !== hardcodedSuggestion)
        .map(suggestion => ({ "Text": suggestion }));

      try {
        const res2: any = await this.apiDx29ServerService.getTranslationInvert(this.detectedLang, jsontestLangText).toPromise();
        if (res2[0] !== undefined) {
          for (let i = 0; i < res2.length; i++) {
            if (res2[i].translations[0] !== undefined && info[i] !== hardcodedSuggestion) {
              info[i] = res2[i].translations[0].text;
            }
          }
        }
      } catch (err) {
        console.log(err);
        this.insightsService.trackException(err);
      }
    }
    return info;
  }

  /**
   * Muestra el mensaje de respuesta del asistente
   * El backend ahora envía el mensaje ya traducido y lo guarda en la BD
   */
  async translateInverse(msg): Promise<string> {
    return new Promise((resolve, reject) => {
      // El backend ahora traduce y guarda, solo necesitamos mostrar el mensaje
      this.addMessage({
        text: msg,
        isUser: false
      });
      this.callingOpenai = false;
      // Ya no llamamos a saveMessages porque el backend ya guarda
      resolve('ok');
    });
  }

  showForm(info) {
    if (this.detectedLang != 'en') {


      var textToExtract = info.name;
      var jsontestLangText = [{ "Text": textToExtract }]
      this.subscription.add(this.apiDx29ServerService.getDeepLTranslationInvert(this.detectedLang, jsontestLangText)
        .subscribe((res2: any) => {
          if (res2.text != undefined) {
            info.name = res2.text;
          }
          this.addFormEvent(info);
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          this.addFormEvent(info);
        }));

      /*var textToExtract = info.name;

      var jsontestLangText = [{ "Text": textToExtract }]
      this.subscription.add(this.apiDx29ServerService.getTranslationInvert(this.detectedLang, jsontestLangText)
        .subscribe((res2: any) => {
          if (res2[0] != undefined) {
            if (res2[0].translations[0] != undefined) {
              info.name = res2[0].translations[0].text;
            }
          }
          this.addFormEvent(info);

        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          this.addFormEvent(info);

        }));*/


    } else {
      this.addFormEvent(info);
    }
  }

  addFormEvent(info) {
    Swal.close();
    //this.eventsForm.reset();
    this.eventsForm = this.formBuilder.group({
      name: ['', Validators.required],
      date: [new Date()],
      dateEnd: [null],
      timeHour: [''],
      timeMinute: [''],
      timePeriod: ['AM'],
      key: [''],
      notes: []
    });
    //if no date, set today
    if (!info.date) {
      info.date = new Date();
    }
    // Extract time from date if it exists and is not midnight
    if (info.date) {
      const dateObj = new Date(info.date);
      const hours24 = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      if (hours24 !== 0 || minutes !== 0) {
        const period = hours24 >= 12 ? 'PM' : 'AM';
        let hours12 = hours24 % 12;
        if (hours12 === 0) hours12 = 12;
        info.timeHour = hours12;
        info.timeMinute = minutes;
        info.timePeriod = period;
      }
    }
    // Show time field for appointments and reminders, or if time already set
    this.showTimeField = info.key === 'appointment' || info.key === 'reminder' || !!info.timeHour;
    //info.date = this.dateService.transformDate(new Date());
    this.eventsForm.patchValue(info);
    this.showProposedEvents();
    this.callingTextAnalytics = false;
    this.callingOpenai = false;
  }

  get date() {
    //return this.seizuresForm.get('date').value;
    let minDate = new Date(this.eventsForm.get('date').value);
    return minDate;
  }

  saveData(checkForm, loadEvents) {
    return new Promise((resolve, reject) => {
      if (checkForm) {
        if (this.eventsForm.invalid) {
          return;
        }
      }
      var actualIndex = 0;
      this.proposedEvents.forEach((element, index) => {
        if (element.name == this.eventsForm.value.name) {
          this.proposedEvents[index].saving = true;
          actualIndex = index;
        }
      });

      this.submitted = true;

      // Combine date and time if time is set
      if (this.eventsForm.value.date != null) {
        let dateObj = new Date(this.eventsForm.value.date);
        const hasTime = this.eventsForm.value.timeHour && this.eventsForm.value.timeHour !== '';
        if (hasTime) {
          let hours = parseInt(this.eventsForm.value.timeHour, 10);
          const minutes = parseInt(this.eventsForm.value.timeMinute || '0', 10);
          const period = this.eventsForm.value.timePeriod || 'AM';
          // Convert 12h to 24h format
          if (period === 'PM' && hours !== 12) {
            hours += 12;
          } else if (period === 'AM' && hours === 12) {
            hours = 0;
          }
          dateObj.setHours(hours, minutes, 0, 0);
          // Use transformDateTime to include the time in the output
          this.eventsForm.value.date = this.dateService.transformDateTime(dateObj);
        } else {
          this.eventsForm.value.date = this.dateService.transformDate(dateObj);
        }
      }
      if (this.eventsForm.value.dateEnd != null) {
        this.eventsForm.value.dateEnd = this.dateService.transformDate(this.eventsForm.value.dateEnd);
      }
      // Remove time fields before sending to API (they're already merged into date)
      delete this.eventsForm.value.timeHour;
      delete this.eventsForm.value.timeMinute;
      delete this.eventsForm.value.timePeriod;

      if (this.authGuard.testtoken()) {
        this.saving = true;
        const userId = this.authService.getIdUser();
        this.subscription.add(this.http.post(environment.api + '/api/events/' + this.currentPatient + '/' + userId, this.eventsForm.value)
          .subscribe(async (res: any) => {
            this.saving = false;
            this.proposedEvents.splice(actualIndex, 1);


            if (this.modalReference != null) {
              this.modalReference.close();
            }
            this.submitted = false;
            if (loadEvents) {
              let newMsg = this.translate.instant('home.botmsg3') + ': ' + this.eventsForm.value.name;
              this.addMessage({
                text: newMsg,
                isUser: false
              });
              if (this.proposedEvents.length == 0 && this.suggestions.length == 0) {
                this.suggestions = this.getAllSuggestions(4);
              }
              this.loadEnvironmentMydata();
            }
            resolve(true);
          }, (err) => {
            this.proposedEvents[actualIndex].saving = false;
            this.submitted = false;
            console.log(err);
            this.insightsService.trackException(err);
            this.saving = false;
            if (err.error.message == 'Token expired' || err.error.message == 'Invalid Token') {
              this.authGuard.testtoken();
            } else {
            }
            reject(err);
          }));
      }
    });
  }

  cancelData() {
    this.submitted = false;
    this.showTimeField = false;
    if (this.modalReference != null) {
      this.modalReference.close();
    }
    this.suggestions = this.getAllSuggestions(4);
  }

  getTranslatedCategoryTag(tag: string): string {
    let key = 'categoryTags.' + tag;
    return this.translate.instant(key)
  }

  getBadgeClass(tag: string): string {
    switch (tag) {
      case 'Clinical History':
        return 'badge-soft-blue'; // Azul pastel
      case 'Laboratory Report':
        return 'badge-soft-cyan'; // Cyan suave
      case 'Hospital Discharge Note':
        return 'badge-soft-green'; // Verde suave
      case 'Evolution and Consultation Note':
        return 'badge-soft-purple'; // Morado suave
      case 'Medical Prescription':
        return 'badge-soft-orange'; // Naranja suave
      case 'Surgery Report':
        return 'badge-soft-teal'; // Verde azulado suave
      case 'Imaging Study':
        return 'badge-soft-gray'; // Gris suave
      case 'Other':
        return 'badge-soft-slate'; // Gris oscuro suave
      default:
        return 'badge-soft-blue';
    }
  }

  openResults(doc, contentSummaryDoc) {
    if (doc == undefined) {
      //informar que el doc no existe en un toast
      this.toastr.error('', this.translate.instant('messages.nofileexist'));
      return;
    }
    this.openingResults = true;
    var fileName = 'summary.txt';
    if (this.translate.currentLang == 'en') {
      fileName = 'summary_translated.txt';
    }
    this.actualDoc = doc;
    this.eventsDoc = [];
    var url = doc.url.substr(0, doc.url.lastIndexOf('/') + 1)
    var fileUrl = url + fileName;
    this.subscription.add(this.http.get(this.accessToken.blobAccountUrl + this.accessToken.containerName + '/' + fileUrl + this.accessToken.sasToken, { responseType: 'text' })
      .subscribe((res: any) => {
        //this.resultText = res.replace(/\n/g, '<br>');
        res = res.replace(/^```html\n|\n```$/g, '');
        res = res.replace(/^"\n|\n"$/g, '');
        res = res.replace(/\\n\\n/g, '');
        res = res.replace(/\n/g, '');
        res = res.replace(/\\n/g, '')
        this.summaryDoc = res;
        //this.resultText = res;
        let documentsToCheck = [this.actualDoc];
        //this.checkIfNeedFeedback(contentSummaryDoc, documentsToCheck, 'individual')
        this.showContent(contentSummaryDoc);
        this.loadEventFromDoc(doc);
      }, (err) => {
        this.openingResults = false;
        console.log(err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant('messages.msgError'));
      }));
  }

  async showContent(contentSummaryDoc) {
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg' // xl, lg, sm
    };
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    this.selectedIndexTab = 0;
    this.modalReference = this.modalService.open(contentSummaryDoc, ngbModalOptions);
    await this.delay(200)
    document.getElementById('contentHeader').scrollIntoView(true);

    // CLOSE SWAL MSG
    Swal.close();
  }

  checkIfNeedFeedback(contentSummaryDoc, documentsToCheck, type) {
    this.subscription.add(this.http.post(environment.api + '/api/generalfeedback/get/' + this.authService.getCurrentPatient().sub, documentsToCheck)
      .subscribe((res: any) => {
        this.openingResults = false;
        this.checkFeedback(res, contentSummaryDoc, documentsToCheck, type);
      }, (err) => {
        this.openingResults = false;
        this.insightsService.trackException(err);
        console.log(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  async checkFeedback(response: any, contentSummaryDoc, documentsToCheck, type) {
    const currentVersion = environment.version + ' - ' + environment.subversion;

    this.needFeedback = true; // reset to true before checking

    // Procesar feedbacks individuales
    if (type === 'individual') {
      const individualFeedbacks = response.individualFeedbacks.filter(feedback => feedback.version.startsWith(environment.version));
      for (let feedback of individualFeedbacks) {
        for (let doc of feedback.documents) {
          if (documentsToCheck.some(d => d._id === doc._id)) {
            this.needFeedback = false;
            break;
          }
        }
        if (!this.needFeedback) break; // If found for individual, exit loop
      }
    }

    // Procesar feedback general
    if (type === 'general' && response.generalFeedback && response.generalFeedback.version.startsWith(environment.version)) {
      const feedbackDocIds = response.generalFeedback.documents.map(fd => fd._id);
      const docIds = documentsToCheck.map(d => d._id);
      const allDocumentsPresent = feedbackDocIds.every(fdId => docIds.includes(fdId));
      if (allDocumentsPresent) {
        this.needFeedback = false;
      }
    }

    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg' // xl, lg, sm
    };
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    this.selectedIndexTab = 0;
    this.modalReference = this.modalService.open(contentSummaryDoc, ngbModalOptions);
    await this.delay(200)
    document.getElementById('contentHeader').scrollIntoView(true);

    // CLOSE SWAL MSG
    Swal.close();
  }

  loadEventFromDoc(doc) {
    this.eventsDoc = [];
    let info = { 'docId': doc._id };
    this.subscription.add(this.patientService.getEventsFromDoc(this.currentPatient, info)
      .subscribe((res: any) => {
        this.eventsDoc = res;
        console.log(this.eventsDoc)
      }, (err) => {
        console.log(err);
      }));
  }

  updateEventStatus(event, status: string) {
    event.status = status;
    console.log(`Event ${event._id} status updated to ${status}`);
    this.subscription.add(this.patientService.updateEventFromDoc(event._id, status)
      .subscribe((res: any) => {
        console.log(res)
        this.loadEnvironmentMydata();
      }, (err) => {
        console.log(err);
      }));
  }

  openAnonymizedResults(doc, contentviewDoc, type) {
    this.loadingDoc = true;
    //get doc
    this.subscription.add(this.http.get(environment.api + '/api/document/' + this.authService.getCurrentPatient().sub + '/' + doc._id)
      .subscribe((res: any) => {
        if (!res.message) {
          doc = res;
          if (doc.anonymized == 'true') {
            this.actualDoc = doc;
            var url = doc.url.substr(0, doc.url.lastIndexOf('/') + 1)
            var fileNameNcr = url + type;
            this.subscription.add(this.http.get(this.accessToken.blobAccountUrl + this.accessToken.containerName + '/' + fileNameNcr + this.accessToken.sasToken, { responseType: 'text' })
              .subscribe((res: any) => {
                let parts = res.split(/(\[ANON-\d+\])/g);
                for (let i = 0; i < parts.length; i++) {
                  if (/\[ANON-\d+\]/.test(parts[i])) {
                    let length = parseInt(parts[i].match(/\d+/)[0]);
                    let blackSpan = '<span style="background-color: black; display: inline-block; width:' + length + 'em;">&nbsp;</span>';
                    parts[i] = blackSpan;
                  }
                }
                let finalTxt = parts.join('');
                this.resultText = finalTxt;
                this.resultText = this.resultText.replace(/\n/g, '<br>');
                //this.resultText = res;
                let ngbModalOptions: NgbModalOptions = {
                  keyboard: false,
                  windowClass: 'ModalClass-sm' // xl, lg, sm
                };
                if (this.modalReference != undefined) {
                  this.modalReference.close();
                  this.modalReference = undefined;
                }
                this.modalReference = this.modalService.open(contentviewDoc, ngbModalOptions);
              }, (err) => {
                console.log(err);
                this.insightsService.trackException(err);
                this.toastr.error('', this.translate.instant('messages.msgError'));
              }));
          } else if (doc.anonymized == 'inProcess') {
            var msg1 = this.translate.instant("messages.m5.4")
            Swal.fire('', msg1, "info");
          } else {
            //doc.anonymized=='false'
            var msg1 = this.translate.instant("messages.m5.4")
            Swal.fire('', msg1, "info");
            //anonymizeDocument
            this.anonymizeDocument(doc);
          }
        }
        this.loadingDoc = false;
      }, (err) => {
        this.loadingDoc = false;
        console.log(err);
        this.insightsService.trackException(err);
      }));



  }

  anonymizeDocument(doc) {
    var info = { 'docId': doc._id };
    this.subscription.add(this.http.post(environment.api + '/api/anonymizedocument/' + this.currentPatient, info)
      .subscribe((res: any) => {
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  openResultsInChat(doc, type) {
    this.actualDoc = doc;
    var url = doc.url.substr(0, doc.url.lastIndexOf('/') + 1)
    var fileNameNcr = url + type;
    this.subscription.add(this.http.get(this.accessToken.blobAccountUrl + this.accessToken.containerName + '/' + fileNameNcr + this.accessToken.sasToken, { responseType: 'text' })
      .subscribe((res: any) => {
        this.resultText = res.replace(/\n/g, '<br>');
        this.addMessage({
          text: '<strong>Resumen:</strong>' + this.resultText,
          isUser: false
        });
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
      }));
  }



  async startDonating() {
    this.isDonating = true;
    this.changingDonation = true;
    this.changeDonation(true);
  }

  async stopDonating() {
    this.isDonating = false;
    this.changingDonation = true;
    this.changeDonation(false);
  }


  getStateDonation() {
    this.subscription.add(this.http.get(environment.api + '/api/patient/donation/' + this.currentPatient)
      .subscribe((res: any) => {
        this.isDonating = res.donation;
        this.changingDonation = false;
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
        this.changingDonation = false;
      }));
  }

  changeDonation(state) {
    var info = { 'donation': state };
    this.subscription.add(this.http.put(environment.api + '/api/patient/donation/' + this.currentPatient, info)
      .subscribe((res: any) => {
        if (res.documents) {
          let numDocs = res.documents;
          var msg1 = this.translate.instant("messages.m5.3", {
            value: numDocs
          })
          Swal.fire('', msg1, "info");
        }
        this.isDonating = state;
        this.changingDonation = false;
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
        this.isDonating = !state;
        this.changingDonation = false;
      }));
  }

  getPatientSummary(regenerate) {
    this.openingSummary = true;
    this.checkDocs().then((proceed) => {
      if (!proceed) {
        this.openingSummary = false;
        return; // No continuar si hay documentos con estado != 'Done'
      }

      if (this.modalReference != undefined) {
        this.modalReference.close();
        this.modalReference = undefined;
      }
      this.haveInfo = false;
      let info = { "userId": this.authService.getIdUser(), "idWebpubsub": this.authService.getIdUser(), "regenerate": regenerate };
      this.subscription.add(this.http.post(environment.api + '/api/patient/summary/' + this.currentPatient, info)
        .subscribe((res: any) => {
          if (res.summary == 'The patient does not have any information') {
            this.toastr.info('', this.translate.instant("generics.The patient does not have any information yet"));
            this.haveInfo = false;
            this.openingSummary = false;
          } else {
            this.haveInfo = true;
            if (res.summary == 'true') {
              this.getPatientSummaryFile();
              this.summaryDate = res.summaryDate;
            } else {
              this.openingSummary = false;
              // doc.anonymized == 'false'
              var msg1 = this.translate.instant("messages.m6.3")
              Swal.fire('', msg1, "info");
            }
          }
        }, (err) => {
          this.openingSummary = false;
          console.log(err);
          this.insightsService.trackException(err);
          this.toastr.error('', this.translate.instant("generics.error try again"));
        }));
    });
  }

  private lastInfographicRequestTime = 0;
  
  getPatientInfographic(regenerate: boolean = false) {
    // Protección contra doble click - verificar si ya está generando
    if (this.generatingInfographic) {
      console.log('[Infographic] Already generating, ignoring duplicate request');
      return;
    }
    
    // Debounce: ignorar peticiones muy cercanas (menos de 2 segundos)
    const now = Date.now();
    if (now - this.lastInfographicRequestTime < 2000) {
      console.log('[Infographic] Request too soon after previous, ignoring (debounce)');
      return;
    }
    this.lastInfographicRequestTime = now;
    
    this.generatingInfographic = true;
    console.log('[Infographic] Starting request, regenerate:', regenerate);
    const info = { 
      userId: this.authService.getIdUser(),
      lang: this.preferredResponseLanguage || localStorage.getItem('lang') || 'en',
      regenerate: regenerate
    };
    
    // Timeout extendido para generación de imágenes (3 minutos)
    this.subscription.add(this.http.post(environment.api + '/api/ai/infographic/' + this.currentPatient, info)
      .pipe(timeout(180000))
      .subscribe((res: any) => {
        this.generatingInfographic = false;
        console.log('[Infographic] Response received:', res);
        
        if (res.success && (res.imageUrl || res.imageData)) {
          // Determinar la fuente de la imagen (URL o base64)
          const imageSrc = res.imageUrl || `data:${res.mimeType || 'image/png'};base64,${res.imageData}`;
          this.infographicImageData = res.imageData || null;
          
          // Formatear la fecha de generación
          let dateInfo = '';
          if (res.generatedAt) {
            const genDate = new Date(res.generatedAt);
            dateInfo = `<p style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">
              ${this.translate.instant('infographic.generatedOn')}: ${genDate.toLocaleDateString()} ${genDate.toLocaleTimeString()}
              ${res.cached ? `<span style="color: #28a745; margin-left: 8px;">(${this.translate.instant('infographic.cached')})</span>` : ''}
            </p>`;
          }
          
          // Aviso si es infografía básica (sin resumen completo del paciente)
          let basicWarning = '';
          if (res.isBasic) {
            basicWarning = `<p style="font-size: 0.85rem; color: #856404; background-color: #fff3cd; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; border: 1px solid #ffeeba;">
              <i class="fa fa-info-circle" style="margin-right: 6px;"></i>
              ${this.translate.instant('infographic.basicWarning')}
            </p>`;
          }
          
          Swal.fire({
            title: this.translate.instant('infographic.title'),
            html: `${dateInfo}${basicWarning}
                   <img src="${imageSrc}" 
                   style="display: block; margin: 0 auto; max-width: 100%; max-height: 65vh; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" 
                   alt="Patient Infographic"/>`,
            width: '90%',
            showCloseButton: true,
            showConfirmButton: true,
            confirmButtonText: this.translate.instant('infographic.download'),
            showCancelButton: true,
            cancelButtonText: this.translate.instant('generics.Close'),
            showDenyButton: true,
            denyButtonText: this.translate.instant('infographic.regenerate'),
            denyButtonColor: '#6c757d',
          }).then((result) => {
            if (result.isConfirmed) {
              // Descargar la imagen
              const link = document.createElement('a');
              link.href = imageSrc;
              link.download = `patient_infographic_${Date.now()}.png`;
              link.target = '_blank';
              link.click();
            } else if (result.isDenied) {
              // Regenerar la infografía
              this.getPatientInfographic(true);
            }
          });
        } else {
          this.toastr.error('', res.error || this.translate.instant('infographic.error'));
        }
      }, (err) => {
        console.log('[Infographic] Error:', err);
        
        // Si es 429 (Too Many Requests), la generación está en progreso - esperar
        if (err.status === 429) {
          console.log('[Infographic] Generation in progress, waiting...');
          // No resetear generatingInfographic, dejar que la otra petición termine
          // Mostrar mensaje informativo en lugar de error
          this.toastr.info('', this.translate.instant('infographic.inProgress') || 'Generation in progress, please wait...');
          return;
        }
        
        this.generatingInfographic = false;
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  checkDocs(): Promise<boolean> {
    return new Promise((resolve) => {
      this.subscription.add(this.patientService.getDocuments()
        .subscribe((resDocs: any) => {
          console.log(resDocs)
          if (resDocs.message || resDocs.length == 0) {
            Swal.fire({
              title: this.translate.instant("summary.No documents uploaded"),
              text: this.translate.instant("summary.NoDocsRecommendation"),
              icon: 'info',
              showCancelButton: true,
              confirmButtonText: this.translate.instant("summary.Yes, continue"),
              cancelButtonText: this.translate.instant("summary.No, cancel")
            }).then((result) => {
              if (result.isConfirmed) {
                resolve(true); // El usuario decidió continuar sin documentos
              } else {
                this.toastr.error('', this.translate.instant("summary.Process cancelled"));
                resolve(false); // El usuario decidió cancelar
              }
            });
            return; // Salir del método después de mostrar el Swal
            //resolve(true); // No hay documentos para verificar
          } else {
            resDocs.sort(this.sortService.DateSortInver("date"));

            for (var i = 0; i < resDocs.length; i++) {
              const fileName = resDocs[i].url.split("/").pop();
              resDocs[i].title = fileName;
              if (resDocs[i].categoryTag) {
                resDocs[i].badge = this.getBadgeClass(resDocs[i].categoryTag);
                resDocs[i].categoryTag = this.getTranslatedCategoryTag(resDocs[i].categoryTag);
              }
              if (resDocs[i].status == 'failed') {
                Swal.fire({
                  title: this.translate.instant("summary.File processing error"),
                  text: this.translate.instant("summary.summaryrecommendation"),
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonText: this.translate.instant("summary.Yes, continue"),
                  cancelButtonText: this.translate.instant("summary.No, cancel")
                }).then((result) => {
                  if (result.isConfirmed) {
                    resolve(true); // El usuario decidió continuar
                  } else {
                    this.toastr.error('', this.translate.instant("summary.Process cancelled"));
                    resolve(false); // El usuario decidió cancelar
                  }
                });
                return;
              } else if (resDocs[i].status != 'done' && resDocs[i].status != '' && resDocs[i].status != 'resumen ready') {
                this.toastr.info('', this.translate.instant("generics.The report is being processed"));
                resolve(false); // Informe en proceso
                return;
              }
            }
          }

          resolve(true); // Todos los documentos están en estado 'Done'
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          this.loadedDocs = true;
          this.toastr.error('', this.translate.instant("generics.error try again"));
          resolve(false); // Error al cargar los documentos
        }));
    });
  }

  refreshDocs() {
    this.subscription.add(this.patientService.getDocuments()
      .subscribe((resDocs: any) => {
        // mostrar toast diciendo que ha refrescado los documentos
        this.toastr.info('', this.translate.instant("generics.Documents have been refreshed"));
        if (resDocs.length > 0) {
          // Ordenar documentos: procesando -> sin fecha original -> con fecha original
          this.docs = this.sortDocumentsByStatus(resDocs);
          
          for (var i = 0; i < this.docs.length; i++) {
            const fileName = this.docs[i].url.split("/").pop();
            this.docs[i].title = fileName;
            if (this.docs[i].categoryTag) {
              this.docs[i].badge = this.getBadgeClass(this.docs[i].categoryTag)
              this.docs[i].categoryTag = this.getTranslatedCategoryTag(this.docs[i].categoryTag);
            }

          }
          this.docs.forEach(doc => doc.selected = true);
          //this.assignFeedbackToDocs(this.docs);
        }

      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.loadedDocs = true;
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  getPatientSummaryFile() {
    var fileName = 'raitofile/summary/final_card.txt';
    if (this.translate.currentLang == 'en') {
      fileName = 'raitofile/summary/final_card_translated.txt';
    }
    this.subscription.add(this.http.get(this.accessToken.blobAccountUrl + this.accessToken.containerName + '/' + fileName + this.accessToken.sasToken + '&random=' + Math.random(), { responseType: 'text' })
      .subscribe((res: any) => {
        this.openingSummary = false;
        this.summaryJson = JSON.parse(res);
        const currentVersion = environment.version + ' - ' + environment.subversion;
        if (this.summaryJson.version == currentVersion) {
          let documentsToCheck = this.docs;
          this.showContent(this.contentviewSummary);
          //this.checkIfNeedFeedback(this.contentviewSummary, documentsToCheck, 'general')
        } else {
          this.getPatientSummary(true);
        }

      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.getPatientSummary(true);
      }));
  }

  async downloadPDF() {
    this.generatingPDF = true;
    this.resetPermisions();
    this.newPermission.notes = this.translate.instant("open.Notecustom");
    this.generateUrlQr = this.urlOpenNav29 + this.newPermission.token;
    const qrCodeDataURL = await QRCode.toDataURL(this.generateUrlQr);
    
    // Usar método alternativo nativo del navegador
    this.jsPDFService.generateResultsPDFNative(this.summaryJson.data, localStorage.getItem('lang'), qrCodeDataURL);
    
    // Método original jsPDF (comentado para usar como respaldo)
    // this.jsPDFService.generateResultsPDF(this.summaryJson.data, localStorage.getItem('lang'), null)

    /*
    this.jsPDFService.generateResultsPDF(this.summaryJson, localStorage.getItem('lang'), qrCodeDataURL)
    this.subscription.add( this.patientService.getCustomShare()
    .subscribe( (res : any) => {
      this.listCustomShare = res.customShare;
      this.setCustomShare();
     }, (err) => {
       console.log(err);
       this.insightsService.trackException(err);
     }));
    Swal.fire({
      icon: 'success',
      html: this.translate.instant("open.infoDownloadPDF"),
      showCancelButton: false,
      showConfirmButton: true,
      allowOutsideClick: false
    })*/
    this.generatingPDF = false;
  }

  regenerateSummary() {
    this.regeneratingSummary = true;
    this.closeModal();
    this.getPatientSummary(true);
    this.regeneratingSummary = false;
    // Show info message that the summary is being regenerated
    /*Swal.fire({
      icon: 'info',
      title: this.translate.instant("messages.m6.1"),
      text: this.translate.instant("messages.m6.3"),
      showConfirmButton: true
    });*/
  }

  copymsg(msg: any) {
    console.log('Received msg:', msg);

    // Función para extraer el texto a copiar
    const getTextToCopy = (msg: any): string | undefined => {
      if (typeof msg === 'string') {
        return msg;
      } else if (msg && typeof msg === 'object') {
        return msg.text || msg.content || (typeof msg.toString === 'function' ? msg.toString() : undefined);
      }
      return undefined;
    };

    const textToCopy = getTextToCopy(msg);

    if (!textToCopy) {
      console.error('No text to copy');
      Swal.fire({
        icon: 'error',
        html: this.translate.instant("messages.No text to copy"),
        showCancelButton: false,
        showConfirmButton: true,
        allowOutsideClick: false
      });
      return;
    }

    // Función para limpiar y ajustar el HTML
    const cleanHtml = (html: string): string => {
      let temp = document.createElement("div");
      temp.innerHTML = html;
      temp.innerHTML = temp.innerHTML.replace(/<br\s*\/?>/gi, "\n");
      let scripts = temp.getElementsByTagName("script");
      let styles = temp.getElementsByTagName("style");
      while (scripts[0]) scripts[0].parentNode.removeChild(scripts[0]);
      while (styles[0]) styles[0].parentNode.removeChild(styles[0]);
      return temp.innerHTML;
    };

    const htmlToCopy = cleanHtml(textToCopy);
    console.log('Cleaned HTML to copy:', htmlToCopy);

    // Crear un elemento temporal para copiar
    const tempElement = document.createElement("div");
    tempElement.innerHTML = htmlToCopy;
    tempElement.style.position = "absolute";
    tempElement.style.left = "-9999px";
    document.body.appendChild(tempElement);

    // Seleccionar y copiar el contenido
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(tempElement);
    selection.removeAllRanges();
    selection.addRange(range);

    let copySuccessful = false;
    try {
      copySuccessful = document.execCommand("copy");
    } catch (err) {
      console.error('Unable to copy', err);
    }

    // Limpiar
    selection.removeAllRanges();
    document.body.removeChild(tempElement);

    if (copySuccessful) {
      Swal.fire({
        icon: 'success',
        html: this.translate.instant("messages.Results copied to the clipboard"),
        showCancelButton: false,
        showConfirmButton: false,
        allowOutsideClick: false
      });

      setTimeout(() => {
        Swal.close();
      }, 2000);
    } else {
      Swal.fire({
        icon: 'error',
        html: this.translate.instant("messages.Unable to copy to clipboard"),
        showCancelButton: false,
        showConfirmButton: true,
        allowOutsideClick: false
      });
    }
  }

  sendFeedback(valueVote, text) {
    //this.messages
    this.sendingVote = true;
    var value = { userId: this.authService.getIdUser(), lang: this.detectedLang, vote: valueVote, messages: this.messages, message: text };
    this.subscription.add(this.apiDx29ServerService.vote(value)
      .subscribe((res: any) => {
        this.trackEventsService.lauchEvent("Vote: " + valueVote);
        this.sendingVote = false;
        Swal.fire({
          icon: 'success',
          html: this.translate.instant("messages.thanksvote"),
          showCancelButton: false,
          showConfirmButton: false,
          allowOutsideClick: false
        })
        setTimeout(function () {
          Swal.close();
        }, 2000);

      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.sendingVote = false;
      }));
  }

  getEventTypeDisplay(type: string): string {
    const types = {
      'diagnosis': `${this.translate.instant('timeline.Diagnoses')} 🩺`,
      'treatment': `${this.translate.instant('timeline.Treatment')} 💉`,
      'test': `${this.translate.instant('timeline.Tests')} 🔬`,
      'appointment': `${this.translate.instant('events.appointment')} 📅`,
      'symptom': `${this.translate.instant('timeline.Symptoms')} 🤒`,
      'medication': `${this.translate.instant('timeline.Medications')} 💊`,
      'activity': `${this.translate.instant('timeline.Activity')} 🏃`,
      'reminder': `${this.translate.instant('timeline.Reminder')} 🔔`,
      'other': `${this.translate.instant('timeline.Other')} 🔍`
    };

    if (!type || type === 'null') {
      return `${this.translate.instant('timeline.Other')} 🔍`;
    }
    return types[type] || `${this.translate.instant('timeline.Other')} 🔍`;
  }

  showProposedEvents() {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    let ngbModalOptions: NgbModalOptions = {
      keyboard: false,
      windowClass: 'ModalClass-sm' // xl, lg, sm
    };
    this.modalReference = this.modalService.open(this.contentviewProposedEvents, ngbModalOptions);
  }

  openAddEventModal() {
    // Initialize empty form for new event
    this.eventsForm = this.formBuilder.group({
      name: ['', Validators.required],
      date: [new Date()],
      dateEnd: [null],
      timeHour: [''],
      timeMinute: [''],
      timePeriod: ['AM'],
      key: [''],
      notes: []
    });
    this.showTimeField = false;
    this.submitted = false;
    this.showProposedEvents();
  }

  addProposedEvent(event) {
    this.eventsForm = this.formBuilder.group({
      name: ['', Validators.required],
      date: [new Date()],
      dateEnd: [null],
      timeHour: [''],
      timeMinute: [''],
      timePeriod: ['AM'],
      notes: [],
      key: []
    });
    if (event.date != undefined) {
      const dateObj = new Date(event.date);
      event.date = dateObj;
      // Extract time from the date and convert to 12h format
      const hours24 = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      if (hours24 !== 0 || minutes !== 0) {
        const period = hours24 >= 12 ? 'PM' : 'AM';
        let hours12 = hours24 % 12;
        if (hours12 === 0) hours12 = 12;
        event.timeHour = hours12;
        event.timeMinute = minutes;
        event.timePeriod = period;
      }
    } else {
      event.date = new Date();
    }
    if (event.dateEnd != undefined) {
      event.dateEnd = new Date(event.dateEnd);
    }
    event.name = event.insight;
    //info.date = this.dateService.transformDate(new Date());
    this.eventsForm.patchValue(event);
    this.saveData(false, true);
  }

  editProposedEvent(event) {
    var info = {
      name: event.insight.toLowerCase(),
      date: event.date,
      dateEnd: event.dateEnd || null,
      notes: '',
      data: event.data,
      key: event.key
    }
    this.showForm(info)
  }

  getProposedEventTime(event): string {
    if (!event.date) return '09:00'; // Default time for appointments
    const dateObj = new Date(event.date);
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    // If time is midnight (00:00), return default appointment time
    if (hours === 0 && minutes === 0) {
      return '09:00';
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  updateProposedEventTime(event, timeValue: string) {
    if (!timeValue) return;
    const [hours, minutes] = timeValue.split(':').map(Number);
    const dateObj = new Date(event.date);
    dateObj.setHours(hours, minutes, 0, 0);
    event.date = dateObj.toISOString();
  }

  deleteProposedEvent(index) {
    this.proposedEvents.splice(index, 1);
    if (this.proposedEvents.length == 0 && this.suggestions.length == 0) {
      this.suggestions = this.getAllSuggestions(4);
    }
  }

  deleteAllProposedEvents() {
    this.proposedEvents = [];
    if (this.proposedEvents.length == 0 && this.suggestions.length == 0) {
      this.suggestions = this.getAllSuggestions(4);
    }
  }

  addAllProposedEvents() {

    let savePromises = [];
    this.proposedEvents.forEach(event => {
      this.eventsForm = this.formBuilder.group({
        name: ['', Validators.required],
        date: [new Date()],
        dateEnd: [null],
        timeHour: [''],
        timeMinute: [''],
        timePeriod: ['AM'],
        notes: [],
        key: []
      });
      // Use the event's original date if available, otherwise use today
      if (event.date) {
        event.date = new Date(event.date);
      } else {
        event.date = new Date();
      }
      if (event.dateEnd) {
        event.dateEnd = new Date(event.dateEnd);
      }
      //info.date = this.dateService.transformDate(new Date());
      this.eventsForm.patchValue(event);
      savePromises.push(this.saveData(false, false));
    });
    this.proposedEvents = [];

    Promise.all(savePromises).then(() => { // cuando todas las promesas se resuelven
      if (this.proposedEvents.length == 0 && this.suggestions.length == 0) {
        this.suggestions = this.getAllSuggestions(4);
      }
      let newMsg = this.translate.instant('events.The events have been saved');
      this.addMessage({
        text: newMsg,
        isUser: false
      });
      this.loadEnvironmentMydata(); // llamar a loadEvents una vez que todos los datos se guarden
    });
  }

  resetPermisions() {
    var dateNow = new Date();
    var stringDateNow = this.dateService.transformDate(dateNow);
    this.newPermission = {
      data: {},
      notes: '',
      date: stringDateNow,
      token: this.getUniqueFileNameToken()
    };
  }

  getUniqueFileNameToken() {
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var passwordLength = 20;
    var password = "";
    for (var i = 0; i <= passwordLength; i++) {
      var randomNumber = Math.floor(Math.random() * chars.length);
      password += chars.substring(randomNumber, randomNumber + 1);
    }
    //var url = environment.urlRaito+'/?key='+this.authService.getCurrentPatient().sub+'&token='+password
    var url = '/?key=' + this.authService.getCurrentPatient().sub + '&token=' + password
    //var url = password
    return url;
  }

  share(shareTo, mode) {
    this.resetPermisions();
    this.mode = mode;
    this.openModal(shareTo);
  }

  setCustomShare() {
    this.loadedShareData = false;
    let info = this.newPermission;
    if (this.newPermission._id == null) {
      this.listCustomShare.push(this.newPermission)
    } else {
      var found = false;
      for (var i = 0; i <= this.listCustomShare.length && !found; i++) {
        if (this.listCustomShare[i]._id == this.newPermission._id) {
          this.listCustomShare[i] = this.newPermission;
          found = true;
        }
      }
    }

    this.subscription.add(this.patientService.updateCustomShare(info)
      .subscribe((res: any) => {
        this.resetPermisions();
        this.showNewCustom = false;
        this.listCustomShare = res.customShare;
        this.loadedShareData = true;
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.loadedShareData = true;
      }));
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
      this.showNewCustom = false;
      this.modalReference.close();
      this.modalReference = undefined;
    }
  }




  showOptionsMenu(ContentOptionsMenu) {
    this.showOptionsData = 'general';
    this.actualCategory = null;
    /*this.suggestions2 = [];
    this.suggestions2 = this.getAllSuggestions(6);*/
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-sm'// xl, lg, sm
    };
    this.modalReference = this.modalService.open(ContentOptionsMenu, ngbModalOptions);
  }

  getLiteral(literal) {
    return this.translate.instant(literal);
  }

  getBlobUrl(urlinit) {
    let tempUrl2 = this.accessToken.blobAccountUrl + this.accessToken.containerName + '/' + urlinit + this.accessToken.sasToken;
    window.open(tempUrl2);
  }

  getObjectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  isString(value: any): boolean {
    return typeof value === 'string';
  }

  isObject(value: any): boolean {
    return typeof value === 'object' && value !== null;
  }

  isDate(value: any): boolean {
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    return false;
  }

  openOptionsFiles(contentOptionsFiles) {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-sm'// xl, lg, sm, xs
    };
    this.modalReference = this.modalService.open(contentOptionsFiles, ngbModalOptions);
  }

  async entryOpt(opt, content) {
    if (opt == 'opt1') {
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
    } else if (opt == 'opt2') {
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
    // Usar el servicio de reconocimiento de voz que maneja Web Speech API y Azure
    this.supported = this.speechRecognitionService.isSupported();
    
    // Limpiar suscripciones anteriores si existen
    if (this.speechSubscription) {
      this.speechSubscription.unsubscribe();
    }
    
    // Suscribirse a los resultados del reconocimiento
    let lastFinalText = '';
    let lastInterimText = '';
    this.speechSubscription = this.speechRecognitionService.results$.subscribe((result) => {
      if (result && result.text) {
        if (result.isFinal) {
          // Para resultados finales, extraer solo el nuevo texto
          const newText = result.text.replace(lastFinalText, '').trim();
          if (newText) {
            // Remover el último texto intermedio si existe
            if (lastInterimText && this.medicalText.endsWith(lastInterimText)) {
              this.medicalText = this.medicalText.slice(0, -lastInterimText.length);
            }
            this.medicalText += (this.medicalText && !this.medicalText.endsWith('\n') ? '\n' : '') + newText;
          }
          lastFinalText = result.text;
          lastInterimText = '';
        } else {
          // Para resultados intermedios, reemplazar el último texto intermedio
          if (lastInterimText && this.medicalText.endsWith(lastInterimText)) {
            this.medicalText = this.medicalText.slice(0, -lastInterimText.length) + result.text;
          } else {
            // Si no hay texto intermedio previo, añadir el nuevo
            const currentText = this.medicalText.trim();
            if (currentText && !currentText.endsWith('\n')) {
              this.medicalText += '\n' + result.text;
            } else {
              this.medicalText += result.text;
            }
          }
          lastInterimText = result.text;
        }
      }
    });

    // Suscribirse a errores
    this.speechSubscription.add(
      this.speechRecognitionService.errors$.subscribe((error) => {
        this.toastr.error('', error);
        if (this.recording) {
          this.stopTimer();
          this.recording = false;
        }
      })
    );

    // Suscribirse a cambios de estado
    this.speechSubscription.add(
      this.speechRecognitionService.status$.subscribe((status) => {
        if (status === 'recording' && !this.recording) {
          this.recording = true;
        } else if (status === 'stopped' && this.recording) {
          this.recording = false;
          this.stopTimer();
        }
      })
    );
  }

  startTimer(restartClock) {
    if (restartClock) {
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
      // Mostrar el swal durante unos segundos diciendo que está procesando
      Swal.fire({
        title: this.translate.instant("voice.Processing audio..."),
        html: this.translate.instant("voice.Please wait a few seconds."),
        showCancelButton: false,
        showConfirmButton: false,
        allowOutsideClick: false
      });
      
      // Detener el reconocimiento
      this.speechRecognitionService.stop();
      this.stopTimer();
      
      // Obtener el texto acumulado y añadirlo al campo
      const finalText = this.speechRecognitionService.getAccumulatedText();
      if (finalText && !this.medicalText.includes(finalText)) {
        this.medicalText += finalText;
      }
      
      setTimeout(() => {
        Swal.close();
        this.recording = false;
      }, 2000);

    } else {
      if (this.medicalText.length > 0) {
        // Quiere continuar con la grabación o empezar una nueva
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
          } else {
            this.medicalText = '';
            this.accumulatedText = '';
            this.speechRecognitionService.clearAccumulatedText();
            this.continueRecording(true, true);
          }
        });
      } else {
        this.continueRecording(true, true);
      }
    }
  }

  continueRecording(restartClock, changeState) {
    this.startTimer(restartClock);
    
    if (restartClock) {
      this.accumulatedText = '';
      this.speechRecognitionService.clearAccumulatedText();
    }
    
    // Usar el servicio de reconocimiento de voz
    this.speechRecognitionService.start();
    
    if (changeState) {
      this.recording = true;
    }
  }

  restartRecognition() {
    // El servicio maneja automáticamente los reinicios
    // Solo necesitamos detener y volver a iniciar si es necesario
    if (this.recording) {
      this.speechRecognitionService.stop();
      setTimeout(() => {
        if (this.recording) {
          this.speechRecognitionService.start();
        }
      }, 100);
    }
  }

  toggleChatRecording() {
    if (this.chatRecording) {
      // Detener el reconocimiento de voz
      this.speechRecognitionService.stop();
      this.chatRecording = false;
      
      // El texto ya debería estar en el mensaje gracias a la suscripción
      // Limpiar el texto acumulado del servicio
      this.speechRecognitionService.clearAccumulatedText();
      
      // Si hay mensaje, enviarlo automáticamente
      if (this.message && this.message.trim()) {
        // Pequeño delay para asegurar que el texto final se haya añadido
        setTimeout(() => {
          this.sendMessage();
        }, 100);
      }
    } else {
      // Iniciar el reconocimiento de voz
      this.speechRecognitionService.clearAccumulatedText();
      this.speechRecognitionService.start();
      this.chatRecording = true;
    }
  }


  isMobileDevice2(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor;
    return /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
  }

  isMobileDevice(): boolean {
    let check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor);
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
          this.insightsService.trackException(err);
          //debe permitir la camara para continuar
          this.toastr.error('', 'You must allow the camera to continue. Please enable camera access in your browser settings and try again.');
          if (this.modalReference != undefined) {
            this.modalReference.close();
            this.modalReference = undefined;
          }
        });
    } else {
      console.error("Video element not found");
      this.insightsService.trackEvent('Video element not found');
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
      this.nameFileCamera = 'photo-' + this.getUniqueFileCamera();
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
    reader.readAsDataURL(file); // read file as data url
    reader.onload = (event2: any) => { // called once readAsDataURL is completed
      var filename = (file).name;
      var extension = filename.substr(filename.lastIndexOf('.'));
      var pos = (filename).lastIndexOf('.')
      pos = pos - 4;
      if (pos > 0 && extension == '.gz') {
        extension = (filename).substr(pos);
      }
      filename = filename.split(extension)[0];
      var uniqueFileName = this.getUniqueFileName();
      filename = 'raitofile/' + uniqueFileName + '/' + filename + extension;
      let dataFile = { event: file, url: filename, name: file.name }
      this.tempDocs.push({ dataFile: dataFile, state: 'false' });
      if (goprev) {
        this.prevCamera();
      } else {
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
        html: `<p>${this.translate.instant('demo.Combining')} ${this.tempDocs.length} ${this.tempDocs.length === 1 ? this.translate.instant('demo.photo') : this.translate.instant('demo.photos')} ${this.translate.instant('demo.into one document')}...</p>
               <p style="font-size: 0.9em; color: #666; margin-top: 10px;">${this.translate.instant('demo.Please wait')}</p>`,
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
      // Asegurarse de que el nombre no tenga extensión .pdf ya
      let cleanName = documentName.trim();
      if (cleanName.toLowerCase().endsWith('.pdf')) {
        cleanName = cleanName.slice(0, -4);
      }
      const pdfFileName = cleanName + '.pdf';
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // Preparar para subir
      var uniqueFileName = this.getUniqueFileName();
      var filename = 'raitofile/' + uniqueFileName + '/' + pdfFileName;
      
      // Limpiar tempDocs y añadir el PDF
      this.tempDocs = [];
      let dataFile = { event: pdfFile, url: filename, name: pdfFileName };
      this.tempDocs.push({ dataFile: dataFile, state: 'false' });

      // Cerrar mensaje de carga
      Swal.close();

      // Subir el PDF
      this.processFilesSequentially();
    } catch (error) {
      console.error('Error combining photos:', error);
      this.insightsService.trackException(error);
      Swal.fire({
        icon: 'error',
        title: this.translate.instant('generics.error try again'),
        text: this.translate.instant('demo.Error combining photos')
      });
      // Si falla, intentar subir como documentos separados
      this.processFilesSequentially();
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

  deletephoto(index) {
    this.tempDocs.splice(index, 1);
  }

 

  getUniqueFileCamera() {
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

  //create dataURLtoFile
  dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  async createFile() {

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
    let file = new File([this.medicalText], this.tempFileName, { type: 'text/plain' });
    await this.processFile(file);
    if (this.tempDocs.length > 0) {
      this.processFilesSequentially();
    } else {
      console.log("All files were either invalid or cancelled.");
    }
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
  }

  showTimeline() {
    this.timeline = [];
    this.originalEvents = [];
    for (var i = 0; i < this.allEvents.length; i++) {
      var key = this.allEvents[i].key;
      if (key == 'treatment' || key == 'diagnosis' || key == 'test' || key == 'symptom' || key == 'medication' || key == 'other' || key == 'appointment') {
        if (key == 'treatment') {
          this.allEvents[i].key = 'treatment';
        }
        if (key == 'diagnosis') {
          this.allEvents[i].key = 'diagnosis';
        }
        if (key == 'test') {
          this.allEvents[i].key = 'test';
        }
        if (key == 'symptom') {
          this.allEvents[i].key = 'symptom';
        }
        if (key == 'medication') {
          this.allEvents[i].key = 'medication';
        }
        if (key == 'other') {
          this.allEvents[i].key = 'other';
        }
        if (key == 'appointment') {
          this.allEvents[i].key = 'appointment';
        }
        this.timeline.push(this.allEvents[i]);
      }
    }
    /*if(this.appointments.length>0){
      for(var i=0; i<this.appointments.length; i++){
        this.appointments[i].key = 'appointment';
        
        this.timeline.push(this.appointments[i]);
      }
    }*/
    this.originalEvents = this.timeline;
    this.filterEvents();
    /* this.timeline = res2;
     this.originalEvents = this.timeline;
     this.filterEvents();*/
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }


  private groupEventsByMonth(events: any[]): any[] {
    const grouped = {};
    const noDateEvents = [];

    events.forEach(event => {
      if (!event.date) {
        noDateEvents.push(event);
      } else {
        const dateObj = new Date(event.date);
        // Validar que la fecha sea válida y no sea 1970 (caso de error común)
        if (isNaN(dateObj.getTime()) || dateObj.getFullYear() <= 1970) {
          noDateEvents.push(event);
        } else {
          const monthYear = this.getMonthYear(event.date).getTime();
          if (!grouped[monthYear]) {
            grouped[monthYear] = [];
          }
          grouped[monthYear].push(event);
        }
      }
    });

    const result = Object.keys(grouped).map(key => ({
      monthYear: new Date(Number(key)),
      events: grouped[key]
    }));

    if (noDateEvents.length > 0) {
      result.push({
        monthYear: null, // Identificador especial para eventos sin fecha
        events: noDateEvents
      });
    }

    return result;
  }


  private getMonthYear(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date(0); // Fallback
    }
    return new Date(date.getFullYear(), date.getMonth(), 1); // Primer día del mes
  }

  filterEvents() {
    this.cdr.detectChanges();
    const startDate = this.startDate ? new Date(this.startDate) : null;
    const endDate = this.endDate ? new Date(this.endDate) : null;
    const filtered = this.originalEvents.filter(event => {
      const eventStart = event.date ? new Date(event.date) : null;
      const eventEnd = event.dateEnd ? new Date(event.dateEnd) : eventStart;
      
      // Si el evento tiene un rango (dateEnd), verificar si se solapa con el rango de filtrado
      let isAfterStartDate = true;
      let isBeforeEndDate = true;
      
      if (startDate) {
        // El evento debe terminar después del inicio del filtro (o no tener fin)
        isAfterStartDate = !eventEnd || eventEnd >= startDate;
      }
      
      if (endDate) {
        // El evento debe empezar antes del fin del filtro
        isBeforeEndDate = !eventStart || eventStart <= endDate;
      }

      const isEventTypeMatch = !this.selectedEventType || this.selectedEventType == 'null' || !event.key || event.key === this.selectedEventType;
      return isAfterStartDate && isBeforeEndDate && isEventTypeMatch;
    });

    this.groupedEvents = this.groupEventsByMonth(filtered);
    this.orderEvents();
  }

  resetStartDate() {
    this.startDate = null;
    this.filterEvents();
  }
  resetEndDate() {
    this.endDate = null;
    this.filterEvents();
  }

  toggleEventOrder() {
    this.isOldestFirst = !this.isOldestFirst; // Cambia el estado del orden
    this.orderEvents();
  }

  orderEvents() {
    this.groupedEvents.sort((a, b) => {
      // Los eventos sin fecha (monthYear === null) siempre van primero para que el usuario los vea
      if (a.monthYear === null) return -1;
      if (b.monthYear === null) return 1;

      const dateA = a.monthYear.getTime();
      const dateB = b.monthYear.getTime();
      return this.isOldestFirst ? dateA - dateB : dateB - dateA;
    });

    this.groupedEvents.forEach(group => {
      group.events.sort((a, b) => {
        if (!a.date) return -1;
        if (!b.date) return 1;
        
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return this.isOldestFirst ? dateA - dateB : dateB - dateA;
      });
    });
  }

  openFeedback(type) {
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-sm'// xl, lg, sm
    };
    this.modalReferenceSummary = this.modalService.open(FeedbackSummaryPageComponent, ngbModalOptions);
    if (type == 'individual') {
      this.modalReferenceSummary.componentInstance.documents = [this.actualDoc];
    } else {
      this.modalReferenceSummary.componentInstance.documents = this.docs;
    }

    this.modalReferenceSummary.componentInstance.type = type;
  }

  handleClose() {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    this.refreshDocs();
  }

  handleClose2() {
    this.needFeedback = false;
    if (this.eventsDoc.length > 0) {
      /*this.selectedIndexTab = 1;
      //show a swal diciendo que ahora tiene que verificar que los eventos son correctos
      var msg1 = this.translate.instant("events.review_validate_events")
      Swal.fire('', msg1, "info");*/
    }
    this.refreshDocs();
  }
  
  explainMedicalEvent(input) {
    //open a swal waiting for the response
    Swal.fire({
      title: this.translate.instant("generics.Please wait"),
      html: this.translate.instant("demo.This may take up to a minute"),
      showCancelButton: false,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    })
    var eventsIdsDef = { input: input };
    this.subscription.add(this.http.post(environment.api + '/api/explainmedicalevent/' + this.currentPatient, eventsIdsDef)
      .subscribe((res: any) => {
        //show a swal with the response and the input as the title
        Swal.close();
        if (res.msg) {
          Swal.fire(input, res.msg, "info");
        } else {
          this.toastr.error('', this.translate.instant("generics.error try again"));
        }
      }, (err) => {
        Swal.close();
        console.log(err);
        this.insightsService.trackException(err);
        this.loadedDocs = true;
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  editMedicalEvent(event: any) {
    const modalRef = this.modalService.open(EditMedicalEventComponent, { size: 'lg' });
    modalRef.componentInstance.event = { ...event }; // Pass a copy of the event
    modalRef.result.then((result) => {
      if (result) {
        // Update the event in the eventsDoc array
        const index = this.eventsDoc.findIndex(e => e === event);
        if (index !== -1) {
          this.eventsDoc[index] = result.eventdb;
        }
        this.loadEnvironmentMydata();
      }
    }).catch(() => {
      // Modal dismissed
      console.log('Modal dismissed');
    });
  }

  deleteMedicalEvent(event) {
    Swal.fire({
      title: this.translate.instant("generics.Are you sure delete") + "?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2F8BE6',
      cancelButtonColor: '#B0B6BB',
      confirmButtonText: this.translate.instant("generics.Accept"),
      cancelButtonText: this.translate.instant("generics.Cancel"),
      showLoaderOnConfirm: true,
      allowOutsideClick: false,
      reverseButtons: true
    }).then((result) => {
      if (result.value) {
        this.subscription.add(this.http.delete(environment.api + '/api/events/'+this.authService.getCurrentPatient().sub + '/' + event._id)
          .subscribe((res: any) => {
            //update this.eventsDoc removing the event
            this.eventsDoc = this.eventsDoc.filter(e => e._id !== event._id);
            this.toastr.success('', this.translate.instant("generics.Deleted successfully"));
            this.loadEnvironmentMydata();
          }, (err) => {
            console.log(err);
            this.insightsService.trackException(err);
            this.toastr.error('', this.translate.instant("generics.error try again"));
          }));
      }
    });

  }

  newMedicalEvent(doc) {
    const modalRef = this.modalService.open(NewMedicalEventComponent, { size: 'lg' });
    modalRef.componentInstance.docId = doc._id;
    modalRef.result.then(
      (result) => {
        if (result) {
          console.log(result)
          this.loadEventFromDoc(doc);
          this.loadEnvironmentMydata();
        } else {
          console.log('Modal dismissed');
        }
      },
      (reason) => {
        // Modal was dismissed
        console.log('Modal dismissed:', reason);

      }
    );
  }

  toggleAllDocuments() {
    //this.docs.forEach(doc => doc.selected = this.selectAllDocuments);
    this.filteredDocs.forEach(doc => doc.selected = this.selectAllDocuments);
    // Update the main docs array to reflect changes
    this.docs = this.docs.map(doc => {
      const filteredDoc = this.filteredDocs.find(fd => fd._id === doc._id);
      if (filteredDoc) {
        return { ...doc, selected: filteredDoc.selected };
      }
      return doc;
    });
    this.updateDocumentSelection();
  }

  updateDocumentSelection() {
    //this.searchTerm = '';
    //this.filteredDocs = [...this.docs]
    this.filteredDocs = this.docs;
    this.searchDocs();
    this.selectAllDocuments = this.filteredDocs.every(doc => doc.selected);
  }

  availableContextDocs: any[] = [];
  documentContextModalRef: NgbModalRef;

  openDocumentContextModal(documentContextModal?: TemplateRef<any>) {
    // Filtrar solo los documentos que pueden ser usados como contexto
    this.availableContextDocs = this.docs
      .filter(doc => doc.status == 'finished' || doc.status == 'done' || doc.status == 'resumen ready')
      .map(doc => ({ ...doc })); // Crear copia para no modificar directamente
    
    const modalTemplate = documentContextModal || this.documentContextModal;
    if (!modalTemplate) {
      console.error('Document context modal template not found');
      return;
    }
    
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg'
    };
    this.documentContextModalRef = this.modalService.open(modalTemplate, ngbModalOptions);
  }

  closeDocumentContextModal() {
    if (this.documentContextModalRef != undefined) {
      this.documentContextModalRef.close();
      this.documentContextModalRef = undefined;
    }
  }

  selectAllContextDocuments() {
    this.availableContextDocs.forEach(doc => doc.selected = true);
  }

  deselectAllContextDocuments() {
    this.availableContextDocs.forEach(doc => doc.selected = false);
  }

  saveDocumentContextSelection() {
    // Actualizar la selección en el array principal de documentos
    this.availableContextDocs.forEach(modalDoc => {
      const originalDoc = this.docs.find(d => d._id === modalDoc._id);
      if (originalDoc) {
        originalDoc.selected = modalDoc.selected;
      }
    });
    
    // Actualizar también filteredDocs
    this.filteredDocs = this.filteredDocs.map(filteredDoc => {
      const updatedDoc = this.availableContextDocs.find(d => d._id === filteredDoc._id);
      if (updatedDoc) {
        return { ...filteredDoc, selected: updatedDoc.selected };
      }
      return filteredDoc;
    });
    
    this.updateDocumentSelection();
    this.closeDocumentContextModal();
  }

  getAvailableDocumentsCount(): number {
    return this.docs.filter(doc => 
      doc.status == 'finished' || doc.status == 'done' || doc.status == 'resumen ready'
    ).length;
  }

  getFileIconClass(fileName: string): string {
    if (!fileName) return 'fa-file-o';
    
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf':
        return 'fa-file-pdf-o';
      case 'docx':
      case 'doc':
        return 'fa-file-word-o';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return 'fa-file-image-o';
      case 'txt':
        return 'fa-file-text-o';
      default:
        return 'fa-file-o';
    }
  }

  getFileIconColor(fileName: string): string {
    if (!fileName) return '#5f6368';
    
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf':
        return '#ea4335'; // Rojo
      case 'docx':
      case 'doc':
        return '#4285f4'; // Azul
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return '#34a853'; // Verde
      case 'txt':
        return '#5f6368'; // Gris
      default:
        return '#5f6368'; // Gris por defecto
    }
  }

  deleteDocumentFromModal(doc: any) {
    // Usar la función existente deleteDoc que ya tiene confirmación
    Swal.fire({
      title: this.translate.instant("generics.Are you sure?"),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0CC27E',
      cancelButtonColor: '#FF586B',
      confirmButtonText: this.translate.instant("generics.Delete"),
      cancelButtonText: this.translate.instant("generics.No, cancel"),
      showLoaderOnConfirm: true,
      allowOutsideClick: false
    }).then((result) => {
      if (result.value) {
        // Remover del array del modal inmediatamente
        this.availableContextDocs = this.availableContextDocs.filter(d => d._id !== doc._id);
        // Llamar a la función de eliminación que actualiza la lista principal
        this.confirmDeleteDoc(doc);
      }
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    if (!this.showNewCustom && this.listCustomShare.length > 0 && document.getElementById('panelCustomShare') != null) {
      this.widthPanelCustomShare = document.getElementById('panelCustomShare').offsetWidth;
    }
    const previousScreenWidth = this.screenWidth;
    this.screenWidth = window.innerWidth;
    
    // Si cambiamos de pantalla grande a pequeña
    // Solo hacer esto si realmente hubo un cambio de tamaño (previousScreenWidth > 0)
    // para evitar abrir el sidebar al cargar la página por primera vez
    if (previousScreenWidth > 0 && previousScreenWidth >= 1199 && this.screenWidth < 1199) {
      // No abrir automáticamente el sidebar móvil al cambiar de tamaño
      // El usuario debe abrirlo manualmente desde el menú inferior
      this.rightSidebarOpenMobile = false;
      // Resetear el estado de colapsado en móvil (no aplica en pantallas pequeñas)
      this.rightSidebarCollapsed = false;
    }
    
    // Si cambiamos de pantalla pequeña a grande, cerrar el sidebar móvil
    if (previousScreenWidth < 1199 && this.screenWidth >= 1199) {
      this.rightSidebarOpenMobile = false;
    }
    
    if(this.screenWidth > 1199 && this.currentView == 'documents'){
      this.setView('chat');
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.notesSidebarOpen = false;
  }

  isSmallScreen(): boolean {
    return this.screenWidth < 1199; // Bootstrap's breakpoint for small screen
  }

  isXSScreen(): boolean {
    return this.screenWidth < 1199; //650; // Bootstrap's breakpoint for small screen
  }


  toggleNotesSidebar() {
    this.notesSidebarOpen = !this.notesSidebarOpen;
    if (this.isSmallScreen && this.sidebarOpen) {
      this.sidebarOpen = false;
    }
  }

  toggleLeftSidebar() {
    this.leftSidebarCollapsed = !this.leftSidebarCollapsed;
  }

  toggleRightSidebar() {
    this.rightSidebarCollapsed = !this.rightSidebarCollapsed;
  }

  openRightSidebarMobile() {
    // Si estamos en documentos u otra vista, cambiar a chat para mostrar el sidebar de herramientas
    if (this.currentView !== 'chat') {
      this.currentView = 'chat';
    }
    this.rightSidebarOpenMobile = true;
  }

  closeRightSidebarMobile() {
    this.rightSidebarOpenMobile = false;
  }

  openTrialGpt() {
    // Abrir TrialGPT en una nueva pestaña
    window.open('https://trialgpt.app/', '_blank');
  }

  openToolModal(tool: string) {
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-xl' // xl para modales grandes
    };
    
    if (this.modalReference != undefined) {
      this.modalReference.close();
    }
    
    if (tool === 'dxgpt') {
      // Limpiar resultados anteriores para asegurar que se carguen los datos del paciente actual
      this.dxGptResults = null;
      this.isDxGptLoading = false;
      this.modalReference = this.modalService.open(this.dxGptModal, ngbModalOptions);
    } else if (tool === 'rarescope') {
      // Limpiar datos anteriores para asegurar que se carguen los datos del paciente actual
      this.rarescopeNeeds = [''];
      this.additionalNeeds = [];
      this.rarescopeError = null;
      this.isLoadingRarescope = false;
      // Cargar los datos de Rarescope (carga desde BD o hace análisis si no hay datos)
      this.loadRarescopeData();
      this.modalReference = this.modalService.open(this.rarescopeModal, ngbModalOptions);
    }
    // Aquí se pueden añadir más herramientas cuando las implementemos
  }

  openNotesModal() {
    // Cargar las notas antes de abrir el modal
    this.getNotes();
    
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg' // lg para el modal de notas
    };
    
    if (this.modalReference != undefined) {
      this.modalReference.close();
    }
    this.modalReference = this.modalService.open(this.notesModal, ngbModalOptions);
  }

  openDiaryModal() {
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-xl' // xl para el modal del diario
    };
    
    if (this.modalReference != undefined) {
      this.modalReference.close();
    }
    this.modalReference = this.modalService.open(this.diaryModal, ngbModalOptions);
  }

  sendQuickPrepareConsult() {
    // Enviar directamente un mensaje predeterminado al chat
    this.message = this.translate.instant('prepareConsult.quickMessage');
    this.sendMessage();
  }

  openPrepareConsultModal() {
    // Resetear datos del formulario
    this.prepareConsultData = {
      specialist: '',
      consultDate: '',
      comments: ''
    };
    this.prepareConsultEditMode = {
      specialist: false,
      consultDate: false,
      comments: false
    };
    
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-md' // md para un modal mediano
    };
    
    if (this.modalReference != undefined) {
      this.modalReference.close();
    }
    this.modalReference = this.modalService.open(this.prepareConsultModal, ngbModalOptions);
  }

  togglePrepareConsultEdit(field: 'specialist' | 'consultDate' | 'comments') {
    this.prepareConsultEditMode[field] = !this.prepareConsultEditMode[field];
  }

  sendPreparedConsult() {
    // Construir el mensaje para el chat
    let messageToSend = this.translate.instant('prepareConsult.title');
    
    if (this.prepareConsultData.specialist) {
      messageToSend += ` con ${this.prepareConsultData.specialist}`;
    }
    
    if (this.prepareConsultData.consultDate) {
      messageToSend += ` (${this.prepareConsultData.consultDate})`;
    }
    
    messageToSend += '. ';
    
    if (this.prepareConsultData.comments) {
      messageToSend += this.prepareConsultData.comments;
    } else {
      messageToSend += this.translate.instant('prepareConsult.commentsPlaceholder');
    }
    
    // Cerrar el modal
    this.closeModal();
    
    // Enviar el mensaje al chat
    this.message = messageToSend;
    this.sendMessage();
  }

  // ========== SOAP Notes Methods (Clinical) ==========
  
  openSoapModal() {
    // Resetear datos del formulario
    this.soapStep = 1;
    this.soapLoading = false;
    this.soapData = {
      patientSymptoms: '',
      suggestedQuestions: [],
      result: null
    };
    
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg',
      size: 'lg'
    };
    
    if (this.modalReference != undefined) {
      this.modalReference.close();
    }
    this.modalReference = this.modalService.open(this.soapModal, ngbModalOptions);
  }

  generateSoapQuestions() {
    if (!this.soapData.patientSymptoms || this.soapLoading) return;
    
    this.soapLoading = true;
    const info = {
      userId: this.authService.getIdUser(),
      lang: this.preferredResponseLanguage || localStorage.getItem('lang') || 'en',
      patientSymptoms: this.soapData.patientSymptoms
    };
    
    this.subscription.add(this.http.post(environment.api + '/api/ai/soap/questions/' + this.currentPatient, info)
      .pipe(timeout(120000))
      .subscribe((res: any) => {
        this.soapLoading = false;
        
        if (res.success && res.questions) {
          this.soapData.suggestedQuestions = res.questions.map((q: string) => ({
            question: q,
            answer: ''
          }));
          this.soapStep = 2;
        } else {
          this.toastr.error('', res.error || this.translate.instant('soap.errorQuestions'));
        }
      }, (err) => {
        this.soapLoading = false;
        console.log('[SOAP] Error generating questions:', err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  generateSoapReport() {
    if (this.soapLoading) return;
    
    this.soapLoading = true;
    const info = {
      userId: this.authService.getIdUser(),
      lang: this.preferredResponseLanguage || localStorage.getItem('lang') || 'en',
      patientSymptoms: this.soapData.patientSymptoms,
      questionsAndAnswers: this.soapData.suggestedQuestions
    };
    
    this.subscription.add(this.http.post(environment.api + '/api/ai/soap/report/' + this.currentPatient, info)
      .pipe(timeout(180000))
      .subscribe((res: any) => {
        this.soapLoading = false;
        
        if (res.success && res.soap) {
          this.soapData.result = res.soap;
          this.soapStep = 3;
        } else {
          this.toastr.error('', res.error || this.translate.instant('soap.errorReport'));
        }
      }, (err) => {
        this.soapLoading = false;
        console.log('[SOAP] Error generating report:', err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }));
  }

  copySoapReport() {
    if (!this.soapData.result) return;
    
    const soapText = `SOAP NOTES
================

SUBJECTIVE:
${this.soapData.result.subjective}

OBJECTIVE:
${this.soapData.result.objective}

ASSESSMENT:
${this.soapData.result.assessment}

PLAN:
${this.soapData.result.plan}
`;
    
    navigator.clipboard.writeText(soapText).then(() => {
      this.toastr.success('', this.translate.instant('soap.copied'));
    }).catch(err => {
      console.error('Error copying to clipboard:', err);
      this.toastr.error('', this.translate.instant('generics.error try again'));
    });
  }

  // ========== Patient Tracking Methods (Clinical) ==========
  
  openTrackingModal() {
    // Resetear datos del formulario
    this.trackingLoading = true; // Mostrar loading mientras carga
    this.trackingImportPreview = null;
    this.trackingManualEntry = {
      conditionType: 'epilepsy',
      date: '',
      type: 'Tonic Clonic',
      duration: 0,
      severity: 5,
      triggers: [],
      notes: ''
    };
    
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-xl',
      size: 'xl'
    };
    
    if (this.modalReference != undefined) {
      this.modalReference.close();
    }
    this.modalReference = this.modalService.open(this.trackingModal, ngbModalOptions);
    
    // Cargar datos existentes del paciente
    this.loadTrackingData();
  }

  loadTrackingData() {
    if (!this.currentPatient) {
      this.trackingLoading = false;
      this.trackingStep = 1;
      return;
    }
    
    this.trackingLoading = true;
    
    // Build URL with optional condition filter
    const url = environment.api + '/api/tracking/' + this.currentPatient + '/data';
    
    this.subscription.add(
      this.http.get(url)
        .pipe(timeout(30000))
        .subscribe({
          next: (res: any) => {
            this.trackingLoading = false;
            
            if (res.success && res.data) {
              this.trackingData = res.data;
              this.trackingData.entries = this.trackingData.entries.map(e => ({
                ...e,
                date: new Date(e.date)
              }));
              // Cargar insights existentes
              if (res.data.insights && res.data.insights.length > 0) {
                this.trackingInsights = res.data.insights;
              }
              this.calculateTrackingStats();
              this.populateSeizureTypes();
              this.populateAvailableYears();
              // Si hay datos, ir directo al dashboard (paso 4)
              if (this.trackingData.entries.length > 0) {
                this.trackingStep = 4;
                // Usar setTimeout con retry para esperar a que Angular renderice el DOM
                this.initTrackingChartsWithRetry();
              } else {
                // Sin datos, mostrar menú de opciones
                this.trackingStep = 1;
              }
            } else {
              this.trackingStep = 1;
            }
          },
          error: (err) => {
            this.trackingLoading = false;
            this.trackingStep = 1;
            console.error('Error loading tracking data:', err);
          }
        })
    );
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onTrackingFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processTrackingFile(files[0]);
    }
  }

  onTrackingFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processTrackingFile(input.files[0]);
    }
  }

  processTrackingFile(file: File) {
    if (!file.name.endsWith('.json')) {
      this.toastr.error('', this.translate.instant('tracking.invalidFileType'));
      return;
    }
    
    this.trackingLoading = true;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let content = e.target?.result as string;
        
        // Sanitizar JSON: escapar caracteres de control dentro de strings
        // Seizure Tracker exporta JSON con saltos de línea literales en valores
        content = this.sanitizeJsonString(content);
        
        const jsonData = JSON.parse(content);
        
        // Detectar tipo de archivo
        const detected = this.detectTrackingFileType(jsonData);
        
        this.trackingImportPreview = {
          type: detected.type,
          entriesCount: detected.entriesCount,
          medicationsCount: detected.medicationsCount,
          dateRange: detected.dateRange,
          rawData: jsonData
        };
        
        this.trackingLoading = false;
      } catch (err) {
        this.trackingLoading = false;
        this.toastr.error('', this.translate.instant('tracking.parseError'));
        console.error('Error parsing JSON:', err);
      }
    };
    
    reader.onerror = () => {
      this.trackingLoading = false;
      this.toastr.error('', this.translate.instant('tracking.readError'));
    };
    
    reader.readAsText(file);
  }

  /**
   * Sanitiza un string JSON escapando caracteres de control dentro de valores string.
   * Seizure Tracker y otras apps exportan JSON con saltos de línea literales en valores.
   */
  sanitizeJsonString(jsonStr: string): string {
    // Reemplazar caracteres de control dentro de strings JSON
    // Usa una regex que encuentra strings JSON y escapa caracteres de control dentro
    return jsonStr.replace(/"([^"\\]|\\.)*"/g, (match) => {
      // Escapar caracteres de control no escapados dentro del string
      return match
        .replace(/[\x00-\x1F\x7F]/g, (char) => {
          // Mapeo de caracteres de control a secuencias de escape JSON
          const escapes: { [key: string]: string } = {
            '\n': '\\n',
            '\r': '\\r',
            '\t': '\\t',
            '\b': '\\b',
            '\f': '\\f'
          };
          return escapes[char] || `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
        });
    });
  }

  detectTrackingFileType(data: any): { type: string; entriesCount: number; medicationsCount: number; dateRange: string } {
    // Detectar SeizureTracker
    if (data.Seizures && Array.isArray(data.Seizures)) {
      const seizures = data.Seizures;
      const medications = data.Medications || [];
      
      let dateRange = '-';
      if (seizures.length > 0) {
        const dates = seizures
          .map((s: any) => new Date(s.Date_Time))
          .filter((d: Date) => !isNaN(d.getTime()))
          .sort((a: Date, b: Date) => a.getTime() - b.getTime());
        
        if (dates.length > 0) {
          const firstDate = dates[0].toLocaleDateString();
          const lastDate = dates[dates.length - 1].toLocaleDateString();
          dateRange = `${firstDate} - ${lastDate}`;
        }
      }
      
      return {
        type: 'SeizureTracker (Epilepsy)',
        entriesCount: seizures.length,
        medicationsCount: medications.length,
        dateRange
      };
    }
    
    // Detectar formato genérico con entries
    if (data.entries && Array.isArray(data.entries)) {
      return {
        type: 'Generic JSON',
        entriesCount: data.entries.length,
        medicationsCount: data.medications?.length || 0,
        dateRange: '-'
      };
    }
    
    // Formato desconocido
    return {
      type: 'Unknown Format',
      entriesCount: 0,
      medicationsCount: 0,
      dateRange: '-'
    };
  }

  confirmTrackingImport() {
    if (!this.trackingImportPreview || !this.currentPatient) return;
    
    this.trackingLoading = true;
    
    const payload = {
      userId: this.authService.getIdUser(),
      rawData: this.trackingImportPreview.rawData,
      detectedType: this.trackingImportPreview.type
    };
    
    this.subscription.add(
      this.http.post(environment.api + '/api/tracking/' + this.currentPatient + '/import', payload)
        .pipe(timeout(60000))
        .subscribe({
          next: (res: any) => {
            this.trackingLoading = false;
            if (res.success) {
              this.toastr.success('', this.translate.instant('tracking.importSuccess'));
              this.trackingData = res.data;
              this.trackingData.entries = this.trackingData.entries.map(e => ({
                ...e,
                date: new Date(e.date)
              }));
              this.calculateTrackingStats();
              this.populateSeizureTypes();
              this.populateAvailableYears();
              this.trackingStep = 4;
              this.initTrackingChartsWithRetry();
            } else {
              this.toastr.error('', res.message || this.translate.instant('tracking.importError'));
            }
          },
          error: (err) => {
            this.trackingLoading = false;
            this.toastr.error('', this.translate.instant('tracking.importError'));
            console.error('Error importing tracking data:', err);
          }
        })
    );
  }

  toggleTrigger(trigger: string) {
    const index = this.trackingManualEntry.triggers.indexOf(trigger);
    if (index === -1) {
      this.trackingManualEntry.triggers.push(trigger);
    } else {
      this.trackingManualEntry.triggers.splice(index, 1);
    }
  }

  saveManualEntry() {
    if (!this.trackingManualEntry.date || !this.currentPatient) return;
    
    this.trackingLoading = true;
    
    const payload = {
      userId: this.authService.getIdUser(),
      entry: {
        ...this.trackingManualEntry,
        date: new Date(this.trackingManualEntry.date)
      }
    };
    
    this.subscription.add(
      this.http.post(environment.api + '/api/tracking/' + this.currentPatient + '/entry', payload)
        .pipe(timeout(30000))
        .subscribe({
          next: (res: any) => {
            this.trackingLoading = false;
            if (res.success) {
              this.toastr.success('', this.translate.instant('tracking.entrySaved'));
              // Añadir la entrada a los datos locales
              this.trackingData.entries.unshift({
                ...payload.entry,
                date: new Date(payload.entry.date)
              });
              this.trackingData.conditionType = this.trackingManualEntry.conditionType;
              this.calculateTrackingStats();
              // Resetear formulario
              this.trackingManualEntry = {
                conditionType: this.trackingManualEntry.conditionType,
                date: '',
                type: '',
                duration: 0,
                severity: 5,
                triggers: [],
                notes: ''
              };
              this.trackingStep = 4;
              this.initTrackingChartsWithRetry();
            } else {
              this.toastr.error('', res.message || this.translate.instant('tracking.saveError'));
            }
          },
          error: (err) => {
            this.trackingLoading = false;
            this.toastr.error('', this.translate.instant('tracking.saveError'));
            console.error('Error saving entry:', err);
          }
        })
    );
  }

  calculateTrackingStats() {
    const entries = this.trackingData.entries;
    if (entries.length === 0) {
      this.trackingStats = {
        totalEvents: 0,
        daysSinceLast: 0,
        monthlyAvg: 0,
        trend: '',
        trendPercent: 0
      };
      return;
    }
    
    // Total eventos
    this.trackingStats.totalEvents = entries.length;
    
    // Días desde el último evento
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastEventDate = new Date(sortedEntries[0].date);
    const today = new Date();
    this.trackingStats.daysSinceLast = Math.floor(
      (today.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Promedio mensual
    if (entries.length > 1) {
      const firstDate = new Date(sortedEntries[sortedEntries.length - 1].date);
      const months = Math.max(1, 
        (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      this.trackingStats.monthlyAvg = entries.length / months;
    } else {
      this.trackingStats.monthlyAvg = entries.length;
    }
    
    // Calcular tendencia (comparar últimos 3 meses vs 3 meses anteriores)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const recentCount = entries.filter(e => new Date(e.date) >= threeMonthsAgo).length;
    const previousCount = entries.filter(e => {
      const date = new Date(e.date);
      return date >= sixMonthsAgo && date < threeMonthsAgo;
    }).length;
    
    if (previousCount > 0) {
      const diff = recentCount - previousCount;
      this.trackingStats.trendPercent = Math.abs(Math.round((diff / previousCount) * 100));
      this.trackingStats.trend = diff < 0 ? 'improving' : (diff > 0 ? 'worsening' : '');
    } else {
      this.trackingStats.trend = '';
      this.trackingStats.trendPercent = 0;
    }
  }

  initTrackingChartsWithRetry(attempt = 0, maxAttempts = 10) {
    // Pequeño delay para que el modal renderice el DOM
    setTimeout(() => {
      // Buscar canvas por ID (ViewChild no funciona dentro de ng-template/modal)
      const canvas = document.getElementById('trackingEvolutionChart') as HTMLCanvasElement;
      if (canvas) {
        console.log('initTrackingChartsWithRetry: canvas encontrado');
        this.initTrackingCharts();
        
        // Forzar resize después de crear las gráficas
        setTimeout(() => {
          if (this.trackingEvolutionChart) {
            this.trackingEvolutionChart.resize();
          }
          if (this.trackingTimeChart) {
            this.trackingTimeChart.resize();
          }
        }, 100);
      } else if (attempt < maxAttempts) {
        console.log('initTrackingChartsWithRetry: intento', attempt, '- canvas no disponible');
        this.initTrackingChartsWithRetry(attempt + 1, maxAttempts);
      } else {
        console.warn('No se pudo inicializar gráficos de tracking: canvas no disponible');
      }
    }, 200);
  }

  initTrackingCharts() {
    // Destruir gráficos existentes
    if (this.trackingEvolutionChart) {
      this.trackingEvolutionChart.destroy();
      this.trackingEvolutionChart = null;
    }
    if (this.trackingTimeChart) {
      this.trackingTimeChart.destroy();
      this.trackingTimeChart = null;
    }
    
    // Buscar canvas por ID (ViewChild no funciona dentro de ng-template/modal)
    const canvas = document.getElementById('trackingEvolutionChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('initTrackingCharts: canvas no disponible');
      return;
    }
    
    // Verificar y destruir charts existentes en canvas
    const existingEvolutionChart = Chart.getChart(canvas);
    if (existingEvolutionChart) {
      existingEvolutionChart.destroy();
    }
    
    const timeCanvas = document.getElementById('trackingTimeChart') as HTMLCanvasElement;
    if (timeCanvas) {
      const existingTimeChart = Chart.getChart(timeCanvas);
      if (existingTimeChart) {
        existingTimeChart.destroy();
      }
    }
    
    const entries = this.trackingData.entries;
    if (!entries || entries.length === 0) {
      console.warn('initTrackingCharts: no hay entries');
      return;
    }
    
    // Agrupar por mes
    const monthlyData: { [key: string]: number } = {};
    entries.forEach(entry => {
      const date = new Date(entry.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + 1;
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(m => {
      const [year, month] = m.split('-');
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', { month: 'short', year: '2-digit' });
    });
    const data = sortedMonths.map(m => monthlyData[m]);
    
    console.log('initTrackingCharts: creando chart con', { labels, data, entries: entries.length });
    
    // Gráfico de evolución - Chart.js v4
    try {
      this.trackingEvolutionChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: this.translate.instant('tracking.events'),
            data: data,
            borderColor: '#00897b',
            backgroundColor: 'rgba(0, 137, 123, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#00897b'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { 
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            },
            x: {
              ticks: {
                autoSkip: true,
                maxTicksLimit: 12
              }
            }
          }
        }
      });
      console.log('initTrackingCharts: chart de evolución creado', this.trackingEvolutionChart);
    } catch (err) {
      console.error('initTrackingCharts: error creando chart de evolución', err);
    }
    
    // Gráfico de distribución horaria (solo para epilepsia)
    if (this.trackingData.conditionType === 'epilepsy' && timeCanvas) {
      const hourlyData = new Array(24).fill(0);
      entries.forEach(entry => {
        const hour = new Date(entry.date).getHours();
        hourlyData[hour]++;
      });
      
      try {
        this.trackingTimeChart = new Chart(timeCanvas, {
          type: 'bar',
          data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
              label: this.translate.instant('tracking.events'),
              data: hourlyData,
              backgroundColor: 'rgba(156, 39, 176, 0.6)',
              borderColor: '#9c27b0',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { 
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            }
          }
        });
        console.log('initTrackingCharts: chart horario creado');
      } catch (err) {
        console.error('initTrackingCharts: error creando chart horario', err);
      }
    }
    
    // Crear gráfico combinado de crisis vs medicación
    this.initCombinedChart();
  }

  // Poblar tipos de crisis disponibles para el filtro
  populateSeizureTypes() {
    const types = new Set<string>();
    this.trackingData.entries.forEach(entry => {
      if (entry.type) types.add(entry.type);
    });
    this.availableSeizureTypes = Array.from(types);
  }

  // Poblar años disponibles para el slicer
  populateAvailableYears() {
    const years = new Set<number>();
    this.trackingData.entries.forEach(entry => {
      const year = new Date(entry.date).getFullYear();
      if (!isNaN(year)) years.add(year);
    });
    this.availableYears = Array.from(years).sort((a, b) => a - b);
    // Por defecto seleccionar todos los años
    if (this.trackingFilters.selectedYears.length === 0) {
      this.trackingFilters.selectedYears = [...this.availableYears];
    }
  }

  // Toggle selección de año individual
  toggleYearSelection(year: number) {
    const idx = this.trackingFilters.selectedYears.indexOf(year);
    if (idx > -1) {
      this.trackingFilters.selectedYears.splice(idx, 1);
    } else {
      this.trackingFilters.selectedYears.push(year);
    }
    this.onTrackingFilterChange();
  }

  // Seleccionar/deseleccionar todos los años
  toggleAllYears() {
    if (this.trackingFilters.selectedYears.length === this.availableYears.length) {
      this.trackingFilters.selectedYears = [];
    } else {
      this.trackingFilters.selectedYears = [...this.availableYears];
    }
    this.onTrackingFilterChange();
  }

  // Verificar si un año está seleccionado
  isYearSelected(year: number): boolean {
    return this.trackingFilters.selectedYears.includes(year);
  }

  // Obtener rango de fechas según filtro
  getFilteredDateRange(): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate = new Date(0); // Fecha mínima
    let endDate = new Date();
    
    switch (this.trackingFilters.dateRange) {
      case '1year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '1month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'custom':
        if (this.trackingFilters.customStartDate) {
          startDate = new Date(this.trackingFilters.customStartDate);
        }
        if (this.trackingFilters.customEndDate) {
          endDate = new Date(this.trackingFilters.customEndDate);
        }
        break;
      case 'all':
      default:
        // Usar el rango completo de los datos
        if (this.trackingData.entries.length > 0) {
          const dates = this.trackingData.entries.map(e => new Date(e.date).getTime());
          startDate = new Date(Math.min(...dates));
          endDate = new Date(Math.max(...dates));
        }
        break;
    }
    
    return { startDate, endDate };
  }

  // Calcular fecha mínima para el gráfico considerando años seleccionados
  getChartMinDate(fallbackDate: Date): Date {
    // Si hay años seleccionados y no son todos, usar el primer año seleccionado
    if (this.trackingFilters.selectedYears.length > 0 && 
        this.trackingFilters.selectedYears.length < this.availableYears.length) {
      const minYear = Math.min(...this.trackingFilters.selectedYears);
      return new Date(minYear, 0, 1);
    }
    return fallbackDate;
  }

  // Calcular fecha máxima para el gráfico considerando años seleccionados
  getChartMaxDate(fallbackDate: Date): Date {
    // Si hay años seleccionados y no son todos, usar el último año seleccionado
    if (this.trackingFilters.selectedYears.length > 0 && 
        this.trackingFilters.selectedYears.length < this.availableYears.length) {
      const maxYear = Math.max(...this.trackingFilters.selectedYears);
      return new Date(maxYear, 11, 31);
    }
    // Si es todo el historial, usar fecha actual como máximo
    if (this.trackingFilters.dateRange === 'all') {
      return new Date();
    }
    return fallbackDate;
  }

  // Filtrar entries según filtros activos
  getFilteredEntries(): Array<any> {
    const { startDate, endDate } = this.getFilteredDateRange();
    
    return this.trackingData.entries.filter(entry => {
      const entryDate = new Date(entry.date);
      
      // Filtro por fecha
      if (entryDate < startDate || entryDate > endDate) return false;
      
      // Filtro por años seleccionados
      if (this.trackingFilters.selectedYears.length > 0 && 
          this.trackingFilters.selectedYears.length < this.availableYears.length) {
        const year = entryDate.getFullYear();
        if (!this.trackingFilters.selectedYears.includes(year)) return false;
      }
      
      // Filtro por tipo de crisis
      if (this.trackingFilters.seizureType !== 'all' && entry.type !== this.trackingFilters.seizureType) {
        return false;
      }
      
      return true;
    });
  }

  // Actualizar gráficos cuando cambian filtros
  onTrackingFilterChange() {
    this.initTrackingCharts();
  }

  // Manejar cambio de rango de fechas
  onDateRangeChange() {
    // Habilitar/deshabilitar campos de fecha personalizada
    if (this.trackingFilters.dateRange === 'custom') {
      // Establecer fechas por defecto si no están definidas
      if (!this.trackingFilters.customStartDate && this.trackingData.entries.length > 0) {
        const dates = this.trackingData.entries.map(e => new Date(e.date).getTime());
        const minDate = new Date(Math.min(...dates));
        this.trackingFilters.customStartDate = minDate.toISOString().split('T')[0];
        this.trackingFilters.customEndDate = new Date().toISOString().split('T')[0];
      }
    }
    this.onTrackingFilterChange();
  }

  // Inicializar gráfico combinado de Crisis vs Medicación
  initCombinedChart() {
    // Destruir chart existente si lo hay
    if (this.trackingCombinedChart) {
      this.trackingCombinedChart.destroy();
      this.trackingCombinedChart = null;
    }
    
    const canvas = document.getElementById('trackingCombinedChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('initCombinedChart: canvas no disponible');
      return;
    }
    
    // También verificar si hay un chart existente en el canvas usando Chart.getChart
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }
    
    const entries = this.getFilteredEntries();
    const medications = this.trackingData.medications || [];
    const { startDate, endDate } = this.getFilteredDateRange();
    
    if (entries.length === 0) {
      console.warn('initCombinedChart: no hay entries filtradas');
      return;
    }
    
    // Agrupar crisis según el filtro
    const groupedData: { [key: string]: number } = {};
    entries.forEach(entry => {
      const date = new Date(entry.date);
      let key: string;
      
      switch (this.trackingFilters.groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'year':
          key = `${date.getFullYear()}`;
          break;
        case 'month':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }
      
      groupedData[key] = (groupedData[key] || 0) + 1;
    });
    
    const sortedKeys = Object.keys(groupedData).sort();
    const seizureLabels = sortedKeys;
    const seizureValues = sortedKeys.map(k => groupedData[k]);
    
    // Convertir labels a fechas para el eje X
    const seizureDataPoints = sortedKeys.map((k, idx) => {
      let date: Date;
      if (this.trackingFilters.groupBy === 'day') {
        date = new Date(k);
      } else if (this.trackingFilters.groupBy === 'year') {
        date = new Date(parseInt(k), 0, 1);
      } else {
        const [year, month] = k.split('-');
        date = new Date(parseInt(year), parseInt(month) - 1, 1);
      }
      return { x: date, y: seizureValues[idx] };
    });
    
    // Preparar datasets de medicación
    const medDatasets: any[] = [];
    const medChanges: Array<{ date: Date; medication: string; dose: number; type: string }> = [];
    const colors = ['#4caf50', '#ffc107', '#2196f3', '#9c27b0', '#00bcd4', '#ff5722', '#795548'];
    
    // Agrupar medicamentos por nombre
    const medGroups: { [key: string]: any[] } = {};
    medications.forEach(med => {
      const medStartDate = new Date(med.startDate);
      const medEndDate = med.endDate ? new Date(med.endDate) : new Date();
      
      // Filtrar por rango de fechas
      if (this.trackingFilters.dateRange !== 'all') {
        if (medEndDate < startDate || medStartDate > endDate) return;
      }
      
      // Filtrar por años seleccionados
      if (this.trackingFilters.selectedYears.length > 0 && 
          this.trackingFilters.selectedYears.length < this.availableYears.length) {
        const medStartYear = medStartDate.getFullYear();
        const medEndYear = medEndDate.getFullYear();
        // Incluir si el medicamento cubre alguno de los años seleccionados
        const overlapsSelectedYears = this.trackingFilters.selectedYears.some(
          year => year >= medStartYear && year <= medEndYear
        );
        if (!overlapsSelectedYears) return;
      }
      
      if (!medGroups[med.name]) medGroups[med.name] = [];
      medGroups[med.name].push({
        ...med,
        startDate: medStartDate,
        endDate: medEndDate,
        dailyDose: this.parseDose(med.dose)
      });
    });
    
    let colorIdx = 0;
    Object.keys(medGroups).forEach(medName => {
      const meds = medGroups[medName].sort((a: any, b: any) => a.startDate - b.startDate);
      const dataPoints: any[] = [];
      
      meds.forEach((med: any, idx: number) => {
        let visibleStartDate = med.startDate;
        let visibleEndDate = med.endDate;
        
        if (this.trackingFilters.dateRange !== 'all') {
          if (visibleStartDate < startDate) visibleStartDate = startDate;
          if (visibleEndDate > endDate) visibleEndDate = endDate;
        }
        
        // Marcar cambios de medicación
        if (idx === 0 || meds[idx - 1].dailyDose !== med.dailyDose) {
          medChanges.push({ date: visibleStartDate, medication: medName, dose: med.dailyDose, type: 'change' });
        }
        
        dataPoints.push({ x: visibleStartDate, y: med.dailyDose });
        dataPoints.push({ x: visibleEndDate, y: med.dailyDose });
        dataPoints.push({ x: visibleEndDate, y: null }); // Romper línea
      });
      
      medDatasets.push({
        label: medName,
        data: dataPoints,
        borderColor: colors[colorIdx % colors.length],
        backgroundColor: 'transparent',
        borderWidth: 3,
        stepped: true,
        yAxisID: 'y1',
        pointRadius: 0,
        pointHoverRadius: 4
      });
      colorIdx++;
    });
    
    // Calcular escalas
    const maxSeizure = Math.max(...seizureValues);
    const userMaxSeizure = this.trackingFilters.maxSeizureScale;
    const maxSeizureScale = userMaxSeizure || Math.ceil(maxSeizure * 1.1);
    
    let autoMaxMedScale = 100;
    medDatasets.forEach(ds => {
      ds.data.forEach((point: any) => {
        if (point.y && point.y > autoMaxMedScale) autoMaxMedScale = point.y;
      });
    });
    const maxMedScale = this.trackingFilters.maxMedicationScale || Math.ceil(autoMaxMedScale * 1.1);
    
    // Preparar anotaciones para cambios de medicación
    const annotations: any = {};
    if (this.trackingFilters.showMedicationChanges) {
      medChanges.forEach((change, idx) => {
        annotations[`line${idx}`] = {
          type: 'line',
          xMin: change.date,
          xMax: change.date,
          borderColor: 'rgba(255, 99, 132, 0.5)',
          borderWidth: 2,
          borderDash: [6, 6],
          label: {
            display: true,
            content: `${change.medication}: ${change.dose}mg`,
            position: 'start',
            backgroundColor: 'rgba(255, 99, 132, 0.8)',
            color: 'white',
            font: { size: 10 }
          }
        };
      });
    }
    
    try {
      this.trackingCombinedChart = new Chart(canvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: this.translate.instant('tracking.crisisFrequency'),
              data: seizureDataPoints,
              borderColor: '#dc3545',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              yAxisID: 'y',
              order: 2
            },
            ...medDatasets
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { usePointStyle: true }
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  let label = context.dataset.label || '';
                  if (label) label += ': ';
                  if (context.dataset.yAxisID === 'y1') {
                    label += context.parsed.y + ' mg';
                  } else {
                    label += context.parsed.y + ' ' + this.translate.instant('tracking.crisis');
                  }
                  return label;
                }
              }
            },
            annotation: {
              annotations: annotations
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: this.trackingFilters.groupBy === 'day' ? 'day' : (this.trackingFilters.groupBy === 'year' ? 'year' : 'month'),
                displayFormats: {
                  day: 'dd/MM',
                  month: 'MMM yyyy',
                  year: 'yyyy'
                }
              },
              title: { display: true, text: this.translate.instant('tracking.date') },
              min: this.getChartMinDate(startDate).getTime(),
              max: this.getChartMaxDate(endDate).getTime()
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: { display: true, text: this.translate.instant('tracking.crisisFrequency') },
              beginAtZero: true,
              max: maxSeizureScale
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: { display: true, text: this.translate.instant('tracking.medicationDose') },
              grid: { drawOnChartArea: false },
              beginAtZero: true,
              max: maxMedScale
            }
          }
        }
      });
      console.log('initCombinedChart: gráfico combinado creado');
    } catch (err) {
      console.error('initCombinedChart: error creando gráfico combinado', err);
    }
  }

  // Parsear dosis de medicamento (ej: "1200mg" -> 1200)
  parseDose(doseStr: string): number {
    if (!doseStr) return 0;
    const match = doseStr.toString().match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  generateTrackingInsights() {
    if (!this.currentPatient || this.trackingData.entries.length === 0) return;
    
    this.trackingLoading = true;
    
    const payload = {
      userId: this.authService.getIdUser(),
      lang: localStorage.getItem('lang') || 'en'
    };
    
    this.subscription.add(
      this.http.post(environment.api + '/api/tracking/' + this.currentPatient + '/insights', payload)
        .pipe(timeout(60000))
        .subscribe({
          next: (res: any) => {
            this.trackingLoading = false;
            if (res.success && res.insights) {
              this.trackingInsights = res.insights;
              this.toastr.success('', this.translate.instant('tracking.insightsGenerated'));
            }
          },
          error: (err) => {
            this.trackingLoading = false;
            this.toastr.error('', this.translate.instant('tracking.insightsError'));
            console.error('Error generating insights:', err);
          }
        })
    );
  }

  exportTrackingData() {
    const dataStr = JSON.stringify(this.trackingData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracking_${this.trackingData.conditionType}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.toastr.success('', this.translate.instant('tracking.exported'));
  }

  // Eliminar todos los datos de epilepsia
  deleteCurrentCondition() {
    Swal.fire({
      title: this.translate.instant('epilepsy.confirmDeleteCondition'),
      text: this.translate.instant('epilepsy.confirmDeleteCondition'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: this.translate.instant('generics.Delete'),
      cancelButtonText: this.translate.instant('generics.Cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.trackingLoading = true;
        const url = environment.api + '/api/tracking/' + this.currentPatient;
        
        this.subscription.add(
          this.http.delete(url)
            .pipe(timeout(30000))
            .subscribe({
              next: (res: any) => {
                this.trackingLoading = false;
                if (res.success) {
                  this.toastr.success('', this.translate.instant('tracking.dataDeleted'));
                  // Resetear datos locales
                  this.trackingData.entries = [];
                  this.trackingData.medications = [];
                  this.trackingInsights = [];
                  this.trackingStep = 1;
                }
              },
              error: (err) => {
                this.trackingLoading = false;
                this.toastr.error('', this.translate.instant('generics.error try again'));
                console.error('Error deleting tracking data:', err);
              }
            })
        );
      }
    });
  }

  // Eliminar entradas en un rango de fechas
  deleteEntriesInRange() {
    if (!this.deleteRangeStart || !this.deleteRangeEnd) {
      this.toastr.warning('', this.translate.instant('tracking.selectDateRange'));
      return;
    }

    Swal.fire({
      title: this.translate.instant('tracking.confirmDeleteTitle'),
      text: this.translate.instant('tracking.confirmDeleteRange'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: this.translate.instant('generics.Delete'),
      cancelButtonText: this.translate.instant('generics.Cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.trackingLoading = true;
        const payload = {
          conditionType: this.trackingData.conditionType,
          startDate: this.deleteRangeStart,
          endDate: this.deleteRangeEnd
        };
        
        this.subscription.add(
          this.http.post(environment.api + '/api/tracking/' + this.currentPatient + '/delete-range', payload)
            .pipe(timeout(30000))
            .subscribe({
              next: (res: any) => {
                this.trackingLoading = false;
                if (res.success) {
                  this.toastr.success('', this.translate.instant('tracking.entriesDeleted'));
                  this.trackingData = res.data;
                  this.trackingData.entries = this.trackingData.entries.map(e => ({
                    ...e,
                    date: new Date(e.date)
                  }));
                  this.calculateTrackingStats();
                  this.populateSeizureTypes();
                  this.populateAvailableYears();
                  this.initTrackingChartsWithRetry();
                  this.deleteRangeStart = '';
                  this.deleteRangeEnd = '';
                }
              },
              error: (err) => {
                this.trackingLoading = false;
                this.toastr.error('', this.translate.instant('generics.error try again'));
                console.error('Error deleting entries:', err);
              }
            })
        );
      }
    });
  }

  getConditionIcon(condition: string): string {
    const icons: { [key: string]: string } = {
      epilepsy: 'fa fa-brain',
      diabetes: 'fa fa-tint',
      migraine: 'fa fa-head-side-virus',
      custom: 'fa fa-heartbeat'
    };
    return icons[condition] || 'fa fa-heartbeat';
  }

  getConditionLabel(condition: string): string {
    return this.translate.instant('tracking.conditions.' + condition);
  }

  getNotes() {
    this.patientService.getPatientNotes(this.currentPatient).subscribe((res: any) => {
      //sort by date
      res.notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.notes = res.notes;
    });
  }

  cancelEdit() {
    this.newNoteContent = '';
    this.modalService.dismissAll();
  }

  addNote(addNoteModal) {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    // Inicializar el contenido vacío
    this.newNoteContent = '';
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg'// xl, lg, sm
    };
    this.modalReference = this.modalService.open(addNoteModal, ngbModalOptions);
  }

  onNewNoteContentChange(event: any) {
    // Actualizar el contenido cuando cambia en el editor de nueva nota
    if (event) {
      const content = typeof event === 'string' ? event : (event.html || event);
      this.newNoteContent = content;
    }
  }

  onNewNoteEditorCreated(editor: any) {
    // El editor se inicializa vacío, no necesitamos establecer contenido
    // Pero podemos usarlo para limpiar si es necesario
  }

  saveNote() {
    // Obtener el texto plano para validar que no esté vacío
    const plainText = this.getPlainText(this.newNoteContent || '');
    if (plainText.trim()) {
      this.savingNote = true;
      this.patientService.savePatientNote(this.currentPatient, { content: this.newNoteContent, date: new Date() }).subscribe((res: any) => {
        if (res.message == 'Notes saved') {
          Swal.fire('', this.translate.instant("notes.Note saved"), "success");
          this.notes.unshift({ content: this.newNoteContent, date: new Date(), _id: res.noteId });
          this.notesSidebarOpen = true;
          if (this.isSmallScreen && this.sidebarOpen) {
            this.sidebarOpen = false;
          }
          // Cerrar el modal de agregar nota
          this.cancelEdit();
        }
        this.savingNote = false;
      });
    }
  }

  addNoteWithMessage(message: string) {
    this.savingNote = true;
    this.patientService.savePatientNote(this.currentPatient, { content: message, date: new Date() }).subscribe((res: any) => {
      if (res.message == 'Notes saved') {
        Swal.fire('', this.translate.instant("notes.Note saved"), "success");
        this.notes.unshift({ content: message, date: new Date(), _id: res.noteId });
        this.notesSidebarOpen = true;
        if (this.isSmallScreen && this.sidebarOpen) {
          this.sidebarOpen = false;
        }
        // No cerramos modales aquí para no afectar otros modales abiertos (como el resumen del paciente)
       //this.modalService.dismissAll();
      }
      this.savingNote = false;
    });

  }

  deleteNote(index: number) {
    Swal.fire({
      title: this.translate.instant("generics.Are you sure?"),
      text: this.translate.instant("notes.Delete confirmation"),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0CC27E',
      cancelButtonColor: '#FF586B',
      confirmButtonText: this.translate.instant("notes.Delete Note"),
      cancelButtonText: this.translate.instant("generics.Cancel"),
      showLoaderOnConfirm: true,
      allowOutsideClick: false,
      reverseButtons: true
    }).then((result) => {
      if (result.value) {
        this.deletingNote = true;
        this.patientService.deletePatientNote(this.currentPatient, this.notes[index]._id)
          .pipe(
            finalize(() => {
              this.deletingNote = false;
            })
          )
          .subscribe({
            next: (res: any) => {
              if (res.message == 'The note has been eliminated') {
                this.notes.splice(index, 1);
                this.toastr.success('', this.translate.instant("generics.Deleted successfully"));
              }
            },
            error: (err) => {
              console.log(err);
              this.insightsService.trackException(err);
              this.toastr.error('', this.translate.instant("generics.error try again"));
            }
          });
      }
    });
  }

  editNote(index: number, editNoteModal: TemplateRef<any>) {
    const note = this.notes[index];
    // Inicializar el contenido de edición con el contenido actual
    note.editContent = note.content || '';
    this.editingNoteIndex = index;
    
    // Abrir modal de edición
    const ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg'
    };
    this.modalReference = this.modalService.open(editNoteModal, ngbModalOptions);
  }

  saveNoteEdit() {
    if (this.editingNoteIndex === null || this.editingNoteIndex === undefined) return;
    
    this.savingNote = true;
    const note = this.notes[this.editingNoteIndex];

    // Usar editContent que contiene el HTML del editor Quill
    const content = note.editContent || '';

    const updatedNote = {
      _id: note._id,
      content: content,
      date: new Date()
    };

    this.subscription.add(
      this.http.put(environment.api + '/api/notes/'+this.authService.getCurrentPatient().sub + '/' + note._id+'/'+this.authService.getIdUser(), updatedNote)
        .pipe(finalize(() => {
          this.savingNote = false;
        }))
        .subscribe({
          next: (res: any) => {
            if(res.message == 'Note updated'){
              this.notes[this.editingNoteIndex] = {
                ...updatedNote,
                editContent: undefined
              };
              this.closeEditNoteModal();
              this.toastr.success('', this.translate.instant("generics.Updated successfully"));
            }else{
              this.toastr.error('', this.translate.instant("generics.error try again"));
            }
          },

          error: (err) => {
            console.log(err);
            this.insightsService.trackException(err);
            this.toastr.error('', this.translate.instant("generics.error try again"));
          }
        })
    );
  }

  cancelNoteEdit() {
    if (this.editingNoteIndex !== null && this.editingNoteIndex !== undefined) {
      const note = this.notes[this.editingNoteIndex];
      note.editContent = undefined;
    }
    this.closeEditNoteModal();
  }

  closeEditNoteModal() {
    if (this.modalReference) {
      this.modalReference.close();
    }
    this.editingNoteIndex = null;
  }

  onNoteContentChange(event: any) {
    // Actualizar el contenido cuando cambia en el modal
    if (event && this.editingNoteIndex !== null && this.editingNoteIndex !== undefined) {
      const content = typeof event === 'string' ? event : (event.html || event);
      this.notes[this.editingNoteIndex].editContent = content;
    }
  }

  onEditorCreated(editor: any) {
    // Establecer el contenido cuando el editor esté listo en el modal
    if (editor && this.editingNoteIndex !== null && this.editingNoteIndex !== undefined) {
      const note = this.notes[this.editingNoteIndex];
      const content = note.editContent || note.content || '';
      if (content && editor.root) {
        // Usar setTimeout para asegurar que el editor esté completamente inicializado
        setTimeout(() => {
          try {
            // Convertir HTML a Delta de Quill y establecerlo
            if (editor.clipboard && typeof editor.clipboard.convert === 'function') {
              const delta = editor.clipboard.convert(content);
              editor.setContents(delta, 'silent');
              this.notes[this.editingNoteIndex].editContent = editor.root.innerHTML;
            } else {
              editor.root.innerHTML = content;
              this.notes[this.editingNoteIndex].editContent = content;
            }
            this.cdr.detectChanges();
          } catch (e) {
            console.error('Error setting content in editor:', e);
            if (editor.root) {
              editor.root.innerHTML = content;
              this.notes[this.editingNoteIndex].editContent = content;
              this.cdr.detectChanges();
            }
          }
        }, 100);
      }
    }
  }



  // Función para obtener el texto plano de HTML (sin etiquetas)
  getPlainText(html: string): string {
    if (!html) return '';
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // Función para truncar contenido HTML manteniendo el formato
  truncateNoteContent(content: string, maxLength: number = 500): { truncated: string, isTruncated: boolean } {
    if (!content) return { truncated: '', isTruncated: false };
    
    const plainText = this.getPlainText(content);
    if (plainText.length <= maxLength) {
      return { truncated: content, isTruncated: false };
    }

    // Truncar el texto plano
    const truncatedText = plainText.substring(0, maxLength);
    // Intentar mantener el formato HTML truncando de manera simple
    // Por simplicidad, truncamos el HTML directamente en una posición segura
    const truncatedHtml = content.substring(0, Math.min(content.length, maxLength * 2));
    
    return { truncated: truncatedHtml + '...', isTruncated: true };
  }

  // Abrir modal con contenido completo de la nota
  viewFullNote(note: any, noteModal: TemplateRef<any>) {
    const ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-lg'
    };
    this.selectedNoteForModal = note;
    this.modalReference = this.modalService.open(noteModal, ngbModalOptions);
  }

  closeNoteModal() {
    if (this.modalReference) {
      this.modalReference.close();
    }
  }

  truncateTitle(title: string, limit: number = 32): string {
    if (title.length <= limit) return title;
    return title.slice(0, limit) + '...';
  }

  searchDocs() {
    if (!this.searchTerm) {
      this.filteredDocs = this.docs;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredDocs = this.docs.filter(doc =>
      doc.title.toLowerCase().includes(term) ||
      doc.categoryTag.toLowerCase().includes(term) ||
      (doc.originaldate && new Date(doc.originaldate).toLocaleDateString().includes(term))
    );
    this.selectAllDocuments = this.filteredDocs.length > 0 && this.filteredDocs.every(doc => doc.selected);
  }

  /**
   * Verifica si el paciente tiene un resumen generado
   */
  async checkPatientSummary(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.currentPatient) {
        resolve(false);
        return;
      }
      
      const info = { 
        "userId": this.authService.getIdUser(), 
        "idWebpubsub": this.authService.getIdUser(), 
        "regenerate": false 
      };
      
      this.subscription.add(
        this.http.post(environment.api + '/api/patient/summary/' + this.currentPatient, info)
          .subscribe(
            (res: any) => {
              // Si summary es 'true', el resumen existe y está listo
              resolve(res.summary === 'true');
            },
            (err) => {
              console.warn('Error checking patient summary:', err);
              // En caso de error, asumir que no existe
              resolve(false);
            }
          )
      );
    });
  }

  /**
   * Ejecuta fetchDxGptResults después de verificar/crear el resumen
   * @param useEventsAndDocuments - Si true, usa eventos/documentos en lugar del resumen
   */
  private executeFetchDxGptResults(useEventsAndDocuments: boolean = false) {
    console.log('=== FRONTEND DXGPT DEBUG START ===');
    console.log('1. Current patient ID:', this.currentPatientId);
    
    if (!this.currentPatientId) {
      console.error("No patient selected to fetch DxGPT results.");
      this.dxGptResults = { success: false, analysis: this.translate.instant('patients.No patient selected') };
      return;
    }

    console.log('2. Setting loading state...');
    this.isDxGptLoading = true;
    this.dxGptResults = null; // Limpiar resultados anteriores

    console.log('3. Calling API service...');
    // Get current language from localStorage
    const currentLang = localStorage.getItem('lang') || 'en';
    // Call the DxGPT API to get initial diagnosis
    this.apiDx29ServerService.getDifferentialDiagnosis(this.currentPatientId, currentLang, null, undefined, useEventsAndDocuments).subscribe({
      next: (res: any) => {
        console.log('4. API Response received:', res);
        console.log('4.1. res.success:', res.success);
        console.log('4.2. res.analysis exists:', !!res.analysis);
        console.log('4.3. res.async exists:', res.async);
        
        // Si el procesamiento es asíncrono, esperar notificaciones de WebPubSub
        if (res.async === true) {
          console.log('5. Procesamiento asíncrono iniciado, esperando notificaciones...');
          // El estado de carga se mantendrá hasta recibir el resultado por WebPubSub
          // Mostrar mensaje informativo con botón de cancelar
          const message = res.message || this.translate.instant('dxgpt.async.message') || 'El análisis está en proceso. Recibirás una notificación cuando esté listo.';
          const timeMessage = this.translate.instant('dxgpt.async.timeMessage') || 'Este proceso puede tardar varios minutos dependiendo del número de documentos.';
          
          Swal.fire({
            title: this.translate.instant('dxgpt.async.processing') || 'Procesando...',
            html: `<div style="text-align: left;">
              <p><strong>${message}</strong></p>
              <p style="font-size: 0.9em; color: #666; margin-top: 10px;"><em>${timeMessage}</em></p>
            </div>`,
            icon: 'info',
            allowOutsideClick: false,
            allowEscapeKey: true,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: this.translate.instant('dxgpt.async.cancel') || 'Cancelar',
            cancelButtonColor: '#6c757d',
            didOpen: () => {
              Swal.showLoading();
            }
          }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel || result.dismiss === Swal.DismissReason.esc || result.dismiss === Swal.DismissReason.backdrop) {
              // Usuario canceló
              console.log('Usuario canceló el procesamiento de DxGPT');
              this.isDxGptLoading = false;
              this.dxGptResults = null;
              this.cdr.detectChanges();
              
              Swal.fire({
                title: this.translate.instant('dxgpt.async.cancelled') || 'Procesamiento cancelado',
                text: this.translate.instant('dxgpt.async.cancelledMessage') || 'El análisis ha sido cancelado. Puedes iniciarlo nuevamente cuando lo desees.',
                icon: 'info',
                confirmButtonText: 'OK'
              });
            }
          });
          return; // No cambiar el estado de carga todavía
        }
        
        if (res && res.analysis) {
           // El backend siempre manda success: true si llega al controller
           // Así que sólo necesitamos verificar que 'analysis' tenga contenido.
          console.log('5. Setting success result');
          this.dxGptResults = res; // res ya debería tener { success: true, analysis: "..." }
          console.log('5.1. this.dxGptResults assigned:', this.dxGptResults);
          console.log('5.2. this.isDxGptLoading:', this.isDxGptLoading);
          
          // Forzar la detección de cambios
          this.cdr.detectChanges();
        } else {
          // Si analysis está vacío o no vino como se esperada.
          // El backend actual SIEMPRE devuelve 'analysis', incluso para errores o mocks.
          // Este caso es por si el backend cambia o hay un error inesperado
          // que no fue un error HTTP.
          console.log('6. Analysis is empty, setting error result');
          this.dxGptResults = {
            success: false, // Marcar como no exitoso para la UI si es necesario
            analysis: this.translate.instant('dxgpt.errorMessage') // Mensaje genérico
          };
        }
        this.isDxGptLoading = false;
        console.log('=== FRONTEND DXGPT DEBUG END SUCCESS ===');
      },
      error: (error) => {
        // Error de red o HTTP 500, etc. (no un error "controlado" por aiFeaturesController)
        console.log('=== FRONTEND DXGPT DEBUG ERROR ===');
        console.error('Error fetching DxGPT results:', error);
        this.dxGptResults = {
          success: false, // Importante para la condición de error en el HTML
          analysis: this.translate.instant('dxgpt.errorMessage') // O un error más específico si 'error' lo proporciona
        };
        this.isDxGptLoading = false;
      }
    });
  }

  /**
   * Función principal que verifica el resumen antes de ejecutar DxGPT
   */
  async fetchDxGptResults() {
    if (!this.currentPatientId) {
      this.dxGptResults = { success: false, analysis: this.translate.instant('patients.No patient selected') };
      return;
    }

    // Verificar si el paciente tiene un resumen generado
    const hasSummary = await this.checkPatientSummary();
    
    if (hasSummary) {
      // Si tiene resumen, preguntar al usuario qué método quiere usar
      const result = await Swal.fire({
        title: this.translate.instant('dxgpt.chooseMethod.title') || 'Elegir método de análisis',
        html: this.translate.instant('dxgpt.chooseMethod.message') || 
              'El paciente tiene un resumen generado. ¿Cómo deseas realizar el análisis?<br><br>' +
              '<small><strong>Resumen del paciente:</strong> Más rápido, incluye información estructurada y contextualizada.<br>' +
              '<strong>Eventos y documentos:</strong> Incluye información más reciente que pueda no estar en el resumen.</small>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: this.translate.instant('dxgpt.chooseMethod.withSummary') || 'Analizar con resumen del paciente',
        cancelButtonText: this.translate.instant('dxgpt.chooseMethod.withEvents') || 'Analizar con eventos y documentos',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#6c757d',
        reverseButtons: true,
        showCloseButton: true
      });

      if (result.isConfirmed) {
        // Usuario quiere usar el resumen
        this.executeFetchDxGptResults(false);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // Usuario quiere usar eventos y documentos
        this.executeFetchDxGptResults(true);
      } else {
        // Usuario cerró el modal (Escape, clic fuera, etc.) - no hacer nada
        return;
      }
    } else {
      // Si no tiene resumen, preguntar al usuario
      const result = await Swal.fire({
        title: this.translate.instant('dxgpt.summary.title') || 'Resumen del paciente no disponible',
        html: this.translate.instant('dxgpt.summary.message') || 
              'El paciente no tiene un resumen generado. ¿Deseas crear el resumen ahora?<br><br>' +
              '<small>Si creas el resumen, recibirás una notificación cuando esté listo y podrás volver aquí para ejecutar el análisis.</small>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: this.translate.instant('dxgpt.summary.create') || 'Crear resumen',
        cancelButtonText: this.translate.instant('dxgpt.summary.continue') || 'Continuar sin resumen',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#6c757d'
      });

      if (result.isConfirmed) {
        // Usuario quiere crear el resumen
        this.getPatientSummary(false);
        Swal.fire({
          title: this.translate.instant('dxgpt.summary.creating') || 'Creando resumen...',
          html: this.translate.instant('dxgpt.summary.notification') || 
                'El resumen se está generando. Recibirás una notificación cuando esté listo.<br><br>' +
                'Puedes volver aquí después para ejecutar el análisis de diagnóstico diferencial.',
          icon: 'info',
          confirmButtonText: 'OK'
        });
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // Usuario quiere continuar sin resumen (clic en botón "Continuar sin resumen")
        this.executeFetchDxGptResults();
      }
      // Si cerró con Escape o clic fuera, no hacer nada
    }
  }

  openTimelineModal(timelineModal) {
    console.log(this.timeline);
    this.modalService.open(timelineModal, {
      size: 'lg',
      scrollable: true,
      backdrop: 'static'
    });
    
    // Cargar timeline consolidado si no está cargado
    if (!this.consolidatedTimeline && this.showConsolidatedView) {
      this.loadConsolidatedTimeline();
    }
  }

  async loadConsolidatedTimeline(forceRegenerate: boolean = false) {
    this.loadingConsolidatedTimeline = true;
    this.consolidatedTimelineError = null;
    
    try {
      const lang = this.preferredResponseLanguage || localStorage.getItem('lang') || 'en';
      const url = `${environment.api}/api/timeline/consolidated/${this.currentPatient}?lang=${lang}${forceRegenerate ? '&regenerate=true' : ''}`;
      
      const response: any = await this.http.get(url).toPromise();
      
      if (response && response.success) {
        this.consolidatedTimeline = response;
        console.log('[Timeline] Consolidado cargado:', response.stats);
      } else {
        throw new Error(response?.message || 'Error loading timeline');
      }
    } catch (error) {
      console.error('[Timeline] Error:', error);
      this.consolidatedTimelineError = error.message || 'Error loading consolidated timeline';
      // Fallback: mostrar vista de eventos crudos
      this.showConsolidatedView = false;
    } finally {
      this.loadingConsolidatedTimeline = false;
    }
  }

  toggleTimelineView() {
    this.showConsolidatedView = !this.showConsolidatedView;
    
    if (this.showConsolidatedView && !this.consolidatedTimeline) {
      this.loadConsolidatedTimeline();
    }
  }

  regenerateConsolidatedTimeline() {
    this.loadConsolidatedTimeline(true);
  }

  getMonthName(monthNum: number): string {
    if (!monthNum || monthNum < 1 || monthNum > 12) return '';
    const date = new Date(2000, monthNum - 1, 1);
    return date.toLocaleString(this.translate.currentLang || 'en', { month: 'long' });
  }

  copyConsolidatedTimelineToClipboard() {
    if (!this.consolidatedTimeline) return;
    
    let text = '';
    
    // Chronic conditions
    if (this.consolidatedTimeline.chronicConditions?.length > 0) {
      text += '📋 ' + this.translate.instant('timeline.Chronic conditions') + ':\n';
      this.consolidatedTimeline.chronicConditions.forEach(c => {
        text += `  • ${c.name}${c.since ? ' (' + c.since + ')' : ''}\n`;
      });
      text += '\n';
    }
    
    // Current medications
    if (this.consolidatedTimeline.currentMedications?.length > 0) {
      text += '💊 ' + this.translate.instant('timeline.Current medications') + ':\n';
      this.consolidatedTimeline.currentMedications.forEach(m => {
        text += `  • ${m.name}${m.since ? ' (' + m.since + ')' : ''}\n`;
      });
      text += '\n';
    }
    
    // Milestones
    if (this.consolidatedTimeline.milestones?.length > 0) {
      text += '📅 ' + this.translate.instant('timeline.Timeline') + ':\n';
      this.consolidatedTimeline.milestones.forEach(milestone => {
        const dateStr = milestone.month 
          ? `${this.getMonthName(milestone.month)} ${milestone.year}` 
          : (milestone.year || this.translate.instant('timeline.Undated'));
        text += `\n${dateStr}:\n`;
        milestone.events?.forEach(e => {
          text += `  ${e.icon || '•'} ${e.title}${e.details ? ' - ' + e.details : ''}\n`;
        });
      });
    }
    
    this.clipboard.copy(text);
    this.toastr.success(this.translate.instant('timeline.Timeline copied to clipboard'));
  }

  exportConsolidatedTimelineToPDF() {
    if (!this.consolidatedTimeline) return;
    
    const doc = new jsPDF();
    let y = 20;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;
    const maxWidth = 170; // Max text width before wrapping
    
    // Helper to remove emojis (jsPDF doesn't support them)
    const removeEmojis = (text: string): string => {
      if (!text) return '';
      return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    };
    
    const checkPageBreak = (neededSpace: number) => {
      if (y + neededSpace > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    // Helper to wrap and print text
    const printWrappedText = (text: string, x: number, maxW: number) => {
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach((line: string) => {
        checkPageBreak(lineHeight);
        doc.text(line, x, y);
        y += lineHeight;
      });
    };
    
    // Title
    doc.setFontSize(18);
    doc.text(this.translate.instant('timeline.Timeline') + ' - ' + this.translate.instant('timeline.Consolidated'), 14, y);
    y += 15;
    
    // Chronic conditions
    if (this.consolidatedTimeline.chronicConditions?.length > 0) {
      checkPageBreak(20);
      doc.setFontSize(14);
      doc.text(this.translate.instant('timeline.Chronic conditions'), 14, y);
      y += 10;
      doc.setFontSize(10);
      this.consolidatedTimeline.chronicConditions.forEach(c => {
        checkPageBreak(lineHeight);
        const text = `- ${c.name}${c.since ? ' (' + c.since + ')' : ''}`;
        printWrappedText(text, 20, maxWidth - 20);
      });
      y += 5;
    }
    
    // Current medications
    if (this.consolidatedTimeline.currentMedications?.length > 0) {
      checkPageBreak(20);
      doc.setFontSize(14);
      doc.text(this.translate.instant('timeline.Current medications'), 14, y);
      y += 10;
      doc.setFontSize(10);
      this.consolidatedTimeline.currentMedications.forEach(m => {
        checkPageBreak(lineHeight);
        const text = `- ${m.name}${m.since ? ' (' + m.since + ')' : ''}`;
        printWrappedText(text, 20, maxWidth - 20);
      });
      y += 5;
    }
    
    // Milestones
    if (this.consolidatedTimeline.milestones?.length > 0) {
      checkPageBreak(20);
      doc.setFontSize(14);
      doc.text(this.translate.instant('timeline.milestones'), 14, y);
      y += 10;
      
      this.consolidatedTimeline.milestones.forEach(milestone => {
        checkPageBreak(15);
        const dateStr = milestone.month 
          ? `${this.getMonthName(milestone.month)} ${milestone.year}` 
          : (milestone.year?.toString() || this.translate.instant('timeline.Undated'));
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(dateStr, 14, y);
        y += lineHeight;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        milestone.events?.forEach(e => {
          checkPageBreak(lineHeight * 2);
          const title = `- ${removeEmojis(e.title)}`;
          printWrappedText(title, 20, maxWidth - 20);
          if (e.details) {
            doc.setTextColor(100);
            printWrappedText(removeEmojis(e.details), 25, maxWidth - 25);
            doc.setTextColor(0);
          }
        });
        y += 3;
      });
    }
    
    // Footer on all pages
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`${this.translate.instant('timeline.Exported on')}: ${new Date().toLocaleDateString()}`, 14, pageHeight - 10);
      doc.text(`${i}/${pageCount}`, pageHeight - 20, pageHeight - 10);
    }
    
    doc.save('timeline-consolidated.pdf');
  }

  getEventTypeIcon(type: string): string {
    const icons = {
      'diagnosis': '🩺',
      'treatment': '💉',
      'test': '🔬',
      'appointment': '📅',
      'symptom': '🤒',
      'medication': '💊',
      'activity': '🏃',
      'reminder': '🔔',
      'other': '🔍'
    };
    if (!type || type === 'null') {
      return '🔍 ';
    }
    return icons[type] ? icons[type] + ' ' : '🔍 ';
  }

  newMedicalEventTimeline() {
    const modalRef = this.modalService.open(NewMedicalEventComponent, { size: 'lg' });
    modalRef.result.then(
      (result) => {
        if (result) {
          console.log(result)
          this.loadEnvironmentMydata();
        } else {
          console.log('Modal dismissed');
        }
      },
      (reason) => {
        // Modal was dismissed
        console.log('Modal dismissed:', reason);

      }
    );
  }

  editMedicalEventTimeline(event: any) {
    console.log(event);
    // Abre el modal de edición con los datos del evento
    const modalRef = this.modalService.open(EditMedicalEventComponent, { size: 'lg' });
    modalRef.componentInstance.event = { ...event }; // Pass a copy of the event
    modalRef.result.then((result) => {
      if (result) {
        this.loadEnvironmentMydata();
      }
    }).catch(() => {
      // Modal dismissed
      console.log('Modal dismissed');
    });
  }

  copyTimelineToClipboard() {
    if (this.groupedEvents.length === 0) {
      Swal.fire({
        icon: 'info',
        title: this.translate.instant('generics.Info'),
        html: this.translate.instant('timeline.There are no events')
      });
      return;
    }

    const lang = localStorage.getItem('lang') || this.translate.currentLang || 'es';
    let text = this.translate.instant('timeline.Timeline') + '\n';
    text += '='.repeat(50) + '\n\n';

    this.groupedEvents.forEach(group => {
      const monthYear = new Date(group.monthYear).toLocaleDateString(lang, { 
        year: 'numeric', 
        month: 'long' 
      });
      text += monthYear.toUpperCase() + '\n';
      text += '-'.repeat(50) + '\n';

      group.events.forEach(event => {
        const eventType = this.getEventTypeDisplay(event.key) || event.key || '';
        const eventDate = event.date ? new Date(event.date).toLocaleDateString(lang) : '';
        const eventDateEnd = event.dateEnd ? new Date(event.dateEnd).toLocaleDateString(lang) : '';
        
        text += `${this.getEventTypeIcon(event.key)} ${event.name || ''}\n`;
        text += `   ${eventType}\n`;
        if (eventDateEnd) {
          text += `   ${this.translate.instant('timeline.Start date')}: ${eventDate} - ${this.translate.instant('timeline.End date')}: ${eventDateEnd}\n`;
        } else {
          text += `   ${eventDate}\n`;
        }
        if (event.notes) {
          text += `   ${this.translate.instant('generics.Notes')}: ${event.notes}\n`;
        }
        text += '\n';
      });
      text += '\n';
    });

    this.clipboard.copy(text);
    Swal.fire({
      icon: 'success',
      title: this.translate.instant('generics.Success'),
      html: this.translate.instant('timeline.Timeline copied to clipboard')
    });
  }

  exportTimelineToCSV() {
    if (this.groupedEvents.length === 0) {
      Swal.fire({
        icon: 'info',
        title: this.translate.instant('generics.Info'),
        html: this.translate.instant('timeline.There are no events')
      });
      return;
    }

    const lang = localStorage.getItem('lang') || this.translate.currentLang || 'es';
    // Encabezados CSV
    const headers = [
      this.translate.instant('timeline.Date'),
      this.translate.instant('timeline.End date'),
      this.translate.instant('timeline.Event type'),
      this.translate.instant('generics.Name'),
      this.translate.instant('generics.Notes')
    ];

    let csvContent = headers.join(',') + '\n';

    // Datos
    this.groupedEvents.forEach(group => {
      group.events.forEach(event => {
        const eventDate = event.date ? new Date(event.date).toLocaleDateString(lang) : '';
        const eventDateEnd = event.dateEnd ? new Date(event.dateEnd).toLocaleDateString(lang) : '';
        const eventType = this.getEventTypeDisplay(event.key) || event.key || '';
        const eventName = (event.name || '').replace(/"/g, '""'); // Escapar comillas
        const eventNotes = (event.notes || '').replace(/"/g, '""'); // Escapar comillas

        const row = [
          `"${eventDate}"`,
          `"${eventDateEnd}"`,
          `"${eventType}"`,
          `"${eventName}"`,
          `"${eventNotes}"`
        ];
        csvContent += row.join(',') + '\n';
      });
    });

    // Crear blob y descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `timeline_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getEventTypeDisplayWithoutEmoji(type: string): string {
    const types = {
      'diagnosis': this.translate.instant('timeline.Diagnoses'),
      'treatment': this.translate.instant('timeline.Treatment'),
      'test': this.translate.instant('timeline.Tests'),
      'appointment': this.translate.instant('events.appointment'),
      'symptom': this.translate.instant('timeline.Symptoms'),
      'medication': this.translate.instant('timeline.Medications'),
      'activity': this.translate.instant('timeline.Activity'),
      'reminder': this.translate.instant('timeline.Reminder'),
      'other': this.translate.instant('timeline.Other')
    };
    if (!type || type === 'null') {
      return this.translate.instant('timeline.Other');
    }
    return types[type] || this.translate.instant('timeline.Other');
  }

  exportTimelineToPDF() {
    if (this.groupedEvents.length === 0) {
      Swal.fire({
        icon: 'info',
        title: this.translate.instant('generics.Info'),
        html: this.translate.instant('timeline.There are no events')
      });
      return;
    }

    const lang = localStorage.getItem('lang') || this.translate.currentLang || 'es';
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;
    const lineHeight = 6;
    const maxWidth = pageWidth - (margin * 2);

    // Título principal
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    const title = this.translate.instant('timeline.Timeline');
    doc.text(title, margin, yPosition);
    yPosition += lineHeight * 2.5;

    // Fecha de exportación
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    const exportDate = new Date().toLocaleDateString(lang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`${this.translate.instant('timeline.Exported on')}: ${exportDate}`, margin, yPosition);
    yPosition += lineHeight * 2;

    // Eventos agrupados por mes
    this.groupedEvents.forEach((group, groupIndex) => {
      // Verificar si necesitamos una nueva página (dejar espacio para el título del mes y al menos un evento)
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }

      // Título del mes y año
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      const monthYear = new Date(group.monthYear).toLocaleDateString(lang, {
        year: 'numeric',
        month: 'long'
      });
      doc.text(monthYear.toUpperCase(), margin, yPosition);
      yPosition += lineHeight * 1.8;

      // Línea separadora debajo del mes
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += lineHeight * 1.5;

      // Eventos del mes
      group.events.forEach((event, eventIndex) => {
        // Verificar si necesitamos una nueva página
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }

        // Nombre del evento (sin emoji)
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        const eventName = (event.name || '').trim();
        
        if (eventName) {
          // Dividir texto si es muy largo
          const splitText = doc.splitTextToSize(eventName, maxWidth);
          doc.text(splitText, margin + 3, yPosition);
          yPosition += lineHeight * splitText.length;
        }

        // Tipo de evento (sin emoji)
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const eventType = this.getEventTypeDisplayWithoutEmoji(event.key);
        if (eventType) {
          doc.text(eventType, margin + 3, yPosition);
          yPosition += lineHeight * 1.2;
        }

        // Fechas
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const eventDate = event.date ? new Date(event.date).toLocaleDateString(lang) : '';
        const eventDateEnd = event.dateEnd ? new Date(event.dateEnd).toLocaleDateString(lang) : '';
        
        if (eventDateEnd && eventDateEnd !== eventDate) {
          const dateText = `${this.translate.instant('timeline.Start date')}: ${eventDate} - ${this.translate.instant('timeline.End date')}: ${eventDateEnd}`;
          const splitDate = doc.splitTextToSize(dateText, maxWidth - 6);
          doc.text(splitDate, margin + 3, yPosition);
          yPosition += lineHeight * splitDate.length;
        } else if (eventDate) {
          doc.text(eventDate, margin + 3, yPosition);
          yPosition += lineHeight * 1.2;
        }

        // Notas si existen
        if (event.notes && event.notes.trim()) {
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          const notesLabel = this.translate.instant('generics.Notes');
          const notesText = `${notesLabel}: ${event.notes.trim()}`;
          const splitNotes = doc.splitTextToSize(notesText, maxWidth - 6);
          doc.text(splitNotes, margin + 3, yPosition);
          yPosition += lineHeight * splitNotes.length;
        }

        yPosition += lineHeight * 1.2; // Espacio entre eventos
      });

      yPosition += lineHeight * 0.8; // Espacio adicional entre grupos de meses
    });

    // Guardar PDF
    const fileName = `timeline_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  toggleDiagnosisCard(index: number): void {
    if (this.expandedDiagnosisCards.has(index)) {
      this.expandedDiagnosisCards.delete(index);
      this.expandedQuestions.delete(index); // Limpia la pregunta expandida al cerrar
    } else {
      this.expandedDiagnosisCards.clear(); // Cierra todas las tarjetas
      this.expandedQuestions.clear(); // Limpia todas las preguntas expandidas
      this.expandedDiagnosisCards.add(index); // Abre solo la seleccionada
    }
  }

  isDiagnosisCardExpanded(index: number): boolean {
    return this.expandedDiagnosisCards.has(index);
  }

  toggleQuestion(cardIndex: number, questionIndex: number): void {
    // Marca la pregunta como visitada
    if (!this.visitedQuestions.has(cardIndex)) {
      this.visitedQuestions.set(cardIndex, new Set());
    }
    this.visitedQuestions.get(cardIndex).add(questionIndex);

    // Toggle la pregunta expandida
    const currentExpanded = this.expandedQuestions.get(cardIndex);
    if (currentExpanded === questionIndex) {
      this.expandedQuestions.delete(cardIndex); // Cierra si ya está abierta
    } else {
      this.expandedQuestions.set(cardIndex, questionIndex); // Abre la nueva
      
      // Verificar si ya tenemos la respuesta cacheada
      const cacheKey = `${cardIndex}-${questionIndex}`;
      if (!this.questionResponses.has(cacheKey)) {
        // Si no tenemos la respuesta, hacer la llamada a la API
        this.fetchDiseaseInfo(cardIndex, questionIndex);
      }
    }
  }

  isQuestionExpanded(cardIndex: number, questionIndex: number): boolean {
    return this.expandedQuestions.get(cardIndex) === questionIndex;
  }

  isQuestionVisited(cardIndex: number, questionIndex: number): boolean {
    return this.visitedQuestions.has(cardIndex) && 
           this.visitedQuestions.get(cardIndex).has(questionIndex);
  }

  isQuestionLoading(cardIndex: number, questionIndex: number): boolean {
    return this.loadingQuestions.get(`${cardIndex}-${questionIndex}`) || false;
  }

  getQuestionResponse(cardIndex: number, questionIndex: number): string {
    return this.questionResponses.get(`${cardIndex}-${questionIndex}`) || '';
  }

  private async fetchDiseaseInfo(cardIndex: number, questionIndex: number): Promise<void> {
    const cacheKey = `${cardIndex}-${questionIndex}`;
    
    // Verificar que tenemos los datos necesarios
    if (!this.dxGptResults || !this.dxGptResults.analysis || !this.dxGptResults.analysis.data[cardIndex]) {
      console.error('No diagnosis data available for index:', cardIndex);
      return;
    }
    
    const diagnosis = this.dxGptResults.analysis.data[cardIndex];
    const disease = diagnosis.diagnosis;
    
    // Set loading state
    this.loadingQuestions.set(cacheKey, true);
    
    try {
      // Get current patient context if needed for questions 3 and 4
      let medicalDescription = undefined;
      if (questionIndex === 3 || questionIndex === 4) {
        // Use the current anonymized text from the component state
        if (this.dxGptResults.analysis.anonymization && this.dxGptResults.analysis.anonymization.anonymizedText) {
          medicalDescription = this.dxGptResults.analysis.anonymization.anonymizedText;
        }
      }
      
      // Call the API
      const response = await this.apiDx29ServerService.getDiseaseInfo(
        this.actualPatient.sub,
        questionIndex,
        disease,
        this.translate.currentLang,
        medicalDescription
      ).toPromise();

      console.log('response', response);
      
      // Process response based on question type and store formatted HTML content
      if (response && response.result === 'success' && response.data) {
        if (questionIndex === 3 && response.data.symptoms) {
          // Store symptoms as structured data and mark as special type
          this.questionSymptoms.set(cacheKey, response.data.symptoms);
          this.questionResponses.set(cacheKey, 'custom-symptom-list');
        } else if (response.data.content) {
          // Remove redundant title from HTML content since most probably will redundate the question in the UI
          let content = response.data.content;
          this.questionResponses.set(cacheKey, content);
        } else {
          this.questionResponses.set(cacheKey, '<p>' + this.translate.instant('dxgpt.couldNotGetInfo') + '</p>');
        }
      }
      
      
    } catch (error) {
      console.error('Error fetching disease info:', error);
      this.questionResponses.set(cacheKey, '<p>' + this.translate.instant('dxgpt.errorLoadingInfo') + '</p>');
    } finally {
      // Remove loading state
      this.loadingQuestions.set(cacheKey, false);
    }
  }

  getSymptoms(cardIndex: number, questionIndex: number): any[] {
    const cacheKey = `${cardIndex}-${questionIndex}`;
    return this.questionSymptoms.get(cacheKey) || [];
  }

  reRunDiagnosis(cardIndex: number, questionIndex: number): void {
    const cacheKey = `${cardIndex}-${questionIndex}`;
    const allSymptoms = this.questionSymptoms.get(cacheKey);
    if (!allSymptoms) return;

    const selected = allSymptoms.filter(s => s.checked).map(s => s.name);
    if (selected.length === 0) {
      Swal.fire(this.translate.instant('dxgpt.selectAtLeastOneSymptom'), '', 'info');
      return;
    }

    // Combine the original anonymized text with selected symptoms
    const combinedDescription = this.dxGptResults.analysis.anonymization.anonymizedText
      + '\n\n; ' + selected.join(', '); // antes de "; " ponia "Síntomas adicionales a considerar: "

    // Close all expanded cards and questions
    this.expandedDiagnosisCards.clear();
    this.expandedQuestions.clear();
    
    // Clear cached responses as we'll get new results
    this.questionResponses.clear();
    this.questionSymptoms.clear();

    // Set loading state for DxGPT
    this.isDxGptLoading = true;

    // Call the DxGPT API with the updated description directly
    this.apiDx29ServerService.getDifferentialDiagnosis(
      this.actualPatient.sub,
      this.translate.currentLang,
      null, // no diseases to exclude
      combinedDescription // pass the combined description directly
    ).subscribe({
      next: (res) => {
        console.log('DxGPT rerun response:', res);
        if (res && res.success) {
          this.dxGptResults = res;
          // Show success message
          Swal.fire({
            icon: 'success',
            title: this.translate.instant('dxgpt.analysisUpdated'),
            text: this.translate.instant('dxgpt.newAnalysisWithSymptoms'),
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          console.error('DxGPT rerun failed:', res);
          Swal.fire({
            icon: 'error',
            title: this.translate.instant('generics.Error'),
            text: this.translate.instant('dxgpt.analysisFailed')
          });
        }
        this.isDxGptLoading = false;
      },
      error: (err) => {
        console.error('Error in DxGPT rerun:', err);
        this.isDxGptLoading = false;
        Swal.fire({
          icon: 'error',
          title: this.translate.instant('generics.Error'),
          text: this.translate.instant('dxgpt.analysisError')
        });
      }
    });
  }

  findMoreDiagnoses(): void {
    // Get current disease names to exclude
    const currentDiseases = this.dxGptResults.analysis.data.map(d => d.diagnosis);
    
    // Set loading state
    this.isLoadingMoreDiagnoses = true;

    // Call API with diseases_list to exclude current ones
    this.apiDx29ServerService.getDifferentialDiagnosis(
      this.actualPatient.sub,
      this.translate.currentLang,
      currentDiseases // diseases to exclude
    ).subscribe({
      next: (res) => {
        console.log('More diagnoses response:', res);
        if (res && res.success && res.analysis && res.analysis.data) {
          // Append new diagnoses to existing ones
          const newDiagnoses = res.analysis.data;
          
          if (newDiagnoses.length > 0) {
            // Add new diagnoses to the existing list
            this.dxGptResults.analysis.data = [
              ...this.dxGptResults.analysis.data,
              ...newDiagnoses
            ];
            
            // Show success message
            Swal.fire({
              icon: 'success',
              title: 'Nuevos diagnósticos encontrados',
              text: `Se encontraron ${newDiagnoses.length} diagnósticos adicionales.`,
              timer: 2000,
              showConfirmButton: false
            });
          } else {
            // No new diagnoses found
            Swal.fire({
              icon: 'info',
              title: 'Sin diagnósticos adicionales',
              text: 'No se encontraron más diagnósticos posibles para este caso.',
              timer: 3000,
              showConfirmButton: false
            });
          }
        } else {
          console.error('Failed to get more diagnoses:', res);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron obtener diagnósticos adicionales.'
          });
        }
        this.isLoadingMoreDiagnoses = false;
      },
      error: (err) => {
        console.error('Error getting more diagnoses:', err);
        this.isLoadingMoreDiagnoses = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al buscar diagnósticos adicionales.'
        });
      }
    });
  }

  startEditingPatientInfo(): void {
    this.isEditingPatientInfo = true;
    this.editedPatientInfo = this.dxGptResults.analysis.anonymization.anonymizedText;
  }

  cancelEditingPatientInfo(): void {
    this.isEditingPatientInfo = false;
    this.editedPatientInfo = '';
  }

  togglePatientInfo(): void {
    this.isPatientInfoExpanded = !this.isPatientInfoExpanded;
  }

  shouldShowPatientInfoToggle(): boolean {
    if (!this.dxGptResults || !this.dxGptResults.analysis || !this.dxGptResults.analysis.anonymization) {
      return false;
    }
    
    const text = this.dxGptResults.analysis.anonymization.anonymizedText || '';
    const textHtml = this.dxGptResults.analysis.anonymization.anonymizedTextHtml || '';
    
    // Mostrar el botón si el texto es más largo que aproximadamente 500 caracteres
    // o si hay HTML y parece ser largo
    return text.length > 500 || (textHtml.length > 500 && textHtml.includes('<p>'));
  }

  saveEditedPatientInfo(): void {
    if (!this.editedPatientInfo.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo vacío',
        text: 'Por favor, ingrese una descripción del paciente.'
      });
      return;
    }

    // Check if the text has actually changed
    const originalText = this.dxGptResults.analysis.anonymization.anonymizedText;
    if (this.editedPatientInfo.trim() === originalText.trim()) {
      // No changes made, just close the edit mode
      this.isEditingPatientInfo = false;
      this.editedPatientInfo = '';
      return;
    }

    // Close edit mode
    this.isEditingPatientInfo = false;

    // Clear all cached responses and expanded cards
    this.questionResponses.clear();
    this.questionSymptoms.clear();
    this.expandedQuestions.clear();
    this.expandedDiagnosisCards.clear();

    // Set loading state
    this.isDxGptLoading = true;

    // Re-run the differential diagnosis with the edited description directly
    this.apiDx29ServerService.getDifferentialDiagnosis(
      this.actualPatient.sub,
      this.translate.currentLang,
      null, // no diseases to exclude
      this.editedPatientInfo // pass the edited description directly
    ).subscribe({
      next: (res) => {
        console.log('DxGPT response after edit:', res);
        if (res && res.success) {
          this.dxGptResults = res;
          
          // Show success message
          Swal.fire({
            icon: 'success',
            title: this.translate.instant('dxgpt.analysisUpdated'),
            text: this.translate.instant('dxgpt.newAnalysisWithDescription'),
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          console.error('DxGPT analysis failed:', res);
          
          // Restore the previous description on error
          if (this.dxGptResults && this.dxGptResults.analysis && this.dxGptResults.analysis.anonymization) {
            this.dxGptResults.analysis.anonymization.anonymizedText = this.editedPatientInfo;
          }
          
          Swal.fire({
            icon: 'error',
            title: this.translate.instant('generics.Error'),
            text: this.translate.instant('dxgpt.analysisFailedWithDescription')
          });
        }
        this.isDxGptLoading = false;
      },
      error: (err) => {
        console.error('Error in DxGPT analysis:', err);
        this.isDxGptLoading = false;
        
        // Save the description locally even if the analysis fails
        if (this.dxGptResults && this.dxGptResults.analysis && this.dxGptResults.analysis.anonymization) {
          this.dxGptResults.analysis.anonymization.anonymizedText = this.editedPatientInfo;
        }
        
        Swal.fire({
          icon: 'error',
          title: this.translate.instant('generics.Error'),
          text: this.translate.instant('dxgpt.analysisErrorWithDescription')
        });
      }
    });
  }

}
