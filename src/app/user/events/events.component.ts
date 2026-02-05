import { Component, ViewChild, TemplateRef, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { animate, keyframes, style, transition, trigger, state } from '@angular/animations';
import * as kf from '../home/keyframes';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { environment } from 'environments/environment';
import { HttpClient } from "@angular/common/http";
import { AuthService } from 'app/shared/auth/auth.service';
import { AuthGuard } from 'app/shared/auth/auth-guard.service';
import { ToastrService } from 'ngx-toastr';
import { DateService } from 'app/shared/services/date.service';
import { SortService } from 'app/shared/services/sort.service';
import { PatientService } from 'app/shared/services/patient.service';
import { DeviceDetectorService } from 'ngx-device-detector';
import Swal from 'sweetalert2';
import { Subject, Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatTableDataSource} from '@angular/material/table';

import {SelectionModel} from '@angular/cdk/collections';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss'],
  animations: [
    trigger('fadeSlideInOut', [
      transition(':enter', [
        animate('500ms', style({ opacity: 1, transform: 'rotateY(180deg)' })),
      ]),
      transition(':leave', [
        animate('500ms', style({ opacity: 0, transform: 'rotateY(180deg)'})),
      ]),
    ]),
    trigger('cardAnimation', [
      //transition('* => wobble', animate(1000, keyframes (kf.wobble))),
      transition('* => swing', animate(1000, keyframes(kf.swing))),
      //transition('* => jello', animate(1000, keyframes (kf.jello))),
      //transition('* => zoomOutRight', animate(1000, keyframes (kf.zoomOutRight))),
      transition('* => slideOutLeft', animate(1000, keyframes(kf.slideOutRight))),
      transition('* => slideOutRight', animate(1000, keyframes(kf.slideOutLeft))),
      //transition('* => rotateOutUpRight', animate(1000, keyframes (kf.rotateOutUpRight))),
      transition('* => fadeIn', animate(1000, keyframes(kf.fadeIn))),
    ]),
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})


