import { Component, Input, Output, EventEmitter } from '@angular/core';
import { environment } from 'environments/environment';
import { TemplateRef } from '@angular/core';
import { PatientService } from 'app/shared/services/patient.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { DateService } from 'app/shared/services/date.service';
import { AuthService } from '../../../app/shared/auth/auth.service';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Clipboard } from "@angular/cdk/clipboard"
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-share-modal',
  templateUrl: './share-modal.component.html',
  styleUrls: ['./share-modal.component.scss']
})
export class ShareModalComponent {
  @Input() shareTemplate: TemplateRef<any>;
  @Input() mode: string;
  @Output() closeModal = new EventEmitter<void>();
  loadedShareData: boolean = false;
  listCustomShare: any[] = [];
  newPermission: any = {};
  subscription = new Subscription();
  visibilityStates: boolean[] = [];
  sending: boolean = false;
  inProcess: boolean = false;
  qrImage: string = '';
  showLinkMA: boolean = false;
  display: string = '';
  pin: string = '';
  showNewCustom: boolean = false;
  urlOpenNav29: string = environment.api+'/login';
  individualShare = [];
  generateUrlQr = '';
  modalQr: NgbModalRef;
  locationsList: any[] = [];
currentShareIndex: number = 0;
  modalReference: NgbModalRef;
  isOwner: boolean = false;

  constructor(private patientService: PatientService, private insightsService: InsightsService, private dateService: DateService, private authService: AuthService, private modalService: NgbModal, public translate: TranslateService, private clipboard: Clipboard) { }

  ngOnInit() {
    this.resetPermisions();
    this.loadCustomShare();
  }

  loadCustomShare() {
    this.loadedShareData = false;
    this.subscription.add(this.patientService.getCustomShare()
      .subscribe((res: any) => {
        this.listCustomShare = res.customShare;
        this.isOwner = res.owner;
        this.loadedShareData = true;
      }, (err) => {
        console.log(err);
        this.insightsService.trackException(err);
        this.loadedShareData = true;
      }));
  }

  closeModalShare() {
    this.closeModal.emit();
  }

  addCustom(){
    this.showNewCustom = true;
    this.resetPermisions();
  }
  
  cancelCustom(){
    this.showNewCustom = false;
  }

  resetPermisions(){
    var dateNow = new Date();
    var stringDateNow = this.dateService.transformDate(dateNow);
    this.newPermission={
      data:{},
      notes:'',
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
      password += chars.substring(randomNumber, randomNumber +1);
     }
     var url = '/?key='+this.authService.getCurrentPatient().sub+'&token='+password
    return url;
  }

  toggleVisibility(index: number): void {
    this.visibilityStates[index] = !this.visibilityStates[index];
  }

  sendShare(){
    if(this.mode=='Individual'){
      this.setIndividualShare(false);
    }else{
      this.setCustomShare();
    }
  }

  setIndividualShare(updateStatus){
    if(this.newPermission._id != null){
      var found = false;
      var indexUpdated = -1;
      for (var i = 0; i <= this.individualShare.length && !found; i++) {
        if(this.individualShare[i]._id==this.newPermission._id){
          this.individualShare[i] = this.newPermission;
          found = true;
          indexUpdated = i;
        }
      }
      if(found){
        var info = {individualShare: this.individualShare, updateStatus: updateStatus, indexUpdated: indexUpdated} 
        this.subscription.add( this.patientService.setIndividualShare(info)
        .subscribe( (res : any) => {
          if(res.message == 'qrgenerated'){
            this.generateUrlQr= 'https://openraito.azurewebsites.net'+this.newPermission.token;
          }
          this.getIndividualShare();
          this.resetPermisions();
          this.showNewCustom=false;
          this.loadedShareData = true;
        }, (err) => {
          console.log(err);
          this.insightsService.trackException(err);
          this.loadedShareData = true;
        }));
      }
    }
  }

  getIndividualShare(){
    this.subscription.add( this.patientService.getIndividualShare()
    .subscribe( (res : any) => {
      this.individualShare = res.individualShare;
     }, (err) => {
       console.log(err);
       this.insightsService.trackException(err);
     }));
  }

  setCustomShare(){
    this.loadedShareData = false;
    let info = this.newPermission;
    if(this.newPermission._id == null){
      this.listCustomShare.push(this.newPermission)
    }else{
      var found = false;
      for (var i = 0; i <= this.listCustomShare.length && !found; i++) {
        if(this.listCustomShare[i]._id==this.newPermission._id){
          this.listCustomShare[i] = this.newPermission;
          found = true;
        }
      }
    }

    
    console.log(info)
    this.subscription.add( this.patientService.updateCustomShare(info)
    .subscribe( (res : any) => {
      this.resetPermisions();
      this.showNewCustom=false;
      this.listCustomShare = res.customShare;
      this.loadedShareData = true;
     }, (err) => {
       console.log(err);
       this.insightsService.trackException(err);
       this.loadedShareData = true;
     }));
  }

  showQR(data, qrPanel){
    this.generateUrlQr = this.urlOpenNav29+data;
    let ngbModalOptions: NgbModalOptions = {
      backdrop : 'static',
      keyboard : false,
      windowClass: 'ModalClass-sm'// xl, lg, sm
    };
    this.modalQr = this.modalService.open(qrPanel, ngbModalOptions);
  }

  editcustom(i){
    this.newPermission= this.listCustomShare[i];
    this.mode = 'Custom';
    this.showNewCustom = true;
  }

  confirmRevoke(i){
    Swal.fire({
        title: this.translate.instant("generics.Are you sure?"),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2F8BE6',
        cancelButtonColor: '#B0B6BB',
        confirmButtonText: this.translate.instant("generics.Delete"),
        cancelButtonText: this.translate.instant("generics.No"),
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        reverseButtons:true
    }).then((result) => {
      if (result.value) {
        this.revokePermission(i);
      }
    });
  }
  
  revokePermission(i){
    this.loadedShareData = false;
    let info = {_id: this.listCustomShare[i]._id};
    this.listCustomShare.splice(i, 1);
    
    this.subscription.add( this.patientService.deleteCustomShare(info)
    .subscribe( (res : any) => {
      this.showNewCustom=false;
      //this.listCustomShare = res.customShare;
      this.loadedShareData = true;
     }, (err) => {
       console.log(err);
       this.insightsService.trackException(err);
       this.loadedShareData = true;
     }));
  }

  revokeLocation(i, j){
    //swal wait for the server response
    Swal.fire({
      title: this.translate.instant("generics.Please wait"),
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    })
    console.log(this.listCustomShare[i].locations[j])
    this.listCustomShare[i].locations[j].status = 'deny';
    let data = {_id : this.listCustomShare[i].locations[j]._id, status: 'deny'}
    this.subscription.add( this.patientService.changestatuscustomshare(data)
      .subscribe( (res : any) => {
        Swal.close();
       }, (err) => {
         console.log(err);
         this.listCustomShare[i].locations[j].status = 'accepted';
         Swal.close();
         this.insightsService.trackException(err);
       }));
  }
  
  acceptLocation(i, j){
    Swal.fire({
      title: this.translate.instant("generics.Please wait"),
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    })
    this.listCustomShare[i].locations[j].status = 'accepted';
    let data = {_id : this.listCustomShare[i].locations[j]._id, status: 'accepted'}
    this.subscription.add( this.patientService.changestatuscustomshare(data)
      .subscribe( (res : any) => {
        Swal.close();
       }, (err) => {
         console.log(err);
          this.listCustomShare[i].locations[j].status = 'deny';
          Swal.close();
         this.insightsService.trackException(err);
       }));
    
  }

  closeModalQr() {
    if (this.modalQr != undefined) {
      this.modalQr.close();
      this.modalQr = undefined;
    }
  }
  
  copyClipboard(token){
    this.generateUrlQr = this.urlOpenNav29+token;
    this.clipboard.copy(this.generateUrlQr);
    Swal.fire({
      icon: 'success',
      html: this.translate.instant("generics.Copied to the clipboard"),
      showCancelButton: false,
      showConfirmButton: false,
      allowOutsideClick: false
    })
    setTimeout(function () {
      Swal.close();
    }, 2000);
  }

  copyClipboard2(){
    this.clipboard.copy(this.generateUrlQr);
        Swal.fire({
          icon: 'success',
          html: this.translate.instant("generics.Copied to the clipboard"),
          showCancelButton: false,
          showConfirmButton: false,
          allowOutsideClick: false
        })
  
        setTimeout(function () {
          Swal.close();
        }, 2000);
  }

  showLocationsHistory(locations: any[], modal: any, shareIndex: number) {
    this.locationsList = locations;
    this.currentShareIndex = shareIndex;
    this.modalReference = this.modalService.open(modal, { size: 'lg', windowClass: 'modal-custom' });
  }
  
  closeLocationsModal() {
    this.modalReference.dismiss();
  }

}