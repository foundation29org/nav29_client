import { NgModule } from '@angular/core';
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CustomFormsModule } from 'ngx-custom-validators';
import { LandPageRoutingModule } from "./land-page-routing.module";
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from "ng-apexcharts";
import {MatDatepickerModule} from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {MatInputModule} from '@angular/material/input';

import { LandPageComponent } from "./land/land-page.component";

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatSelectModule} from '@angular/material/select';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatRadioModule} from '@angular/material/radio';
import { SharedModule } from "app/shared/shared.module";
import { PipeModule } from "app/shared/pipes/pipe.module";
import { LottieModule } from 'ngx-lottie';
import {ContentPagesModule} from '../content-pages/content-pages.module';
export function playerFactory() {
    return import(/* webpackChunkName: 'lottie-web' */ 'lottie-web');
  }

@NgModule({
    exports: [
        TranslateModule,
        MatDatepickerModule,
        MatNativeDateModule 
    ],
    imports: [
        CommonModule,
        LandPageRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule,
        CustomFormsModule,
        NgbModule,
        MatCheckboxModule,
        MatExpansionModule,
        MatSelectModule,
        MatRadioModule,
        NgApexchartsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        SharedModule,
        PipeModule,
        LottieModule.forRoot({ player: playerFactory }),
        ContentPagesModule
    ],
    declarations: [
        LandPageComponent
    ]
})
export class LandPageModule { }
