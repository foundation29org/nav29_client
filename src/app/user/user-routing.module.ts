import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AuthGuard } from 'app/shared/auth/auth-guard.service';
import { RoleGuard } from 'app/shared/auth/role-guard.service';

import { HomeComponent } from './home/home.component';
import { EventsComponent } from './events/events.component';

import { WelcomeComponent } from './welcome/welcome.component';
import { PatientsComponent } from './patients/patients.component';
import { DiaryComponent } from './diary/diary.component';
import { NewPatientComponent } from './new-patient/new-patient.component';

const routes: Routes = [
  {
    path: 'welcome',
    component: WelcomeComponent,
    data: {
      title: 'welcome.welcomeTitle',
      expectedRole: ['User', 'Clinical', 'Caregiver', 'Unknown']
    },
    canActivate: [AuthGuard, RoleGuard]
  },
  {
    path: 'new-patient',
    component: NewPatientComponent,
    data: {
      title: 'patients.Create new patient',
      expectedRole: ['User', 'Clinical', 'Caregiver', 'Unknown']
    },
    canActivate: [AuthGuard, RoleGuard]
  },
  {
    path: 'home',
    component: HomeComponent,
    data: {
      title: 'menu.Dashboard',
      expectedRole: ['User', 'Clinical', 'Caregiver', 'Unknown']
    },
    canActivate: [AuthGuard, RoleGuard]
  },
  {
    path: 'events',
    component: EventsComponent,
    data: {
      title: 'events.title',
      expectedRole: ['User', 'Clinical', 'Caregiver', 'Unknown']
    },
    canActivate: [AuthGuard, RoleGuard]
  },
  {
    path: 'patients',
    component: PatientsComponent,
    data: {
      title: 'patients.My patients',
      expectedRole: ['User', 'Clinical', 'Caregiver', 'Unknown']
    },
    canActivate: [AuthGuard, RoleGuard]
  },
  {
    path: 'diary',
    component: DiaryComponent,
    data: {
      title: 'diary.title',
      expectedRole: ['User', 'Clinical', 'Caregiver', 'Unknown']
    },
    canActivate: [AuthGuard, RoleGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserRoutingModule { }
