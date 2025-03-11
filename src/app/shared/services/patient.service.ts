import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from '../../../environments/environment';
import { AuthService } from '../../../app/shared/auth/auth.service';
import { InsightsService } from 'app/shared/services/azureInsights.service';
import { catchError, map, tap } from 'rxjs/operators'

@Injectable({
  providedIn: 'root'
})
export class PatientService {
    constructor(private authService: AuthService, private http: HttpClient, public insightsService: InsightsService) {}

    acceptConsent(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/acceptConsent/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getRoleMedicalLevel(){
      return this.http.get(environment.api+'/api/users/rolemedicallevel/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    setRoleProfile(role){
      return this.http.put(environment.api+'/api/users/role/'+this.authService.getIdUser(), {role:role}).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }


    setMedicalLevel(medicalLevel){
      return this.http.put(environment.api+'/api/users/medicallevel/'+this.authService.getIdUser(), {medicalLevel:medicalLevel}).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    getContext(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/getcontext/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    createPatient(){
      return this.http.get(environment.api+'/api/createpatient/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getInitialEvents(currentPatient, lang){
      //cargar las faqs del knowledgeBaseID
      return this.http.post(environment.api+'/api/getinitialevents/'+currentPatient, {lang:lang}).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getPatientId(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/patients-all/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          if(res.listpatients.length>0){
            this.authService.setPatientList(res.listpatients);
            if(this.authService.getCurrentPatient()== null){
              this.authService.setCurrentPatient(res.listpatients[0]);
            }
            return this.authService.getCurrentPatient();
          }else{
            return null;
          }
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getPatientWeight(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/weight/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getPatientHeight(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/height/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getGeneralShare(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/share/patient/generalshare/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getCustomShare(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/share/patient/customshare/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }


    updateCustomShare(info){
      //cargar las faqs del knowledgeBaseID
      return this.http.post(environment.api+'/api/share/patient/updatecustomshare/'+this.authService.getCurrentPatient().sub, info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    deleteCustomShare(info){
      //cargar las faqs del knowledgeBaseID
      return this.http.post(environment.api+'/api/share/patient/deletecustomshare/'+this.authService.getCurrentPatient().sub, info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    changestatuscustomshare(info){
      //cargar las faqs del knowledgeBaseID
      return this.http.post(environment.api+'/api/share/patient/changestatuscustomshare/'+this.authService.getCurrentPatient().sub, info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getIndividualShare(){
      //cargar las faqs del knowledgeBaseID
      return this.http.get(environment.api+'/api/share/patient/individualshare/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    setIndividualShare(info){
      //cargar las faqs del knowledgeBaseID
      return this.http.post(environment.api+'/api/share/patient/individualshare/'+this.authService.getCurrentPatient().sub, info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getDocuments(){
      return this.http.get(environment.api+'/api/documents/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    deleteDocument(docId: string) {
      return this.http.delete(environment.api + '/api/document/'+this.authService.getCurrentPatient().sub + '/' + docId)
        .pipe(
          map((res: any) => {
            return res;
          }),
          catchError((err) => {
            console.log(err);
            this.insightsService.trackException(err);
            throw err;
          })
        );
      }
       

    saveContainer(location){
      var info = {location:location}
      return this.http.post(environment.api+'/api/eo/backup/'+this.authService.getCurrentPatient().sub, info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    createbackup(){
      return this.http.get(environment.api+'/api/eo/createbackup/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    saveFileId(fileId){
      var info = {fileId:fileId}
      return this.http.post(environment.api+'/api/eo/backupfile/'+this.authService.getIdUser(), info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    checkGoogleDrive(){
      return this.http.get(environment.api+'/api/eo/checkgoogledrive/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }


    checkIPFS(){
      return this.http.get(environment.api+'/api/eo/checkipfs/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getIPFS(){
      return this.http.get(environment.api+'/api/eo/backupipfs/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    checkF29(){
      return this.http.get(environment.api+'/api/eo/checkf29/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getF29(){
      return this.http.get(environment.api+'/api/eo/backupf29/'+this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    extractFhir(){
      return this.http.get(environment.api+'/api/eo/patient/'+this.authService.getCurrentPatient().sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    getModules() {
      return this.http.get(environment.api+'/api/users/modules/'+ this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    saveRecommendations(drugsToSave){
      return this.http.post(environment.api+'/api/massiveseizuresdose/'+this.authService.getCurrentPatient().sub, drugsToSave).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          this.insightsService.trackException(err);
          return err;
        })
      );
    }

    setAccessToPatient(patientId, token, location, idToken){
      var info = {token: token, location: location, idToken: idToken}
      return this.http.post(environment.api+'/api/setaccesstopatient/'+ patientId, info).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    getEventsFromDoc(patientId, docId){
      //cargar las faqs del knowledgeBaseID
      return this.http.post(environment.api+'/api/eventsfromdoc/'+patientId, docId).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    updateEventFromDoc(eventId, status){
      return this.http.post(environment.api+'/api/updateeventfromdoc/'+this.authService.getCurrentPatient().sub+'/'+eventId, {status:status}).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    deletePatient(sub){
      return this.http.delete(environment.api+'/api/patient/'+sub).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    getSharedPatients(userId){
      return this.http.get(environment.api+'/api/sharedpatients/'+userId).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    getPatientNotes(patientId){
      return this.http.get(environment.api+'/api/notes/'+patientId).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    savePatientNote(patientId, note){
      return this.http.post(environment.api+'/api/notes/'+patientId+'/'+this.authService.getIdUser(), note).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    deletePatientNote(patientId, noteId){
      return this.http.delete(environment.api+'/api/notes/'+patientId+'/'+noteId).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    getPreferredLang(){
      return this.http.get(environment.api+'/api/getPreferredLang/'+ this.authService.getIdUser()).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    updatePreferredLang(lang){
      return this.http.put(environment.api+'/api/updatePreferredLang/'+ this.authService.getIdUser(), {preferredResponseLanguage: lang}).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

    saveSettings(lang, preferredResponseLanguage, role, medicalLevel){
      return this.http.put(environment.api+'/api/users/settings/'+ this.authService.getIdUser(), {lang: lang, preferredResponseLanguage: preferredResponseLanguage, role: role, medicalLevel: medicalLevel}).pipe(
        map((res: any) => {
          return res;
        }),
        catchError((err) => {
          console.log(err);
          return err;
        })
      );
    }

}
