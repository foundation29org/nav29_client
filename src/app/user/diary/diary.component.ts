import { Component, ChangeDetectionStrategy, ViewChild, TemplateRef, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { startOfDay,endOfHour, isSameDay, isSameMonth } from 'date-fns';
import { environment } from 'environments/environment';
import { HttpClient } from "@angular/common/http";
import { AuthService } from 'app/shared/auth/auth.service';
import { AuthGuard } from 'app/shared/auth/auth-guard.service';
import { ToastrService } from 'ngx-toastr';
import { SortService } from 'app/shared/services/sort.service';
import { PatientService } from 'app/shared/services/patient.service';
import Swal from 'sweetalert2';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { SearchService } from 'app/shared/services/search.service';
import { Subscription } from 'rxjs';
import { NgbModal} from '@ng-bootstrap/ng-bootstrap';
import { DOCUMENT } from '@angular/common';
import { Inject } from '@angular/core';

interface EventGroup {
  date: Date;
  events: any[];
}

@Component({
  selector: 'app-diary',
  templateUrl: './diary.component.html',
  styleUrls: ['./diary.component.scss'],
  providers: [PatientService]
})

export class DiaryComponent implements OnInit, OnDestroy{
  
  @ViewChild('modalContent') modalContent: TemplateRef<any>;
  newEvent: any;
  modalData: {
    action: string;
    event: any;
  };
  events: any[] = [];
  loading: boolean = false;
  saving: boolean = false;
  selectedPatient: any = {};
  loadedPatientId: boolean = false;
  private subscription: Subscription = new Subscription();
  userId: string;
  searchTerm: string = '';
  filteredEvents: any[] = [];
  @Inject(DOCUMENT) private document: Document;
  newMessage: string = '';
  showSearch: boolean = false;
  groupedEvents: EventGroup[] = [];

  constructor(private http: HttpClient, private authService: AuthService, private authGuard: AuthGuard, private modal: NgbModal, public translate: TranslateService, public toastr: ToastrService, private patientService: PatientService, private route: ActivatedRoute, private sortService: SortService, private searchService: SearchService) { 
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  ngOnInit() {
    this.userId = this.authService.getIdUser();
    if (this.authService.getCurrentPatient() == null) {
      this.loadPatientId();
    } else {
      this.loadedPatientId = true;
      this.selectedPatient = this.authService.getCurrentPatient();
      this.loadData();
    }
    
  }


  loadPatientId() {
    this.loadedPatientId = false;
    this.subscription.add(this.patientService.getPatientId()
      .subscribe((res: any) => {
        if (res == null) {
          this.authService.logout();
        } else {
          this.loadedPatientId = true;
          this.authService.setCurrentPatient(res);
          this.selectedPatient = res;
          this.loadData();
        }
      }, (err) => {
        console.log(err);
      }));
  }

  loadData(){
    this.events = [];
    this.loading = true;
    this.subscription.add( this.http.get(environment.api+'/api/appointments/'+this.authService.getCurrentPatient().sub)
        .subscribe( (res : any) => {
          if(res.message){
            this.events = [];
          }else{
            if(res.length>0){
              for(var i = 0; i < res.length; i++) {
                res[i].date = new Date(res[i].date);
              }
              this.events = res;
              if(this.events.length>0){
                this.events.sort((a, b) => a.date.getTime() - b.date.getTime());
              }
            }else{
              this.events = [];
            }
          }
          this.filteredEvents = this.events;
          this.groupEvents();
          this.loading = false;
          this.filterEvents();
          setTimeout(() => {
            this.scrollToBottom();
          }, 100);
         }, (err) => {
          this.filteredEvents = this.events;
           console.log(err);
           this.loading = false;
         }));
  }

  handleEvent(action: string, event: any): void {
    this.modalData = { event, action };
    this.modal.open(this.modalContent, { size: 'md' });
  }

  sendMessage(): void {
    if (!this.newMessage?.trim()) return;

    const newEvent = {
      _id: null,
      date: new Date(),
      notes: this.newMessage.trim()
    };

    this.saveData(newEvent);
    this.newMessage = ''; // Limpiar el input después de enviar
  }

  onEnter(event: KeyboardEvent): void {
    event.preventDefault();
    if (!event.shiftKey) { // Enviar solo si no se presiona Shift+Enter
      this.sendMessage();
    }
  }

  saveData(param){
    if(this.authGuard.testtoken()){
      this.saving = true;
      if(param._id==null){
        delete param._id;
        
        this.subscription.add( this.http.post(environment.api+'/api/appointments/'+this.authService.getCurrentPatient().sub+'/'+this.userId, param)
        .subscribe( (res : any) => {
          this.saving = false;
          if(res.message=='Eventdb created'){
            this.modal.dismissAll();
            this.loadData();
            setTimeout(() => {
              this.scrollToBottom();
            }, 100);
          }
          
         }, (err) => {
           console.log(err);

           this.saving = false;
           if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
             this.authGuard.testtoken();
           }else{
             this.toastr.error('', this.translate.instant("generics.Data saved fail"));
           }
         }));
      }else{
        this.subscription.add( this.http.put(environment.api+'/api/appointments/'+this.authService.getCurrentPatient().sub+'/'+param._id, param)
        .subscribe( (res : any) => {
          this.saving = false;
          if(res.message=='Appointment updated'){
            this.modal.dismissAll();
            this.loadData();
            /*const index = this.events.findIndex(e => e._id === param._id);
            if (index !== -1) {
              this.events[index] = param;
            }*/
          }

         }, (err) => {
           console.log(err.error);
           this.saving = false;
           if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
             this.authGuard.testtoken();
           }else{
            this.toastr.error('', this.translate.instant("generics.Data saved fail"));
           }
         }));
      }
    }
  }

  editEvent(event: any) {
    this.modalData = {
      action: 'Edit event',
      event: { ...event }
    };
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  confirmDeleteEvent(event){
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
        this.eliminar(event);
      }
    }); 
  }

  eliminar(event){
    this.subscription.add( this.http.delete(environment.api+'/api/appointments/'+this.authService.getCurrentPatient().sub+'/'+event._id)
    .subscribe( (res : any) => {
      if(res.message=='Deleted'){
        this.loadData()
        /*const index = this.events.findIndex(e => e._id === event._id);
        if (index !== -1) {
          this.events.splice(index, 1);
        }*/
      }else{
        this.toastr.error('', this.translate.instant("generics.error try again"));
      }
      //this.toastr.success('', this.msgDataSavedOk, { showCloseButton: true });
      //this.loadData()

     }, (err) => {

       console.log(err);
       if(err.error.message=='Token expired' || err.error.message=='Invalid Token'){
         this.authGuard.testtoken();
       }else{
         this.toastr.error('', this.translate.instant("generics.error try again"));
       }
     }));
  }


  clearData(data){
    var emptydata = {
      _id: data._id,
      notes:"",
      date: startOfDay(new Date())
    }

    this.modalData.event=emptydata;
    this.modal.dismissAll();
  }


  closeModal() {
    if (this.modal != undefined) {
      this.modal.dismissAll();
      //this.loadData();
    }
  }
  
  filterEvents() {
    if (!this.searchTerm?.trim()) {
      this.filteredEvents = this.events;
    } else {
      const searchTermLower = this.searchTerm.toLowerCase().trim();
      this.filteredEvents = this.events.filter(event => {
        // Buscar en fecha
        const date = new Date(event.date);
        const formattedDate = date.toLocaleDateString('es', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).toLowerCase();
        
        // Buscar en nombre de usuario
        const userName = event.addedBy?.userName?.toLowerCase() || '';
        
        // Buscar en email
        const email = event.addedBy?.email?.toLowerCase() || '';
        
        // Buscar en notas
        const notes = event.notes?.toLowerCase() || '';

        return formattedDate.includes(searchTermLower) ||
               userName.includes(searchTermLower) ||
               email.includes(searchTermLower) ||
               notes.includes(searchTermLower);
      });
    }
    this.groupEvents();
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  scrollToBottom(): void {
    try {
      const container = document.querySelector('.chat-timeline-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch(err) {
      console.log('Error al hacer scroll:', err);
    }
  }

  groupEvents() {
    const groups: { [key: string]: EventGroup } = this.filteredEvents.reduce((groups, event) => {
      const date = new Date(event.date);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString();
      
      if (!groups[dateStr]) {
        groups[dateStr] = {
          date: date,
          events: []
        };
      }
      groups[dateStr].events.push(event);
      return groups;
    }, {} as { [key: string]: EventGroup });

    // Ordenar grupos por fecha ascendente (más antiguos primero)
    this.groupedEvents = Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Ordenar eventos dentro de cada grupo por fecha
    this.groupedEvents.forEach(group => {
      group.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
  }

  getDateLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.getTime() === today.getTime()) {
      return 'Hoy';
    } else if (date.getTime() === yesterday.getTime()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  toggleSearch() {
    this.showSearch = !this.showSearch;
    if (!this.showSearch) {
      this.clearSearch();
    }
  }

  clearSearch() {
    this.searchTerm = '';
    this.filterEvents();
  }
}