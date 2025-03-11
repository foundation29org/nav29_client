import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class RoleGuard implements CanActivate {

  constructor(public authService: AuthService, public router: Router,  public toastr: ToastrService, public translate: TranslateService) {}

  canActivate(route: ActivatedRouteSnapshot):boolean {
    const expectedRole = route.data.expectedRole;
    const expectedSubRole = route.data.expectedSubRole;
    if (!this.authService.isAuthenticated() || expectedRole.indexOf(this.authService.getRole()) == -1) {
      this.toastr.error('', this.translate.instant("generics.notpermission"));
      this.authService.setRedirectUrl('/home');
      this.router.navigate([this.authService.getLoginUrl()]);
      //  this.router.navigate(["/."]);
        this.authService.logout();
        return false;
    }
    if(expectedSubRole!=undefined){
      if (!this.authService.isAuthenticated() || expectedSubRole.indexOf(this.authService.getSubRole()) == -1) {
        this.toastr.error('', this.translate.instant("generics.notpermission"));

        //De momento solo tenemos subrole en usuarios y admin
        if((this.authService.getSubRole() != 'HaveDiagnosis')&&(this.authService.getSubRole() != 'AdminGTP')){
          this.authService.setRedirectUrl('/home');
        }else{
          if(this.authService.getSubRole() != 'AdminGTP'){
            this.authService.setRedirectUrl('/home');
          }
          else{
            this.authService.setRedirectUrl('/admin/dashboard/admingtp')
          }
        }
        this.router.navigate([this.authService.getRedirectUrl()]);
        return false;
      }
    }



    return true;
  }
}
