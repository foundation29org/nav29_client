import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { FullPagesRoutingModule } from "./full-pages-routing.module";
import { TranslateModule } from '@ngx-translate/core';
import { ChartistModule } from "ng-chartist";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { NgSelectModule } from "@ng-select/ng-select";
import { PipeModule } from "app/shared/pipes/pipe.module";
import { CustomFormsModule } from 'ngx-custom-validators';
import {MatRadioModule} from '@angular/material/radio';
import {MatSelectModule} from '@angular/material/select';

import { UserProfilePageComponent } from "./user-profile/user-profile-page.component";
import { SupportComponent } from './support/support.component';

@NgModule({
  exports: [
    TranslateModule
],
  imports: [
    CommonModule,
    FullPagesRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    ChartistModule,
    NgSelectModule,
    NgbModule,
    TranslateModule,
    PipeModule,
    CustomFormsModule,
    MatRadioModule,
    MatSelectModule
  ],
  declarations: [
    UserProfilePageComponent,
    SupportComponent,
  ]
})
export class FullPagesModule {}