export class EventsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('modalContent') modalContent: TemplateRef<any>;
  @ViewChild('modalGraphContent') modalGraphContent: TemplateRef<any>;

  view: string = 'month';


  viewDate: Date = new Date();


  refresh: Subject<any> = new Subject();

  activeDayIsOpen: boolean = true;
  loadedEvents: boolean = false;
  saving: boolean = false;
  importing: boolean = false;

  private msgDataSavedOk: string;
  msgDataSavedFail: string;
  step: string = '1';
  private subscription: Subscription = new Subscription();
  imported: number = 0;
  modalReference: NgbModalRef;
  seizuresForm: FormGroup;
  submitted = false;
  showTimeField = false;
  events: any = [];
  eventsCopy: any = [];
  documents: any = []; // Para almacenar los documentos y poder buscar por docId

  displayedColumns: string[] = ['select', 'name', 'origin', 'date', 'actions'];
  columnsToDisplayWithExpand  = [...this.displayedColumns, 'expand'];
  expandedElement: null;
  dataSource: MatTableDataSource<any>;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  editing: boolean = false;
  actualRow: any = null;
  loadedPatientId: boolean = false;
  deleting: boolean = false;
  selection = new SelectionModel<any>(true, []);
  
  // Sorting
  sortField: string = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';

  constructor(private http: HttpClient, private authService: AuthService, private authGuard: AuthGuard, private modalService: NgbModal, public translate: TranslateService, public toastr: ToastrService, private dateService: DateService, private formBuilder: FormBuilder, private sortService: SortService, private patientService: PatientService, private deviceService: DeviceDetectorService, public insightsService: InsightsService) {}

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  ngOnInit() {

    this.seizuresForm = this.formBuilder.group({
      name: ['', Validators.required],
      origin: [''],
      date: [new Date()],
      dateEnd: [null],
      time: [''],
      key: [''],
      notes: [],
      _id: []
  });
  
    this.loadTranslations();

    this.subscription.add(this.authService.currentPatient$.subscribe(patient => {
      console.log('entra')
      console.log(patient)
      if (patient) {
        this.loadedPatientId = true;
        this.loadEvents();
      }
    }));
    
  }

  ngAfterViewInit() {
    
  }

  get f() { return this.seizuresForm.controls; }

  loadTranslations(){
    this.translate.get('generics.Data saved successfully').subscribe((res: string) => {
      this.msgDataSavedOk=res;
    });
    this.translate.get('generics.Data saved fail').subscribe((res: string) => {
      this.msgDataSavedFail=res;
    });
  }

  loadEvents(){
    this.loadedEvents=false;
    this.events =[];
    this.eventsCopy = [];
    
    // Cargar documentos primero para poder obtener títulos por docId
    this.subscription.add(this.patientService.getDocuments()
      .subscribe((docsRes: any) => {
        if(docsRes && Array.isArray(docsRes)){
          this.documents = docsRes;
        }
        
        // Luego cargar eventos
        this.loadEventsData();
      }, (err) => {
        console.log('Error loading documents:', err);
        this.insightsService.trackException(err);
        // Continuar cargando eventos aunque falle la carga de documentos
        this.loadEventsData();
      }));
  }
  
  private loadEventsData(){
    this.subscription.add( this.http.get(environment.api+'/api/events/'+this.authService.getCurrentPatient().sub)
    .subscribe( (res : any) => {
      if(res.message){
        //no tiene información
        this.dataSource = new MatTableDataSource([]);
      }else{
        if(res.length>0){
          // Procesar eventos y precalcular datos para mejorar rendimiento
          res.forEach((event: any) => {
            // Añadir títulos de documentos si tienen docId
            if(event.docId){
              event.documentTitle = this.getDocumentTitle(event.docId);
            }
            // Precalcular icono del evento (evitar calcular en cada render)
            if(event.origin === 'wizard'){
              // Icono para eventos del formulario inicial del paciente
              event._eventIcon = '📋 ';
            } else if(event.key){
              event._eventIcon = this.getEventTypeIcon(event.key);
            } else {
              event._eventIcon = '';
            }
            // Precalcular texto del origin traducido (evitar múltiples evaluaciones en template)
            if(event.origin === 'wizard'){
              event._originText = this.translate.instant('events.originWizard');
            } else if(event.origin === 'automatic'){
              event._originText = this.translate.instant('events.originAutomatic');
            } else {
              event._originText = event.origin || '';
            }
            // Precalcular fecha formateada para el filtro (evitar calcular en cada evaluación)
            if(event.date){
              event._formattedDate = this.dateService.transformFormatDate(event.date, 'dd MMM YYYY').toLowerCase();
            } else {
              event._formattedDate = '';
            }
            // Precalcular valores en minúsculas para búsqueda rápida
            event._searchName = (event.name || '').toLowerCase();
            event._searchOrigin = (event.origin || '').toLowerCase();
            event._searchDocumentTitle = (event.documentTitle || '').toLowerCase();
          });
            
          this.events = res;
          // Usar spread operator en lugar de JSON.parse/stringify para mejor rendimiento
          this.eventsCopy = res.map(e => ({...e}));
        }
        this.dataSource = new MatTableDataSource(this.events);
        this.setFilter();
        // Aplicar ordenamiento inicial
        this.applySort();
      }
      this.editing=false;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.loadedEvents=true;
     }, (err) => {
       console.log(err);
       this.insightsService.trackException(err);
       this.loadedEvents=true;
     }));
  }
  
  // Método para obtener el título del documento desde docId
  getDocumentTitle(docId: string): string {
    if(!docId || !this.documents || this.documents.length === 0){
      return '';
    }
    const doc = this.documents.find((d: any) => d._id === docId);
    if(!doc){
      return '';
    }
    // Si el documento tiene título, usarlo
    if(doc.title){
      return doc.title;
    }
    // Si no tiene título, extraerlo del nombre del archivo en la URL
    if(doc.url){
      const fileName = doc.url.split("/").pop();
      return fileName || '';
    }
    return '';
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

  /*setFilter(){
    this.dataSource.filterPredicate = (data, filter) => {
      const filterDate1 = this.dateService.transformFormatDate(data.date, 'dd MMM YYYY');
      if(filterDate1.toLowerCase().includes(filter) ){
        return true;
      }else {
        // Si el filtro no es una fecha, compara como texto
        return data.name.toLowerCase().includes(filter);
      }
    };
  }*/

  setFilter(){
    // Usar valores precalculados para evitar cálculos costosos en cada evaluación del filtro
    this.dataSource.filterPredicate = (data, filter) => {
        const transformedFilter = filter.trim().toLowerCase();
        
        // Usar valores precalculados en lugar de calcular en cada evaluación
        const matchesDate = data._formattedDate ? data._formattedDate.includes(transformedFilter) : false;
        const matchesName = data._searchName ? data._searchName.includes(transformedFilter) : false;
        const matchesOrigin = data._searchOrigin ? data._searchOrigin.includes(transformedFilter) : false;
        const matchesDocument = data._searchDocumentTitle ? data._searchDocumentTitle.includes(transformedFilter) : false;
        
        return matchesDate || matchesName || matchesOrigin || matchesDocument;
    };
}

  get date() {
    //return this.seizuresForm.get('date').value;
    let minDate = new Date(this.seizuresForm.get('date').value);
    return minDate;
  }
  
  saveData(){
    this.submitted = true;
    
    if (this.seizuresForm.invalid) {
        return;
    }
    
    // Combine date and time if time is set
    if (this.seizuresForm.value.date != null) {
      let dateObj = new Date(this.seizuresForm.value.date);
      const hasTime = this.seizuresForm.value.time && this.seizuresForm.value.time !== '';
      if (hasTime) {
        const [hours, minutes] = this.seizuresForm.value.time.split(':').map(Number);
        dateObj.setHours(hours, minutes, 0, 0);
        this.seizuresForm.value.date = this.dateService.transformDateTime(dateObj);
      } else {
        this.seizuresForm.value.date = this.dateService.transformDate(dateObj);
      }
    }
    if (this.seizuresForm.value.dateEnd != null) {
      this.seizuresForm.value.dateEnd = this.dateService.transformDate(this.seizuresForm.value.dateEnd);
    }
    // Remove time field before sending to API
    delete this.seizuresForm.value.time;

    if(this.authGuard.testtoken()){
      this.saving = true;
      const userId = this.authService.getIdUser();
      this.subscription.add( this.http.post(environment.api+'/api/events/'+this.authService.getCurrentPatient().sub+'/'+userId, this.seizuresForm.value)
        .subscribe( (res : any) => {
          this.saving = false;
          this.toastr.success('', this.msgDataSavedOk);
          /*this.events.push(this.seizuresForm.value);
          this.eventsCopy.push(this.seizuresForm.value);*/
          this.submitted = false;
          this.seizuresForm.reset();
          this.step = '1';
          this.loadEvents();
         }, (err) => {
           console.log(err);
           this.insightsService.trackException(err);
           this.saving = false;
           if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
             this.authGuard.testtoken();
           }else{
           }
         }));
    }
  }

  updateData(){
    this.submitted = true;
    if (this.seizuresForm.invalid) {
        return;
    }
    
    // Combine date and time if time is set
    if (this.seizuresForm.value.date != null) {
      let dateObj = new Date(this.seizuresForm.value.date);
      const hasTime = this.seizuresForm.value.time && this.seizuresForm.value.time !== '';
      if (hasTime) {
        const [hours, minutes] = this.seizuresForm.value.time.split(':').map(Number);
        dateObj.setHours(hours, minutes, 0, 0);
        this.seizuresForm.value.date = this.dateService.transformDateTime(dateObj);
      } else {
        this.seizuresForm.value.date = this.dateService.transformDate(dateObj);
      }
    }
    if (this.seizuresForm.value.dateEnd != null) {
      this.seizuresForm.value.dateEnd = this.dateService.transformDate(this.seizuresForm.value.dateEnd);
    }
    // Remove time field before sending to API
    delete this.seizuresForm.value.time;
    
    if(this.authGuard.testtoken()){
      this.saving = true;
      this.subscription.add( this.http.put(environment.api+'/api/events/'+this.authService.getCurrentPatient().sub+'/'+this.actualRow._id+'/'+this.authService.getIdUser(), this.seizuresForm.value)
        .subscribe( (res : any) => {
          this.saving = false;
          this.toastr.success('', this.msgDataSavedOk);
          this.submitted = false;
          this.seizuresForm.reset();
          this.step = '1';
          this.loadEvents();
         }, (err) => {
           console.log(err);
           this.insightsService.trackException(err);
           this.saving = false;
           if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
             this.authGuard.testtoken();
           }else{
           }
         }));
    }
  }

  deleteSeizure(event) {
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
        this.subscription.add( this.http.delete(environment.api+'/api/events/'+this.authService.getCurrentPatient().sub+'/'+event._id)
          .subscribe( (res : any) => {
            if(this.step == '0'){
              this.seizuresForm.reset();
              this.step = '1';
            }
            this.loadEvents();
            //this.toastr.success('', this.msgDataSavedOk, { showCloseButton: true });
          }, (err) => {
            console.log(err);
            this.insightsService.trackException(err);
            if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
              this.authGuard.testtoken();
            }else{
              //this.toastr.error('', this.msgDataSavedFail, { showCloseButton: true });
            }
          }));
            }
    });

  }

  openStats(){
    this.seizuresForm.reset();
    this.step = '1';
    this.loadEvents();
  }

  goto(index){
    this.step = index;
    if(this.step == '0'){
      const today = new Date();
      this.seizuresForm.get('date').setValue(today);
      this.seizuresForm.get('dateEnd').setValue(null);
      this.seizuresForm.get('time').setValue('');
      this.showTimeField = false;
    }
  }

  getLiteral(literal) {
    return this.translate.instant(literal);
  }

  filterNewProms(){
  }

  showAll(){
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applySort() {
    if (!this.events || this.events.length === 0) return;
    
    // Ordenar los eventos actuales (que pueden estar filtrados por fecha)
    const sortedEvents = [...this.events];
    
    sortedEvents.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch(this.sortField) {
        case 'date':
          // Usar dateEnd si existe, sino usar date
          aValue = (a.dateEnd ? new Date(a.dateEnd).getTime() : (a.date ? new Date(a.date).getTime() : 0));
          bValue = (b.dateEnd ? new Date(b.dateEnd).getTime() : (b.date ? new Date(b.date).getTime() : 0));
          break;
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'origin':
          aValue = (a._originText || a.origin || '').toLowerCase();
          bValue = (b._originText || b.origin || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    this.events = sortedEvents;
    // Solo actualizar eventsCopy si no hay filtro de fechas activo
    if (this.range.value.start == null && this.range.value.end == null) {
      this.eventsCopy = sortedEvents.map(e => ({...e}));
    }
    this.dataSource.data = this.events;
  }

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.applySort();
  }

  onSortFieldChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.sortField = target.value;
    this.applySort();
  }

  showDates(contentDates){
    let ngbModalOptions: NgbModalOptions = {
      keyboard: false,
      windowClass: 'ModalClass-xs'// xl, lg, sm
    };
    this.modalReference = this.modalService.open(contentDates, ngbModalOptions);
  }

  closeModal() {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
  }

  applyRangeDates(){
    this.closeModal();
    //range.value.start - range.value.end
    var test = this.dateService.transformDate(this.range.value.start );
    var test2 = this.dateService.transformDate(this.range.value.end );
    // Filtrar eventos: incluir si la fecha inicio o fin está dentro del rango, o si el evento abarca el rango
    this.events = this.eventsCopy.filter(x => {
      const eventStart = x.date ? new Date(x.date) : null;
      const eventEnd = x.dateEnd ? new Date(x.dateEnd) : eventStart;
      const rangeStart = new Date(test);
      const rangeEnd = new Date(test2);
      
      // Evento dentro del rango: fecha inicio del evento <= fin del rango Y (fecha fin del evento >= inicio del rango O no tiene fecha fin)
      return eventStart && (
        (eventStart <= rangeEnd && (!eventEnd || eventEnd >= rangeStart)) ||
        (eventEnd && eventEnd >= rangeStart && eventEnd <= rangeEnd)
      );
    });
    this.dataSource = new MatTableDataSource(this.events);
    this.setFilter();
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    // Aplicar ordenamiento después del filtro
    this.applySort();
  }

  clear(){
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    this.range.value.start = null;
    this.range.value.end = null;
    this.events = this.eventsCopy;
    this.dataSource = new MatTableDataSource(this.events);
    this.setFilter();
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    // Aplicar ordenamiento después de limpiar
    this.applySort();
  }

  showForm(row){
    if(row.date != null){
      const dateObj = new Date(row.date);
      row.date = dateObj;
      // Extract time from the date
      const hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      if (hours !== 0 || minutes !== 0) {
        row.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }else{
      row.date = new Date();
    }
    if(row.dateEnd != null){
      row.dateEnd = new Date(row.dateEnd);
    }
    // Show time field for appointments/reminders or if time is already set
    this.showTimeField = row.key === 'appointment' || row.key === 'reminder' || !!row.time;
    this.actualRow = row;
    this.step = '0';
    this.editing = true;
    this.seizuresForm.patchValue(row);
  }

  deleteSelected() {
    var titleSwal = this.translate.instant("events.Are you sure delete n events", {
      value: this.selection.selected.length
    })
    Swal.fire({
      title: titleSwal,
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
        this.deleting = true;
        var eventsIds = [];
        for(let i=0; i<this.selection.selected.length; i++){
          eventsIds.push(this.selection.selected[i]._id);
        }
        var eventsIdsDef = {eventsIds: eventsIds};
        this.subscription.add( this.http.post(environment.api+'/api/deleteevents/'+this.authService.getCurrentPatient().sub, eventsIdsDef)
          .subscribe( (res : any) => {
            this.deleting = false;
            this.dataSource.data = this.dataSource.data.filter(row => !this.selection.isSelected(row));
            this.selection.clear();
            this.loadEvents();
            //this.toastr.success('', this.msgDataSavedOk, { showCloseButton: true });
          }, (err) => {
            this.deleting = false;
            console.log(err);
            this.insightsService.trackException(err);
            if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
              this.authGuard.testtoken();
            }else{
              //this.toastr.error('', this.msgDataSavedFail, { showCloseButton: true });
            }
          }));
            }
    });

  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  masterToggle() {
      this.isAllSelected() ?
          this.selection.clear() :
          this.dataSource.data.forEach(row => this.selection.select(row));
  }

}
