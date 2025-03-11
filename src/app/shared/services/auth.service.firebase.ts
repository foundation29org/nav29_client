import { Injectable, NgZone} from '@angular/core';
import { environment } from 'environments/environment';
import * as auth from 'firebase/auth';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })

export class AuthServiceFirebase {
  constructor(
    public afAuth: AngularFireAuth, // Inject Firebase auth service
    public router: Router,
    public ngZone: NgZone, // NgZone service to remove outside scope warning
    public toastr: ToastrService,
    public translate: TranslateService
  ) {
    
  }

  // caseFileId: string, evidenceGroupId: string, listEvidences: any[] optionals
sendSignInLink(email: string, path: string, caseFileId?: string, evidenceGroupId?: string, listEvidences?: any[], invitationParams?: any) {
  const encodedEmail = encodeURIComponent(email);
  var url = environment.api;
  if(url == 'http://localhost:8443'){
    url = 'http://localhost:4200';
  }
  let actionCodeSettings = {
    // URL a la que se debe redirigir al hacer clic en el enlace.
    url: url+path+`?email=${encodedEmail}`,
    handleCodeInApp: true,
  };  
  if(caseFileId){
    const evidenceListString = JSON.stringify(listEvidences);
    actionCodeSettings.url = url+path+`?email=${encodedEmail}&caseFileId=${caseFileId}&evidenceGroupId=${evidenceGroupId}&listEvidences=${evidenceListString}`;
  }
  const hasInvitation = Object.keys(invitationParams).length > 0;
  if(hasInvitation){
    actionCodeSettings.url = actionCodeSettings.url+`&key=${invitationParams.key}&token=${invitationParams.token}`;
  }
  //this.afAuth.languageCode = Promise.resolve(this.translate.currentLang);
  firebase.auth().languageCode = this.translate.currentLang;
  return this.afAuth.sendSignInLinkToEmail(email, actionCodeSettings)
    .then(() => {
      return true;
    })
    .catch(error => {
      console.error("Error sending sign in link", error);
      return false;
    });
}

  // Sign in with Google
  async GoogleAuth() {
    return await this.AuthLogin(new auth.GoogleAuthProvider());
  }

  async signInWithMicrosoft() {
    return await this.AuthLogin(new auth.OAuthProvider('microsoft.com'));
  }

  async signInWithApple() {
    return await this.AuthLogin(new auth.OAuthProvider('apple.com'));
  }

  AuthLogin(provider: any) {
    return this.afAuth
      .signInWithPopup(provider)
      .then(async (result) => {
        const idToken = await result.user.getIdToken();
        return idToken;
      })
      .catch((error) => {
        window.alert(error);
        return null;
      });
  }

  // Sign out
  SignOut() {
    return this.afAuth.signOut().then(() => {
      //localStorage.removeItem('user');
      //this.router.navigate(['/.']);
    });
  }
}