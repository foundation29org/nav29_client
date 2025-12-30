import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import Swal from 'sweetalert2';

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router,
    public toastr: ToastrService,
    public translate: TranslateService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    this.authService.getEnvironment();

    let url: string = state.url;
    const expectedRole = route.data.expectedRole;

    return new Promise<boolean>((resolve) => {
      let attempts = 0;
      const maxAttempts = 10; // Máximo ~5s de espera

      const checkAuth = () => {
        attempts++;

        if (this.authService.isAuthenticated()) {
          // Sesión válida en memoria -> permitir acceso
          return resolve(true);
        } else {
          // Si se está verificando la sesión y no hemos excedido el máximo de intentos, esperar más
          if (this.authService.isCheckingSessionStatus() && attempts < maxAttempts) {
            setTimeout(() => {
              checkAuth();
            }, 500);
            return;
          }
          
          // Si aún no se ha verificado la sesión, esperar un poco más
          if (!this.authService.isSessionChecked() && attempts < maxAttempts) {
            setTimeout(() => {
              checkAuth();
            }, 500);
            return;
          }

          // No hay sesión válida después de verificar -> redirigir a login
          // Solo hacer logout si realmente no hay sesión (no mientras se verifica)
          if (expectedRole === undefined) {
            // Guardar URL actual antes de logout para redirección después de login
            this.authService.setRedirectUrl(url);
            this.authService.logout();
            this.router.navigate([this.authService.getLoginUrl()]);
            return resolve(false);
          } else {
            if (
              expectedRole !== undefined &&
              this.authService.getRole() !== '' &&
              expectedRole.indexOf(this.authService.getRole()) === -1
            ) {
              this.authService.setRedirectUrl('/.');
            } else {
              this.authService.setRedirectUrl(url);
            }
            this.authService.logout();
            this.router.navigate([this.authService.getLoginUrl()]);
            return resolve(false);
          }
        }
      };

      checkAuth();
    });
  }

  testtoken(){
    // Con cookies HttpOnly, delegamos la expiración al servidor.
    // Este método se mantiene por compatibilidad pero solo comprueba isAuthenticated.
    if (this.authService.isAuthenticated()) {
      return true;
    }
    this.authService.logout();
    this.router.navigate([this.authService.getLoginUrl()]);
    return false;
  }

  inactive(){
    Swal.fire({
      icon: 'warning',
      title: '',
      html: this.translate.instant("generics.sessionClosed")
    })
    //this.toastr.error('', this.translate.instant("generics.sessionClosed"));
    this.authService.logout();
    this.router.navigate([this.authService.getLoginUrl()]);
    //location.reload();
  }

  reload(){
    Swal.fire({
        title: this.translate.instant("InfoSystem.titleReload"),
        html: this.translate.instant("InfoSystem.bodyReload"),
        icon: 'warning',
        showCancelButton: false,
        confirmButtonColor: '#33658a',
        cancelButtonColor: '#B0B6BB',
        confirmButtonText: 'Ok',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
    }).then((result) => {
      if (result.value) {
        //location.reload();
      }
    });

    /*Swal.fire({
      icon: 'warning',
      title: this.translate.instant("InfoSystem.titleReload"),
      html: this.translate.instant("InfoSystem.bodyReload")
    })
    //this.toastr.error('', this.translate.instant("generics.sessionClosed"));
    //this.authService.logout();
    //this.router.navigate([this.authService.getLoginUrl()]);
    location.reload();*/
  }

}
