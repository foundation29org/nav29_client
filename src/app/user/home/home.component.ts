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

import { InsightsService } from 'app/shared/services/azureInsights.service';
import { LangService } from 'app/shared/services/lang.service';
import * as QRCode from 'qrcode';
import { FeedbackSummaryPageComponent } from 'app/user/feedback-summary/feedback-summary-page.component';
import { EditMedicalEventComponent } from 'app/user/edit-event-modal/edit-medical-event.component';
import { NewMedicalEventComponent } from 'app/user/new-event-modal/new-medical-event.component';
import { LanguageSelectModalComponent } from 'app/user/language-select/language-select.component';
declare var webkitSpeechRecognition: any;
import * as hopscotch from 'hopscotch';
import { HighlightService } from 'app/shared/services/highlight.service';
import { interval } from 'rxjs';
import { filter, take } from 'rxjs/operators';
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
  appointmentsForm: FormGroup;
  dataFile: any = {};
  tempDocs: any = [];
  submitted = false;
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

  valueProm: any = {};
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
  @ViewChild('contentviewSummary', { static: false }) contentviewSummary: TemplateRef<any>;
  @ViewChild('contentviewDoc', { static: false }) contentviewDoc: TemplateRef<any>;
  @ViewChild('contentSummaryDoc', { static: false }) contentSummaryDoc: TemplateRef<any>;
  @ViewChild('contentviewProposedEvents', { static: false }) contentviewProposedEvents: TemplateRef<any>;
  @ViewChild('contentviewProposedAppointments', { static: false }) contentviewProposedAppointments: TemplateRef<any>;
  @ViewChild('shareCustom', { static: false }) contentshareCustom: TemplateRef<any>;
  @ViewChild('qrPanel', { static: false }) contentqrPanel: TemplateRef<any>;
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
  isLoadingMoreDiagnoses: boolean = false;
  loadingDoc: boolean = false;
  summaryDate: Date = null;
  generatingPDF: boolean = false;
  msgDownload: string;
  msgtoDownload: string;
  actualStatus: string = '';
  private intervalId: any;
  sendingVote: boolean = false;
  actualParam: string = '';
  proposedEvents = [];
  proposedAppointments = [];
  currentPatient: string = '';
  actualPatient: any = {};
  containerName: string = '';
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
  showFilters = false;
  groupedEvents: any = [];
  startDate: Date;
  endDate: Date;
  selectedEventType: string = null;
  originalEvents: any[];
  isOldestFirst = false;
  userId = '';
  openingSummary = false;
  role = 'Unknown';
  medicalLevel: string = '1';
  valueGeneralFeedback: string = '';
  openingResults = false;
  eventsDoc: any = [];
  selectedIndexTab: number = 0;
  sidebarOpen = false;
  notesSidebarOpen: boolean = false;
  notes: { _id: string, content: string, date: Date, isEditing?: boolean, editContent?: string }[] = [];
  newNoteContent: string = '';
  savingNote: boolean = false;
  editableDiv: ElementRef | null = null;
  deletingNote: boolean = false;
  selectAllDocuments: boolean = true;
  searchTerm: string = '';
  filteredDocs: any[] = [];
  recognition: any;
  recording = false;
  supported = false;
  timer: number = 0;
  timerDisplay: string = '00:00';
  private interval: any;
  tempFileName: string = '';
  showCameraButton: boolean = false;
  langs: any[] = [];
  editingTitle: boolean = false; 
  @ViewChild('titleInput', { static: false }) titleInput: ElementRef;
  currentView: string = 'chat';
  
  // RareScope variables
  additionalNeeds: string[] = [];
  rarescopeNeeds: string[] = [''];
  previousView: string;
  private isInitialLoad = true;
  currentPatientId: string | null = null;
  private patientSubscription: Subscription;

  constructor(private http: HttpClient, private authService: AuthService, public translate: TranslateService, private formBuilder: FormBuilder, private authGuard: AuthGuard, public toastr: ToastrService, private patientService: PatientService, private sortService: SortService, private modalService: NgbModal, private apiDx29ServerService: ApiDx29ServerService, private dateService: DateService, private eventsService: EventsService, private webPubSubService: WebPubSubService, private searchService: SearchService, public jsPDFService: jsPDFService, private clipboard: Clipboard, public trackEventsService: TrackEventsService, private route: ActivatedRoute, public insightsService: InsightsService, private cdr: ChangeDetectorRef, private router: Router, private langService: LangService, private highlightService: HighlightService, private activityService: ActivityService) {
    this.screenWidth = window.innerWidth;
    this.categoriesPatients = [
      { "title": this.translate.instant('categoriesPatients.list.cat1'), "icon": "data:image/webp;base64,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", "idCat": "treatAndDrugs", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat2'), "icon": "data:image/webp;base64,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", "idCat": "symtomsauto", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat3'), "icon": "data:image/webp;base64,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", "idCat": "eduandResources", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat4'), "icon": "data:image/webp;base64,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", "idCat": "bienestar", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat5'), "icon": "data:image/webp;base64,UklGRmYMAABXRUJQVlA4WAoAAAAwAAAAOwAAOwAASUNDUKACAAAAAAKgbGNtcwRAAABtbnRyUkdCIFhZWiAH5wALAB4AEQAdAClhY3NwTVNGVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1kZXNjAAABIAAAAEBjcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaGFkAAABrAAAACxyWFlaAAAB2AAAABRiWFlaAAAB7AAAABRnWFlaAAACAAAAABRyVFJDAAACFAAAACBnVFJDAAACFAAAACBiVFJDAAACFAAAACBjaHJtAAACNAAAACRkbW5kAAACWAAAACRkbWRkAAACfAAAACRtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACQAAAAcAEcASQBNAFAAIABiAHUAaQBsAHQALQBpAG4AIABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABQAHUAYgBsAGkAYwAgAEQAbwBtAGEAaQBuAABYWVogAAAAAAAA9tYAAQAAAADTLXNmMzIAAAAAAAEMQgAABd7///MlAAAHkwAA/ZD///uh///9ogAAA9wAAMBuWFlaIAAAAAAAAG+gAAA49QAAA5BYWVogAAAAAAAAJJ8AAA+EAAC2xFhZWiAAAAAAAABilwAAt4cAABjZcGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltjaHJtAAAAAAADAAAAAKPXAABUfAAATM0AAJmaAAAmZwAAD1xtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAEcASQBNAFBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJBTFBIFAQAAAGgRVvb8Ug6ZbRVSllJ27Zt27Zt27Zt27bd0xhbbTwX/1+ZvzK+i4gJ4H/7lBns0dntUZnsUTHRbq7lFe8IALxrtE4HuGWwh7qOryMOo8cJ6esYjEnjQ10kPAPmFSRpkgkkd/i6gFs2fxKsZZicAIQHJVrSjDjpc1v61e4E6SITyTc9Tidt1SMYp1PEJoqfA6fTNOpQ1c8Z7yIkj0iM9BQd7W3mVmnHG0lPHYZascB0lcEWaF1WbzJePuy/bBBpxn0j89veMFEvg/D/pH2QzbKUYYD/vWtqxWE5OZxa0ptQUksngMxWpcfY6/sx7vyol/OyXzJ5WfI3qXXB8ql2qFFcnYjIZNakCoGI8TM7DBgx3/dHXYLLJsbZbr/ql8p1ZkhLyWyNAwK/lGlaJ94fknTUnaXS9yUkVSTK2wo3B4ySc5ckfYh6qacpIOVFaZY0C7wCrHCkgXl/4LKBLN1CATzK1I1oHA8QZ0VWYHICUU91HC6ZQMYT68edLobRH7BbkRcol8CASvuLwOUENkrSbbjdhuVrIMKKzACXzT5UBWdmGI7BlbYZ1BtirIg15DN5szHaMDuBoGfS7xlhaZdNX/uCn58FOQz0lbQjIO/kE9Uh9qWkDWkh4vGPhYERu9U6w5GM2CyINCFH+ybBuyW1gdDSv0j6shwkiQSo8eDWgF9XxHqmsiDeDMKfftn5sopBi7bheyRpEkClY+f7Dtg1xgY2LHTAnqcbysLRE7ke6QdPqK5d4bW/ktQP8n6S9EN7gHArMsJSfa/9dX7I9500EGgttSflKukQ7JBpVyDOisiktNe+Jk81+qK03BNYITWD6dJobJJazPmka0CsFdhJ9UpPi5z4dtWQAgA53kmhpHmllwHY63+mt+MLnb0A7mGWpIce0i8FfrFhLP2dtBr6SXPh0dn8i6VnjW1gx9IUwTDsta5tsEHuXsckPUuL3zf6GEXyb6QXkhYBmazBDqSrt+oXG2NkvB0BLaSFUC7P6N8knfCDQH+LUoQAtJWN3ZK+7OEH3JKywoFPi7Mv1dM0QBRWZ/EDqisPYb1b5cHo9kobgYaP9NvwYuFARjfLyAqk+m0BzpaaaIOyp4vM0dfxQFAKrPfMAfTSCF8nTIdKH5/HAAFpSUz/9MBw/XbZ9GRXs+3S0wggdTiJ6x8HZJu6cvPGTevX7NcQk0u6GAyE2Ej0jMlwcsslk+aj/QFHClwwrd0sYv6ClwtNjLZoXDQ+ymC/fHlRsgQCopPgumGRDg8SDooLS4GLh0QGZ7EFZAvKHOnF36mnX3B0jD0uLlN0dLift8vYZ++/cO7c2GnL9mw/uuPEzd9vnj9x5tT1r36/u2dR18TDPT5HiWp5CpYvVa9e7YaDJg4c0Kl9/cpVSxRwBPD/LFZQOCCEBQAAEB0AnQEqPAA8AD4xFIhDIiEhFAaoIAMEtgBfBKC/M+Q6gb0D8nPYxp/98/EuUz9DP57pI8sV7APMZ+qv+A9qf0PeUr1lfoAeWj+w/wWfuL+1XtO3gV8z6NT0d7UZQR9BwszAbk38/4gO81/Mf9x5MHgmUAP5T/Zf9z9wH0c/uX/d8kH5l/b//H7gX8t/ov/J9bn2G/rt7H/7GNqbhygMZT/URtIoHWFIK53zq6ckoCTQ9LcEl6eLPEwu2Rrcwelyl6U7ENBb58jDBBtUdb30pnB1WaD0m5+NpjcjsFjHg+UTkBjStBx3AX6578lZrDGIoAD+UFJRv/JRnnCImptKnR3fybTqS6/p636et+fYPdWJ7TKj+CpWUdWUJ1eU5ldghkQYRWtq2RE/7n9bTq3PhrTy603R/0xv2mREQY655oqqcmjj3yWLBGEILJ7Qi/MH8/0B9LiPjcz47KOCiCwM1ji+MSQmXpfwbzZPykKMnEferHw0y+uL+2bq0NePgn1D0eEvusnnLnJliNtJVdDxaXedgjly6InNW8VYOJbhiyZ6rNDo3n5JY3n8IPm/7nvjxOYDlq6ka59c5wP7uSy82CRfHgrIsRtvklr7hj1CscKeF4wVSioIljy0uAcxQvE8J8FC2T0yLemrUFTmB/HkBCkDZTkJgKm7IJoEnQWOezFzI2GPlIEYhRzOWpnImpWlFfhLVAkZvxHSC8/+cozi/4Ezzl4kRRN8pVo55hvz5F6CJ5kv2UkT7bAAIIOCxQTQ2/CvwGiTRULzX/r8fS8pBABApoGb83k8KH+CIxjDQfQI1NaN3XWUOlr6tGjdvR0Zle6ck4P+B8nZMCSJr5bIdUdImrcC0t6J6F05UcPGXa0UKTW7nPSFlakfwm7CxPPclP9T89GhMla5Tj3iJoNq5MY6/9Lm9XYc7lG6RpgKNmK1m8g01yOho8XyZ03/fhpsRtfNn+7+PpusqMx6xx1tbV5R+VFBSn2ZLRq6N8cXGi5GthBO7EtphVCmq9ke1TKeMkLG60h2VxVsE61hiW79mbaNLV/muUU76A2MOW8bjc1pqhLreSnEuoZz7sog34D/+3oUFSXcqXD2RfVtMZIPoBeEU4eTa/Xcyd6v4ULsGfgMAqUT99sv//tBdxZ2xOTfPbTdv0LVe2o8/cxC/CkdDEn4IAKhfHqILc9q+GPnCaoTThDO+cbgCrq0v43T1GRAlKaPMiHUsJTIUBD7KlviBQvYfQkf6TRFCY+CfSmxoXLHc0EY/g/HBNi2dHCqJA0c07a1Sn0VI+XSmKQmLd2o6NXfx0BuVksOWcKsurMfp9tDQRUHp7m1S94EjN5UtTe8ysiIY1XSkILfz1tdjJUb53RtbEyvtVpjv4mEo3o2WSXFXTuyv+qlWj/3bonsjt6yxX85IRvK1aoAZ2xeOSFxM9HhObKMdwKkOt4jcVPlfWreKJh1lorFiKP96OyvDyk0YerW18pCaMH9Yotvv2ViDAq31ly4XNh96N8/52opWcL+FaOfyoLbtTFX1XPKh7ky74iwEBW48tU0FMaGtl98wmBi3VLKusrzs5sBPElvSeHVud6y8PWPfWY2Sog03NbefHJP4O7NAOwm1F/JCLGcyPPlSmTCAvBeHz0Ltpj//6cYcRs6lt4NgG6rZL2J5ncK8fz0Ghgw+HnFKAqjGFVqNAljkwPbji862R/QSKy7Q4jl80gRd56ht/2Ea6Xy4ef0b5yKvchnZhm5gmCF6HBKI0z4U2dr3spfdyqaypfkMuW/6Rc451lQStx990lpXsUembHPyAaWAVNIffABWQrUeJ6f+OpszyXr7PGsBwjck+/lo4Je+CiOXSk9ljc0P99VFA1GM5KA18mSoU5iN59EzLX8AAA=", "idCat": "nutriestilo", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat6'), "icon": "data:image/webp;base64,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", "idCat": "comunicacion", "questions": [] },
      { "title": this.translate.instant('categoriesPatients.list.cat7'), "icon": "data:image/webp;base64,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", "idCat": "actividades", "questions": [] },
    ];

    this.categoriesCaregivers = [
      { "title": this.translate.instant('categoriesCaregivers.list.cat1'), "icon": "data:image/webp;base64,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", "idCat": "treatAndDrugs", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat2'), "icon": "data:image/webp;base64,UklGRqIJAABXRUJQVlA4WAoAAAAwAAAAOwAAOwAASUNDUKACAAAAAAKgbGNtcwRAAABtbnRyUkdCIFhZWiAH5wAMAAQACwAFABNhY3NwTVNGVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1kZXNjAAABIAAAAEBjcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaGFkAAABrAAAACxyWFlaAAAB2AAAABRiWFlaAAAB7AAAABRnWFlaAAACAAAAABRyVFJDAAACFAAAACBnVFJDAAACFAAAACBiVFJDAAACFAAAACBjaHJtAAACNAAAACRkbW5kAAACWAAAACRkbWRkAAACfAAAACRtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACQAAAAcAEcASQBNAFAAIABiAHUAaQBsAHQALQBpAG4AIABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABQAHUAYgBsAGkAYwAgAEQAbwBtAGEAaQBuAABYWVogAAAAAAAA9tYAAQAAAADTLXNmMzIAAAAAAAEMQgAABd7///MlAAAHkwAA/ZD///uh///9ogAAA9wAAMBuWFlaIAAAAAAAAG+gAAA49QAAA5BYWVogAAAAAAAAJJ8AAA+EAAC2xFhZWiAAAAAAAABilwAAt4cAABjZcGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltjaHJtAAAAAAADAAAAAKPXAABUfAAATM0AAJmaAAAmZwAAD1xtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAEcASQBNAFBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJBTFBIjQIAAAGQRG3b8Tjvn9q2bdvWuLZt27Zt2+1qbNu2bf2Zk2eR7598X7rrKiImgP6PVhk+DsypkNWyLMtqWS2rZVmuSHI8314fTKKBWFd3F1s7W1tbeycvT3dbW1tb93zgS1tRNe6j4HJn4lnVwAJZ4wS9h3sH4r6ouHiQkJ2wqkPModtXt9OJxpdG1hbQoji1NbG9APztowvtwXkBF7GflDQAiscRNT/mU47g5wO0KDarBr8AdT2l9wA0yGxmVgSmK+MkDLg1gjUpLwLToQLsy4wRuMytL55WonoiQzm7HaMxnnAbiodKU34UVE5jTEwJL7gNUarzAbpmDVd6y62LQm0nQKMDikcpPOPWT+ELAJgNmZpZGWS0ZT3nNpQ1HoAG5x/fLa4UXmip8ESUDXC4Pzh2JCIJzwQ1A6KrWvI4Jag/wxS4MAg8LRkvuA1k7AdOHONgH51IRCo84jaUsQs8P06TvKEXx1ll/gGlAOIerh2+BUNICi8lIgmPBa3RcsVmIp9QaxTvJNqAIdSwyJ/xSFA/ADsaYS+RjxWtKcDXehtguDIIT/SC0vCIWuDlhlUxNkR9MpEdDu05+nEVK+eFQ/eihvrRuSwPPO+ToEEsOgeeaU1EtcdLRlUnDuUGpN1DABUGMKi+s04l84m5CDv5/UUXBtU4r2aEljG8hxP7O/rwM8ITFlGLnS9fPJpbpdOpV+9vzZKI3bUsgPirvDRTFPhKjjAWQH1KCsYJUD3HNxI6RVafrsWruxUcaouhYZHIfb7MwMDQwNBozrw5piamxqYGxoYG28yBb7VJdI0dMeDsYkR62X3Fhg2bNm3YumH73p37Du3dcnrLrg2L25J+S0QSVSWpilRFIhX969I/9Z8lAFZQOCBGBAAAkBYAnQEqPAA8AD4xFolDoiEhFAQAIAMEsgBiDjHJM8z7y+Td2r6kNsn5i/4Z/Rv9h1kfQA/XTrD/QA/YD02fY7/bT0nbm5+HP6S9q77NPocUbJSdarR/nvEBpNfiHnS9BjPC9P/9j3A/41/Rv9z9tfgc/Y72Iv1mS9rLRUX63dRLzXcqOZhXRc348AG5sdDGtrxK0CEmfnOXNTOnM9EamnxZjpWC0iVOP/CpYRQRv0/jFqXToVNSPK/jER4AAP7//koLgZjf4r3Lj+WfQ/DpMgHkPTghQ0eCyQf0mRU4rxGZI0xR4lydw/9W6BrkTSQkG3Vu92C9oLaW7Hj0ny6DrbiD763xy0yzZsQ/GXVd0Ck9zvcVAi/M+P77NCjlrvhvR57s2HxSuUSCzntAWGzypFZ2FpJ+Zvv5zFN5KD2crv2cDBIfTRJc4qzGpPEAQaVm/LqaLmmzfQCQ57v1akLn/qtm4JGFtB/FcBydPcN+38/a6DjjNyLufuJz50GLwTGUpFVbU/m5uzLYlZNGlHUPxc7fji8Wfsk6DkYL49s4L7fzo0CjDxkMRqPVn8sv7c1KyDvrM9e7Lx6SR/VV5Yr92OBcdYCkPwRisqKJEpfbSzKR9vPDq5t6x/4yOFGGrCyziS4DveIY3A+m49MkWRbI9wgdVbHHUtcsmBqF55VFcLgMOOnj/5yH+pmFWru+3XwB/ONuXzCzOHuZtc94hHmcpMgyOfzsqGO0Vgb5R4GEsK87OdLhTv3cP7EkkjAPmFkqV7X8+p48UL0vb2D8BvGTRYEfVPwkvl4dPsH09q59DZJKzNyZx1hl8WBj1bhgLo2l0MG7WeNwC01sD3w3IHVPr8PN8/LH2XQzmsO78LI8Nl+3VzmNAmc/h14Var5tz79r9KrEzR8I09gjctB3dOBHSq4TC4/jCMkidLouUc1+5N9lknQdTYF/vk/CWmbFOvWvA8g0WeKcbARxc7F/UfQrwnCncOq9Mdj8dTqvcSdkt2IImxN+yIYLikeiAYhawszYrT1IZrxWvX6pL0b3zImSpowzDh17xqIkkJv84cjJ5D49VQOKvPjq04rJc9mV5b8QK5oRAI0rkMZg3/sqql4k5LHLxAGnxQV6v5UokXv/e7qhTMv6ZtEcHlBB8yuSNcy/oxq2fWWtYUof37wYpjWrZ0pNM7vTxQCYHC55PHE+D+d1N8oYH7y44lYe9O0fyXUyox3VwZKu2d4msgYSXHJTerov3HXPARh7VvN8HFS3n8wfnFcMVMmXrKOQEgNa5ILy8ythVYK8yVqKDs27WH4vjb4lfXZD03bcQyX56KrFCCq07YbDxRjhgGEPIbC6y9sJx/eNDe6YSVBbh/2DU98ocuhEVKSxmBwN2GRIo8LDXMRFAq7g3c3/oH/lcc/vCgB9nt/igb7mOc86gLQNPAyn4vE1JIyBRMRl9rzWnsZgyELoGqDAAAA=", "idCat": "nutridiet", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat3'), "icon": "data:image/webp;base64,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", "idCat": "emeaid", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat4'), "icon": "data:image/webp;base64,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", "idCat": "suppment", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat5'), "icon": "data:image/webp;base64,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", "idCat": "commuhealth", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat6'), "icon": "data:image/webp;base64,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", "idCat": "comunicacion", "questions": [] },
      { "title": this.translate.instant('categoriesCaregivers.list.cat7'), "icon": "data:image/webp;base64,UklGRoYJAABXRUJQVlA4WAoAAAAwAAAAOwAAOwAASUNDUKACAAAAAAKgbGNtcwRAAABtbnRyUkdCIFhZWiAH5wALAB4AEQAdAClhY3NwTVNGVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1kZXNjAAABIAAAAEBjcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaGFkAAABrAAAACxyWFlaAAAB2AAAABRiWFlaAAAB7AAAABRnWFlaAAACAAAAABRyVFJDAAACFAAAACBnVFJDAAACFAAAACBiVFJDAAACFAAAACBjaHJtAAACNAAAACRkbW5kAAACWAAAACRkbWRkAAACfAAAACRtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACQAAAAcAEcASQBNAFAAIABiAHUAaQBsAHQALQBpAG4AIABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABQAHUAYgBsAGkAYwAgAEQAbwBtAGEAaQBuAABYWVogAAAAAAAA9tYAAQAAAADTLXNmMzIAAAAAAAEMQgAABd7///MlAAAHkwAA/ZD///uh///9ogAAA9wAAMBuWFlaIAAAAAAAAG+gAAA49QAAA5BYWVogAAAAAAAAJJ8AAA+EAAC2xFhZWiAAAAAAAABilwAAt4cAABjZcGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltjaHJtAAAAAAADAAAAAKPXAABUfAAATM0AAJmaAAAmZwAAD1xtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAEcASQBNAFBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJBTFBIhgIAAAGQBNu2aTvr4dv/x7b93o9t27Zt27Zt27Zt27aT1TjnXMVpRcQE4L/OgB57VlX+UfwOkuT4H6QDpVmt4uUKd7tdYmwAO2TdrLKYGtMBm2QthNBiw099r2vOJA0v4gM1JF8TIvbAYxRvmgPYIsSM4OWEfArJb/WBLVTGNElv3l4d4wGYpapmUODISdJeGuxpXb6Ql1cVMqg+lW4gbr1Bsw49JfmisCyK8PTd08QwOHTqwoXz50+f1M+GKl+ofhdbgl5bzjDqFEYzSqv/E2pti5QCUJ4VyrG6ec0p/Xz0piS8uiSUC6NxrkG2NTcvn7p8fQ7geY9kW3cwMJVkNjS46hGh8915OP4Qux8aFPEzxXc21CK5B+Jt8q0HlnP3O/K1vR9T96fbGOSpJ2YCTpEsI8QguRb2V5Tmys1OudnJaYy6JMkrEOuTbI98lF4Pd7zbm59Pv513mDGJZCPJQpLpUJvk+9nZ4dPrMaU59NX8zu8kLwSgEHnLV/KEfAI4Wk9qEQFALSp76htCeQwgW90IEJORXAGNxVV79PnkLSwmhtZmJPtqCVXN0mfoYJJcm1WFwyTfr+ucBZbMKZD7Syqyreqe3Qmj7U6lQ/AFun0XyPO1HYKprvdUjwMi7/QEYk78KJA3i5pVjBrXAKO4zQUg8qDXAj+lNQnJ3C6lH2J8JpkDAAJbPyLJuWZpn0ByJ+TOESSPmufIX0Ne7zPJrArEssZmal4OdYglYlJ7KovhsqausFrU7pOUvTPBcob/uvxJ7v5hsIas8OMgcxL8tQwsNGjWyr3Hrz24//D+zSuH1s+b2jil3TJhpZdcuH3v9tVrV25eu3b86OGt45tEsw4Am8MzwGHDP0JWUDggMgQAALAVAJ0BKjwAPAA+MRKIQyIhCoWbFhABglqAM0JrtveLX1X8Veb+4Q76ZOX0S8wH0d9Df2zejd1EfMBugHSQegB+qvpNfsz8Hvkyf/StU8vPrU+g34OObUF8A83XnR55nm//oe4H/IP57/zuA3/V1wlyKSE9sZKcwj2ISSSZ8YPI9tY6fLmRRVMd/y0S6RVVqLJL6FZ9yc5bvMDA74yPdZSbTSIhd09JObE9oc2Zddfj/ai/5IUAAP7/NdRy3S/LKMs/qjH/eMe/4rHp/AVuuSjnb9/3BhScFinkHjBJ2tYAW6uKEK+/1IW0+Ns2qs7Ro534125XzpR6SkWmvCL9lp2f5aSQa+ZN4PxQwW02Zu4NXP9sLLEwAjT71UO5w9EN8e6cg1ZaMtwPwVPtU3Em0RRmqPknBSxskdN1cg0RUHrJ7L4a/6v6jmOG0WjFNF3TROi9Jc/gBaWYey+Fd0tPfN+5eP+2OQp76S/3JC4M8isjLoHnnlU34jK1A+StINllF255VZZG9kSM//v1CM2v+Rd0O5YdG9Odq3Xv9uskRyf7t1Uf5otAPUCEVHX152J/z3kkRErR+CVMW3937AXfDU6MTbWm/jjAGzV9S0w+U0WpmoASUItGYppw3RCc3p3EJko7s5p4evGc72fsTA71SGoIKWI1kvA/KD/4RQ7tw975e0G0V2dik5fEx1lSnVUR69wK3Ws9putJMQ3HgzMtNnig+nLE/O3y6OZvTymqppLI5y71l8CE/lHnP0c4LmDGX6ClwRH6kpNjjJzHvyf2iG01Lh1uo2I42l4ttlzFKK7WKLoaOwVG3yi+PEKSWV+oP+CYvZA3M/zG2/oqffKarcdxCyktYLOn5V65+v1v+oxlVhrP09S45sU/GbByw0S63HiNd8gmn2W4HoWg01i8JHUqRGJQd4JlGOKKFlIcq7K53O8GgHYpmDaMqlOkzyHVajzj9S4hFnFjYd8KXigr9N/fMgthNfgtP4hAGWo2JwfkfBKAcNeufBkfshdhnRU5tuNcqqgtKlZcWzU+df4d+K4ejKUqFaECyToNj/eA/dOQzJHWcljvCVgs1ZUxbv56Y8Ahx5Z1sXgfq8BT7BLF/+ZfIMjABR4RC6v2JWLg2xvsBcY/uivKiVJ/Vzvz/Oi35e1TwWot1QVvp3xmITt7Q1etymIvdRae8u5pLBXLxjHprhcVv+vid80k4q0wiw3qxRgLVhwKIH9oAGNgTP1vGF2vjKtJ9dPxXMVFl16ltLo5pKx6gdAhpOddc6cySd+jqackJ25GGRMfu97sI7T1SN4f7ie+z0cyz/yrulki7aVQzNAYsCymH/LXShe8oroIAK+1H7vNrxlUBLLgcf8SiBibbnmH8uYHs4jVtT/5+1Mm2gKDS+TxMG3D37ECLZ+A01NyaxCoUgDlhYm13whSIAAAAA==", "idCat": "actividades", "questions": [] },
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

    // Filtrar steps según el rol
      if (this.role === 'Caregiver') {
        steps = steps.slice(1); // Elimina el primer step
      }

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
  get efappointment() { return this.appointmentsForm.controls; }

  async ngOnDestroy() {
    //save this.messages in bbdd
    if (this.currentPatient) {
      await this.saveMessages(this.currentPatient);
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    if (this.patientSubscription) {
      this.patientSubscription.unsubscribe();
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

  saveMessages(pacient) {
    return new Promise((resolve, reject) => {
      //delete messages with task 
      var messages = [];
      this.messages.forEach(element => {
        if (element.task == undefined && element.file == undefined) {
          if (element.text.toString().indexOf('<form>') == -1) {
            messages.push(element);
          }
          /*if (element.text.toString().indexOf('<strong>') == -1 && element.text.toString().indexOf('<form>') == -1 ) {
            messages.push(element);
          }*/
        }
      });
      var info = { 'messages': messages };
      this.subscription.add(this.http.post(environment.api + '/api/messages/' + this.authService.getIdUser() + '/' + pacient, info)
        .subscribe((res: any) => {
          resolve(res);
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          resolve(err);
        }));
    });
  }

  getMessages() {
    this.subscription.add(this.http.get(environment.api + '/api/messages/' + this.authService.getIdUser() + '/' + this.currentPatient)
      .subscribe(async (res: any) => {
        if (res.messages != undefined) {
          if (res.messages.length > 0) {
            this.messages = res.messages;
            await this.delay(200);
            this.scrollToBottom();
          } else {
            this.messages = [];
          }
        } else {
          this.messages = [];
        }
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
    return date === null;
  }

  async ngOnInit() {
    this.showCameraButton = this.isMobileDevice();

    // Precargar imagen DxGPT
    const dxGptLogo = new Image();
    dxGptLogo.src = 'assets/img/logo-dxgpt.png';

    this.subscription.add(this.authService.currentPatient$.subscribe(patient => {
      console.log('patient', patient);
      if (patient) {
        this.isInitialLoad = false;
        this.initEnvironment();
      }else{
        if (!this.isInitialLoad) {
          console.log('patient is null, redirecting to patients');
          this.router.navigate(['/patients']);
        }
        this.isInitialLoad = false;
      }
    }));
    
    this.patientSubscription = this.authService.currentPatient$.subscribe(patient => {
      if (patient && patient.sub) {
        this.currentPatientId = patient.sub;
        // Si cambias de paciente y estabas en la vista dxgpt, podrías querer limpiar resultados
        if (this.currentView === 'dxgpt') {
          this.dxGptResults = null;
        }
      } else {
        this.currentPatientId = null;
        this.dxGptResults = null; // Limpiar si no hay paciente
      }
    });
    let currentLang = this.translate.currentLang;
    await this.updateSuggestions(currentLang);
    this.getTranslations();
    this.suggestions = this.getAllSuggestions(4);

    this.messageSubscription = this.webPubSubService.getMessageObservable().subscribe(message => {
      this.handleMessage(message);
    });

    this.eventsService.on('eventTask', this.handleEventTask.bind(this));
    this.eventsService.on('changelang', this.handleChangeLang.bind(this));
    this.eventsService.on('patientChanged', this.handlePatientChanged.bind(this));
    this.eventsService.on('changeView', this.handleChangeView.bind(this));
    

    if (this.authService.getRole() === 'Caregiver') {
      this.currentView = 'diary';
    } else {
      this.currentView = 'chat';
    }
  }

  setView(view: string) {
    this.currentView = view;
    if(view === 'documents'){
      this.sidebarOpen = true;
      this.notesSidebarOpen = false;
    }else if(view === 'diary'){
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
    }else if(view === 'chat'){
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
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
    }else{
      this.sidebarOpen = false;
      this.notesSidebarOpen = false;
    } 
    this.scrollToTop();
  }

  handleChangeView(view: string) {
    this.currentView = view;
  }


  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // RareScope methods
  addNewNeed() {
    this.additionalNeeds.push('');
  }

  onNeedBlur(event: any, index: number) {
    const content = event.target.innerText.trim();
    if (index === 0) {
      this.rarescopeNeeds[0] = content;
    } else {
      this.additionalNeeds[index - 1] = content;
    }
    // Aquí podrías guardar los datos en el servidor si es necesario
  }


  handlePatientChanged(patient: any) {
    this.saveMessages(patient.sub);
  }


  private async handleMessage(message: any) {
    console.log('Message received in component:', message);
    this.actualStatus = '';

    const parsedData = JSON.parse(message.data);

    if (!parsedData.step) {
      if (this.isActualPatient(parsedData.patientId)) {
        this.handleNoStep(parsedData);
      }
    } else {
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

  isActualPatient(patientId: string): boolean {
    const currentPatient = this.authService.getCurrentPatient();
    if (currentPatient && currentPatient.sub == patientId) {
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
        doc.badge = this.getBadgeClass(parsedData.value);
        doc.categoryTag = this.getTranslatedCategoryTag(parsedData.value);
        doc.originaldate = this.isValidDate(parsedData.date) ? new Date(parsedData.date) : null;
      }

      if (!this.isDocStatusFinal(doc.status)) {
        doc.status = this.getNewDocStatus(parsedData.status);
        this.docs[docIndex] = doc;
      }
    }
  }

  private isValidDate(date: string): boolean {
    return !isNaN(new Date(date).getTime());
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

  addMessage(message: any) {
    if (message.text) {
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
      this.translateAnomalies(parsedData.anomalies).then(translatedAnomalies => {
        this.addMessage({
          text: '<span class="badge badge-warning mb-1 mr-2"><i class="fa fa-exclamation-triangle"></i></span><strong>' + parsedData.filename + '</strong>: ' + this.translate.instant('messages.anomaliesFound') + '<br>' + translatedAnomalies,
          isUser: false
        });
      });
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
      this.callingOpenai = false;
      console.error(parsedData.error);
      this.insightsService.trackException(parsedData.error);
    } else {
      this.updateNavigatorStatus(parsedData);
    }
  }

  private async processNavigatorAnswer(parsedData: any) {
    // Limpiar el estado inmediatamente al recibir la respuesta
    this.callingOpenai = false;
    this.gettingSuggestions = false;
    this.actualStatus = '';
    
    this.context.push({ role: 'user', content: this.message });
    this.context.push({ role: 'assistant', content: parsedData.answer });
    let tempMessage = this.message;
    this.message = '';

    try {
      await this.translateInverse(parsedData.answer);
    } catch (error) {
      console.error('Error al procesar el mensaje:', error);
      this.insightsService.trackException(error);
    }

    const query = {
      question: tempMessage,
      answer: parsedData.answer,
      userId: this.authService.getIdUser(),
      patientId: this.currentPatient,
      initialEvents: this.initialEvents
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
      'intent detectado': parsedData.intent,
      'generando respuesta': 'generando respuesta',
      'generando sugerencias': 'generando sugerencias',
      'respuesta generada': 'respuesta generada',
      'sugerencias generadas': 'sugerencias generadas'
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
    } else if (parsedData.status === 'respuesta timeline analizada') {
      this.processExtractedAppointments(parsedData.events);
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

  private processExtractedAppointments(events: any[]) {
    let index = this.messages.length - 1;
    while (index >= 0) {
      if (!this.messages[index].isUser) {
        if (events.length > 0) {
          this.messages[index].events = events;
          const jsontestLangText = events.map(event => ({
            Text: event.insight
          }));

          if (this.detectedLang !== 'en') {
            this.subscription.add(
              this.apiDx29ServerService.getTranslationInvert(this.detectedLang, jsontestLangText)
                .subscribe({
                  next: (res2: any) => {
                    if (res2[0]) {
                      res2.forEach((translation: any, i: number) => {
                        if (translation.translations[0]) {
                          events[i].insight = translation.translations[0].text;
                        }
                      });
                    }
                    this.proposedAppointments = events;
                  },
                  error: (err) => {
                    console.log(err);
                    this.insightsService.trackException(err);
                    this.proposedAppointments = events;
                  }
                })
            );
          } else {
            this.proposedAppointments = events;
          }
        }
        break;
      }
      index--;
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

    this.messagesExpect = this.translate.instant(`messages.${this.actualStatus}`);
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
    this.proposedAppointments = [];
    this.initChat();
    this.context.splice(1, this.context.length - 1);
    await this.saveMessages(this.currentPatient);
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
    this.containerName = this.currentPatient.substr(1);
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
    this.accessToken.containerName = this.containerName;
    this.accessToken.patientId = this.currentPatient;

    this.subscription.add(this.apiDx29ServerService.getAzureBlobSasToken(this.accessToken.containerName)
      .subscribe((res: any) => {
        this.accessToken.sasToken = '?' + res;
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
          resDocs.sort(this.sortService.DateSortInver("date"));
          this.docs = resDocs;
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
        }
        this.loadedDocs = true;
        this.assignFeedbackToDocs(this.docs);
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
        eventsResponse.sort(this.sortService.DateSort("dateInput"));
        if (!newEvent) {
          this.allTypesEvents = eventsResponse;
          this.allEvents = eventsResponse;
        }
        for (let i = 0; i < eventsResponse.length; i++) {
          eventsResponse[i].dateInput = new Date(eventsResponse[i].dateInput);
          let dateWithoutTime = '';
          if (eventsResponse[i].date != undefined && eventsResponse[i].date.indexOf("T") != -1) {
            dateWithoutTime = eventsResponse[i].date.split("T")[0];
          }
          if (eventsResponse[i].key != undefined) {
            this.initialEvents.push({
              "insight": eventsResponse[i].name,
              "date": dateWithoutTime,
              "key": eventsResponse[i].key
            });
          }
          this.metadata.push({ name: eventsResponse[i].name, date: dateWithoutTime });
        }
        this.events = eventsResponse;
      }
      await this.loadBasicData();
      await this.loadAppointments();

      if (this.appointments.length > 0) {
        for (let i = 0; i < this.appointments.length; i++) {
          this.appointments[i].date = new Date(this.appointments[i].date);
          let fechaFormatoISO = this.appointments[i].date.toISOString();
          let soloFecha = fechaFormatoISO.split('T')[0];
          this.metadata.push({ name: this.appointments[i].notes, date: soloFecha });
        }
      }

      const patientInfo = this.metadata;
      if (this.context.length > 0) {
        this.context[0] = { role: "assistant", content: patientInfo };
      } else {
        this.context.push({ role: "assistant", content: patientInfo });
      }

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

  sendMessage() {
    if (!this.message) {
      Swal.fire(this.translate.instant("generics.Please write a message"), '', "warning");
      return;
    }
    if (this.callingOpenai) {
      Swal.fire(this.translate.instant("generics.Please wait"), '', "warning");
      return;
    }

    this.addMessage({
      text: this.message,
      isUser: true
    });
    this.suggestions = [];
    this.detectIntent();
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

  detectIntent() {
    this.proposedEvents = [];
    this.proposedAppointments = [];
    this.callingOpenai = true;
    this.actualStatus = 'procesando intent';
    this.statusChange();
    var promIntent = this.translate.instant("promts.0", {
      value: this.message,
    });
    this.valueProm = { value: promIntent };
    this.tempInput = this.message;
    var testLangText = this.message
    if (testLangText.length > 0) {
      this.subscription.add(this.apiDx29ServerService.getDetectLanguage(testLangText)
        .subscribe((res: any) => {
          if (res[0].language != 'en') {
            const detectedLanguage = res[0].language;
            const confidenceScore = res[0].score;
            const confidenceThreshold = 0.7;
            if (confidenceScore < confidenceThreshold) {
              console.warn('Confianza baja en la detección del idioma, usando el idioma preferido del usuario.');
              this.detectedLang = this.preferredResponseLanguage || 'en'; // Fallback a ingles si no hay preferencia
            } else {
              this.detectedLang = detectedLanguage; // Usa el idioma detectado

            }

            var info = [{ "Text": this.message }]
            this.subscription.add(this.apiDx29ServerService.getTranslationDictionary(this.detectedLang, info)
              .subscribe((res2: any) => {
                var textToTA = this.message;
                if (res2[0] != undefined) {
                  if (res2[0].translations[0] != undefined) {
                    textToTA = res2[0].translations[0].text;
                    this.tempInput = res2[0].translations[0].text;
                  }
                }
                promIntent = this.translate.instant("promts.0", {
                  value: textToTA,
                });
                this.valueProm = { value: promIntent };
                this.continueSendIntent(textToTA);
              }, (err) => {
                console.log(err);
                this.insightsService.trackException(err);
                this.continueSendIntent(this.message);
              }));
          } else {
            this.detectedLang = 'en';
            this.continueSendIntent(this.message);
          }

        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          this.toastr.error('', this.translate.instant("generics.error try again"));
        }));
    } else {
      this.continueSendIntent(this.message);
    }
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
    console.log('Context before call:', this.context);
    // Ensure context is not empty
    if (!this.context || this.context.length === 0) {
      console.warn('Context is empty, initializing with default values');
      this.initializeContext();
    }

    let docsSelected = this.docs.filter(doc => doc.selected && (doc.status == 'finished' || doc.status == 'done' || doc.status == 'resumen ready')).map(doc => doc.url);
    console.log(docsSelected)
    var query = { "question": msg, "context": this.context, "containerName": this.containerName, "index": this.currentPatient, "userId": this.authService.getIdUser(), "docs": docsSelected };
    this.subscription.add(this.http.post(environment.api + '/api/callnavigator/'+this.authService.getCurrentPatient().sub, query)
      .subscribe(async (res: any) => {
        if (res.action == 'Data') {

        } else if (res.action == 'Question') {

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
        console.log(err);
        this.insightsService.trackException(err);
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

  translateSuggestions(info, hardcodedSuggestion = undefined) {
    if (this.detectedLang != 'en') {
      var jsontestLangText = [];
      for (var i = 0; i < info.length; i++) {
        if (info[i] !== hardcodedSuggestion) {
          jsontestLangText.push({ "Text": info[i] });
        } else {
          info[i] = hardcodedSuggestion;
        }
      }

      this.subscription.add(this.apiDx29ServerService.getTranslationInvert(this.detectedLang, jsontestLangText)
        .subscribe((res2: any) => {
          if (res2[0] != undefined) {
            for (var i = 0; i < res2.length; i++) {
              if (res2[i].translations[0] != undefined && info[i] !== hardcodedSuggestion) {
                info[i] = res2[i].translations[0].text;
              }
            }
          }
          this.suggestions = info;
          this.gettingSuggestions = false;
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          this.suggestions = info;
          this.gettingSuggestions = false;
        }));
    } else {
      this.suggestions = info;
      this.gettingSuggestions = false;
    }
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

  async translateInverse(msg): Promise<string> {
    return new Promise((resolve, reject) => {

      if (this.detectedLang != 'en') {
        var jsontestLangText = [{ "Text": msg }]
        this.subscription.add(this.apiDx29ServerService.getDeepLTranslationInvert(this.detectedLang, jsontestLangText)
          .subscribe((res2: any) => {
            if (res2.text != undefined) {
              msg = res2.text;
            }
            this.addMessage({
              text: msg,
              isUser: false
            });
            this.callingOpenai = false;
            this.saveMessages(this.currentPatient);
            resolve('ok')
          }, (err) => {
            console.log(err);
            this.insightsService.trackException(err);
            this.addMessage({
              text: msg,
              isUser: false
            });
            this.callingOpenai = false;
            this.saveMessages(this.currentPatient);
            resolve('ok')
          }));
      } else {
        this.addMessage({
          text: msg,
          isUser: false
        });
        this.callingOpenai = false;
        this.saveMessages(this.currentPatient);
        resolve('ok')
      }
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
      key: [''],
      notes: []
    });
    //if no date, set today
    if (!info.date) {
      info.date = new Date();
    }
    //info.date = this.dateService.transformDate(new Date());
    this.eventsForm.patchValue(info);
    this.showProposedEvents();
    this.callingTextAnalytics = false;
    this.callingOpenai = false;
  }

  showFormAppointment(info) {
    if (this.detectedLang != 'en') {
      var textToExtract = info.name;
      var jsontestLangText = [{ "Text": textToExtract }]
      this.subscription.add(this.apiDx29ServerService.getDeepLTranslationInvert(this.detectedLang, jsontestLangText)
        .subscribe((res2: any) => {
          if (res2.text != undefined) {
            info.name = res2.text;
          }
          this.addFormAppointment(info);
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          this.addFormAppointment(info);
        }));

    } else {
      this.addFormAppointment(info);
    }
  }

  addFormAppointment(info) {
    Swal.close();
    //this.eventsForm.reset();
    this.appointmentsForm = this.formBuilder.group({
      name: ['', Validators.required],
      date: [new Date()],
      key: ['appointment'],
      notes: []
    });
    //if no date, set today
    if (!info.date) {
      info.date = new Date();
    }
    //info.date = this.dateService.transformDate(new Date());
    this.appointmentsForm.patchValue(info);
    this.showProposedAppointments();
    this.callingTextAnalytics = false;
    this.callingOpenai = false;
  }

  dateGreaterThan(dateField: string): any {
    return (control: any): { [key: string]: any } => {
      const dateInput = control.value;
      const dateFieldControl = control.root.get(dateField);
      if (dateFieldControl && dateInput && dateFieldControl.value && dateInput <= dateFieldControl.value) {
        return { 'dateGreaterThan': true };
      }
      return null;
    };
  }

  get date() {
    //return this.seizuresForm.get('date').value;
    let minDate = new Date(this.eventsForm.get('date').value);
    return minDate;
  }

  get dateAppointment() {
    //return this.seizuresForm.get('date').value;
    let minDate = new Date(this.appointmentsForm.get('date').value);
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

      if (this.eventsForm.value.date != null) {
        this.eventsForm.value.date = this.dateService.transformDate(this.eventsForm.value.date);
      }

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
        this.checkIfNeedFeedback(contentSummaryDoc, documentsToCheck, 'individual')
        this.loadEventFromDoc(doc);
      }, (err) => {
        this.openingResults = false;
        console.log(err);
        this.insightsService.trackException(err);
        this.toastr.error('', this.translate.instant('messages.msgError'));
      }));
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
          resDocs.sort(this.sortService.DateSortInver("date"));
          this.docs = resDocs;
          for (var i = 0; i < this.docs.length; i++) {
            const fileName = this.docs[i].url.split("/").pop();
            this.docs[i].title = fileName;
            if (this.docs[i].categoryTag) {
              this.docs[i].badge = this.getBadgeClass(this.docs[i].categoryTag)
              this.docs[i].categoryTag = this.getTranslatedCategoryTag(this.docs[i].categoryTag);
            }

          }
          this.docs.forEach(doc => doc.selected = true);
          this.assignFeedbackToDocs(this.docs);
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
          this.checkIfNeedFeedback(this.contentviewSummary, documentsToCheck, 'general')
        } else {
          this.getPatientSummary(true);
        }
        //this.resultText = res;
        /*let ngbModalOptions: NgbModalOptions = {
          keyboard: false,
          windowClass: 'ModalClass-sm' // xl, lg, sm
        };
        if (this.modalReference != undefined) {
          this.modalReference.close();
          this.modalReference = undefined;
        }
        this.modalReference = this.modalService.open(this.contentviewSummary, ngbModalOptions);*/

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
    this.jsPDFService.generateResultsPDF(this.summaryJson.data, localStorage.getItem('lang'), null)

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
      'other': `${this.translate.instant('timeline.Other')} 🔍`
    };

    return types[type] || type;
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

  addProposedEvent(event) {
    this.eventsForm = this.formBuilder.group({
      name: ['', Validators.required],
      date: [new Date()],
      notes: [],
      key: []
    });
    if (event.date != undefined) {
      event.date = new Date(event.date);
    } else {
      event.date = new Date();
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
      notes: '',
      data: event.data,
      key: event.key
    }
    this.showForm(info)
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
        notes: [],
        key: []
      });
      event.date = new Date();
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

  editProposedAppointment(event) {
    console.log(event);
    var info = {
      name: event.insight.toLowerCase(),
      date: event.date,
      notes: '',
      data: event.data,
      key: event.key
    }
    this.showFormAppointment(info)
  }

  addProposedAppointment(event) {
    this.appointmentsForm = this.formBuilder.group({
      name: ['', Validators.required],
      date: [new Date()],
      key: ['appointment'],
      notes: []
    });
    if (event.date != undefined) {
      event.date = new Date(event.date);
    } else {
      event.date = new Date();
    }
    event.name = event.insight;
    event.key = 'appointment';
    //info.date = this.dateService.transformDate(new Date());
    this.appointmentsForm.patchValue(event);
    this.saveAppointmentsData(false, true);
  }

  deleteProposedAppointment(index) {
    this.proposedAppointments.splice(index, 1);
    if (this.proposedAppointments.length == 0 && this.suggestions.length == 0) {
      this.suggestions = this.getAllSuggestions(4);
    }
  }

  deleteAllProposedAppointments() {
    this.proposedAppointments = [];
    if (this.proposedAppointments.length == 0 && this.suggestions.length == 0) {
      this.suggestions = this.getAllSuggestions(4);
    }
  }

  addAllProposedAppointments() {

    let savePromises = [];
    this.proposedAppointments.forEach(event => {
      this.appointmentsForm = this.formBuilder.group({
        name: ['', Validators.required],
        date: [new Date()],
        key: ['appointment'],
        notes: []
      });
      event.date = new Date();
      event.key = 'appointment';
      //info.date = this.dateService.transformDate(new Date());
      this.appointmentsForm.patchValue(event);
      savePromises.push(this.saveAppointmentsData(false, false));
    });
    this.proposedAppointments = [];

    Promise.all(savePromises).then(() => { // cuando todas las promesas se resuelven
      if (this.proposedAppointments.length == 0 && this.suggestions.length == 0) {
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

  saveAppointmentsData(checkForm, loadEvents) {
    return new Promise((resolve, reject) => {
      if (checkForm) {
        if (this.appointmentsForm.invalid) {
          return;
        }
      }
      var actualIndex = 0;
      this.proposedAppointments.forEach((element, index) => {
        if (element.name == this.appointmentsForm.value.name) {
          this.proposedAppointments[index].saving = true;
          actualIndex = index;
        }
      });

      this.submitted = true;
      /*if (this.appointmentsForm.value.date != null) {
        this.appointmentsForm.value.date = this.dateService.transformDate(this.appointmentsForm.value.date);
      }
      console.log(this.appointmentsForm.value.date)*/

      if (this.authGuard.testtoken()) {
        this.saving = true;
        const userId = this.authService.getIdUser();
        this.subscription.add(this.http.post(environment.api + '/api/events/' + this.currentPatient + '/' + userId, this.appointmentsForm.value)
          .subscribe((res: any) => {
            this.saving = false;
            this.proposedAppointments.splice(actualIndex, 1);


            if (this.modalReference != null) {
              this.modalReference.close();
            }
            this.submitted = false;
            if (loadEvents) {
              let newMsg = this.translate.instant('home.botmsg3') + ': ' + this.appointmentsForm.value.name;
              this.addMessage({
                text: newMsg,
                isUser: false
              });
              if (this.proposedAppointments.length == 0 && this.suggestions.length == 0) {
                this.suggestions = this.getAllSuggestions(4);
              }
              this.loadEnvironmentMydata();
            }
            resolve(true);
          }, (err) => {
            this.proposedAppointments[actualIndex].saving = false;
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

  showProposedAppointments() {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    let ngbModalOptions: NgbModalOptions = {
      keyboard: false,
      windowClass: 'ModalClass-sm' // xl, lg, sm
    };
    this.modalReference = this.modalService.open(this.contentviewProposedAppointments, ngbModalOptions);
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
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      // El navegador soporta la funcionalidad
      console.log('soporta')
      this.recognition = new webkitSpeechRecognition();
      let lang = localStorage.getItem('lang');
      if (lang == 'en') {
        this.recognition.lang = 'en-US';
      } else if (lang == 'es') {
        this.recognition.lang = 'es-ES';
      } else if (lang == 'fr') {
        this.recognition.lang = 'fr-FR';
      } else if (lang == 'de') {
        this.recognition.lang = 'de-DE';
      } else if (lang == 'it') {
        this.recognition.lang = 'it-IT';
      } else if (lang == 'pt') {
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
      if (this.medicalText.length > 0) {
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
          } else {
            this.medicalText = '';
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
    if (changeState) {
      this.recording = !this.recording;
    }
  }

  restartRecognition() {
    this.recognition.stop(); // Detiene el reconocimiento actual
    setTimeout(() => this.continueRecording(false, false), 100); // Un breve retraso antes de reiniciar
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
        if (this.modalReference != undefined) {
          this.modalReference.close();
          this.modalReference = undefined;
        }
        this.processFilesSequentially();
      }
    }
  }

  deletephoto(index) {
    this.tempDocs.splice(index, 1);
  }

  finishPhoto() {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    let filePromises: Promise<void>[] = [];
    if (this.nameFileCamera == '') {
      this.nameFileCamera = 'photo-' + this.getUniqueFileName();
    }
    let filePromise = new Promise<void>((resolve, reject) => {
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
        if (extension == '.jpg' || extension == '.png' || extension == '.jpeg' || file.type == 'application/pdf' || extension == '.docx' || file.type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type == 'text/plain' || extension == '.txt') {
          var uniqueFileName = this.getUniqueFileName();
          filename = 'raitofile/' + uniqueFileName + '/' + filename + extension;
          let dataFile = { event: file, url: filename, name: file.name }
          this.tempDocs.push({ dataFile: dataFile, state: 'false' });
          resolve();
          /*let index = this.tempDocs.length - 1;
          this.prepareFile(index);*/
        } else {
          Swal.fire(this.translate.instant("dashboardpatient.error extension"), '', "warning");
          this.insightsService.trackEvent('Invalid file extension', { extension: extension });
          reject();
        }
      }
    });
    filePromises.push(filePromise);

    Promise.all(filePromises).then(() => {
      this.processFilesSequentially();
    }).catch(() => {
      console.log("One or more files had invalid extensions. Stopping the process.");
    });


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

    events.forEach(event => {
      const monthYear = this.getMonthYear(event.date).getTime(); // Usar getTime para agrupar
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(event);
    });

    return Object.keys(grouped).map(key => ({
      monthYear: new Date(Number(key)), // Convertir la clave de nuevo a fecha
      events: grouped[key]
    }));
  }


  private getMonthYear(dateStr: string): Date {
    const date = new Date(dateStr);
    return new Date(date.getFullYear(), date.getMonth(), 1); // Primer día del mes
  }

  filterEvents() {
    this.cdr.detectChanges();
    const startDate = this.startDate ? new Date(this.startDate) : null;
    const endDate = this.endDate ? new Date(this.endDate) : null;
    const filtered = this.originalEvents.filter(event => {
      const eventDate = new Date(event.date);
      const isAfterStartDate = !startDate || eventDate >= startDate;
      const isBeforeEndDate = !endDate || eventDate <= endDate;
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
      const dateA = a.monthYear.getTime(); // Convertir a timestamp
      const dateB = b.monthYear.getTime(); // Convertir a timestamp
      return this.isOldestFirst ? dateA - dateB : dateB - dateA;
    });

    this.groupedEvents.forEach(group => {
      group.events.sort((a, b) => {
        const dateA = new Date(a.date).getTime(); // Convertir a timestamp
        const dateB = new Date(b.date).getTime(); // Convertir a timestamp
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

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    if (!this.showNewCustom && this.listCustomShare.length > 0 && document.getElementById('panelCustomShare') != null) {
      this.widthPanelCustomShare = document.getElementById('panelCustomShare').offsetWidth;
    }
    this.screenWidth = window.innerWidth;
    if(this.screenWidth > 991 && this.currentView == 'documents'){
      this.setView('chat');
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.notesSidebarOpen = false;
  }

  isSmallScreen(): boolean {
    return this.screenWidth < 991; // Bootstrap's breakpoint for small screen
  }

  isXSScreen(): boolean {
    return this.screenWidth < 650; // Bootstrap's breakpoint for small screen
  }


  toggleNotesSidebar() {
    this.notesSidebarOpen = !this.notesSidebarOpen;
    if (this.isSmallScreen && this.sidebarOpen) {
      this.sidebarOpen = false;
    }
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
    let ngbModalOptions: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      windowClass: 'ModalClass-xs'// xl, lg, sm
    };
    this.modalReference = this.modalService.open(addNoteModal, ngbModalOptions);
  }

  saveNote() {
    if (this.newNoteContent.trim()) {
      this.addNoteWithMessage(this.newNoteContent);
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
        this.modalService.dismissAll();
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

  editNote(index: number) {
    this.notes[index].isEditing = true;

    // Dar tiempo al DOM para actualizarse
    setTimeout(() => {
      const editableElement = document.getElementById('editableNote' + index);
      if (editableElement) {
        this.editableDiv = new ElementRef(editableElement);
        editableElement.focus();
      }
    });
  }

  saveNoteEdit(index: number) {
    if (!this.editableDiv) return;

    this.savingNote = true;
    const note = this.notes[index];

    const updatedNote = {
      _id: note._id,
      content: this.editableDiv.nativeElement.innerHTML,
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
              this.notes[index] = {
                ...updatedNote,
                isEditing: false
              };
              this.editableDiv = null;
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

  cancelNoteEdit(index: number) {
    this.notes[index].isEditing = false;
    this.editableDiv = null;
  }

  truncateTitle(title: string, limit: number = 24): string {
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

  fetchDxGptResults() {
    console.log('=== FRONTEND DXGPT DEBUG START ===');
    console.log('1. Current patient ID:', this.currentPatientId);
    
    if (!this.currentPatientId) {
      // Mostrar algún error o deshabilitar el botón si no hay paciente
      // Esto es improbable si la UI se muestra correctamente, pero por si acaso.
      console.error("No patient selected to fetch DxGPT results.");
      // Podrías usar Swal para notificar al usuario.
      this.dxGptResults = { success: false, analysis: this.translate.instant('patients.No patient selected') };
      return;
    }

    console.log('2. Setting loading state...');
    this.isDxGptLoading = true;
    this.dxGptResults = null; // Limpiar resultados anteriores

    console.log('3. Calling API service...');
    // Get current language from localStorage
    const currentLang = localStorage.getItem('lang') || 'en';
    // Suponiendo que quieres usar el resumen (useSummary: true)
    // Cambia a false o quita el segundo argumento si no quieres usar el resumen.
    this.apiDx29ServerService.getDifferentialDiagnosis(this.currentPatientId, currentLang, false, null).subscribe({
      next: (res: any) => {
        console.log('4. API Response received:', res);
        console.log('4.1. res.success:', res.success);
        console.log('4.2. res.analysis exists:', !!res.analysis);
        
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

  openTimelineModal(timelineModal) {
    console.log(this.timeline);
    this.modalService.open(timelineModal, {
      size: 'lg',
      scrollable: true,
      backdrop: 'static'
    });
  }

  getEventTypeIcon(type: string): string {
    const icons = {
      'diagnosis': '🩺',
      'treatment': '💉',
      'test': '🔬',
      'appointment': '📅',
      'symptom': '🤒',
      'medication': '💊',
      'other': '🔍'
    };
    return icons[type] ? icons[type] + ' ' : '';
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
        // Check if there's a custom description in sessionStorage first
        const customDescription = sessionStorage.getItem('customMedicalDescription');
        if (customDescription) {
          medicalDescription = customDescription;
        } else if (this.dxGptResults.analysis.anonymization && this.dxGptResults.analysis.anonymization.anonymizedText) {
          // Try to get medical description from the original patient summary
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
          this.questionResponses.set(cacheKey, '<p>No se pudo obtener la información solicitada.</p>');
        }
      }
      
      
    } catch (error) {
      console.error('Error fetching disease info:', error);
      this.questionResponses.set(cacheKey, '<p>Error al cargar la información. Por favor, intente nuevamente.</p>');
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
      Swal.fire('Selecciona al menos un síntoma', '', 'info');
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

    // Store the combined description temporarily
    sessionStorage.setItem('customMedicalDescription', combinedDescription);

    // Call the DxGPT API with the updated description
    this.apiDx29ServerService.getDifferentialDiagnosis(
      this.actualPatient.sub,
      this.translate.currentLang,
      true, // useSummary
      null // no diseases to exclude
    ).subscribe({
      next: (res) => {
        console.log('DxGPT rerun response:', res);
        if (res && res.success) {
          this.dxGptResults = res;
          // Show success message
          Swal.fire({
            icon: 'success',
            title: 'Análisis actualizado',
            text: 'Se ha realizado un nuevo análisis con los síntomas seleccionados.',
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          console.error('DxGPT rerun failed:', res);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo realizar el nuevo análisis. Por favor, intente nuevamente.'
          });
        }
        this.isDxGptLoading = false;
      },
      error: (err) => {
        console.error('Error in DxGPT rerun:', err);
        this.isDxGptLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al realizar el nuevo análisis. Por favor, intente nuevamente.'
        });
      }
    });
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
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
      true, // useSummary
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

    // Store the edited description for API call
    sessionStorage.setItem('customMedicalDescription', this.editedPatientInfo);
    
    // Close edit mode
    this.isEditingPatientInfo = false;

    // Clear all cached responses and expanded cards
    this.questionResponses.clear();
    this.questionSymptoms.clear();
    this.expandedQuestions.clear();
    this.expandedDiagnosisCards.clear();

    // Set loading state
    this.isDxGptLoading = true;

    // Re-run the differential diagnosis with the edited description
    this.apiDx29ServerService.getDifferentialDiagnosis(
      this.actualPatient.sub,
      this.translate.currentLang,
      true, // useSummary
      null // no diseases to exclude
    ).subscribe({
      next: (res) => {
        console.log('DxGPT response after edit:', res);
        if (res && res.success) {
          this.dxGptResults = res;
          
          // Show success message
          Swal.fire({
            icon: 'success',
            title: 'Análisis actualizado',
            text: 'Se ha realizado un nuevo análisis con la descripción editada.',
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
            title: 'Error',
            text: 'No se pudo realizar el nuevo análisis. La descripción se ha guardado pero los diagnósticos no se actualizaron.'
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
          title: 'Error',
          text: 'Error al realizar el nuevo análisis. La descripción se ha guardado pero los diagnósticos no se actualizaron.'
        });
      }
    });
  }

}
