import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Router } from "@angular/router";

@Component({
    selector: 'app-privacy-policy',
    templateUrl: './privacy-policy.component.html',
    styleUrls: ['./privacy-policy.component.scss']
})

export class PrivacyPolicyPageComponent {
  constructor(public translate: TranslateService, private router: Router) {
  }

  goTo(url){
    document.getElementById(url).scrollIntoView(true);
  }

  back(){
    //window.history.back();
    this.router.navigate(['/home']);
  }
}
