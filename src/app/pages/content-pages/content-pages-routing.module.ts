import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ErrorPageComponent } from "./error/error-page.component";
import { LoginPageComponent } from "./login/login-page.component";
import { RegisterPageComponent } from "./register/register-page.component";
import { LoginCompPageComponent } from "./logincomp/logincomp-page.component";

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'error',
        component: ErrorPageComponent,
        data: {
          title: 'Error Page'
        }
      },
      {
        path: 'login',
        component: LoginPageComponent,
        data: {
          title: 'menu.Sign in'
        }
      },
      {
        path: 'register',
        component: RegisterPageComponent,
        data: {
          title: 'login.Sign Up'
        }
      },
      {
        path: 'logincomp',
        component: LoginCompPageComponent,
        data: {
          title: 'menu.Sign in'
        }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ContentPagesRoutingModule { }
