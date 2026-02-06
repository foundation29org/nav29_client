import { NgModule } from '@angular/core';
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UserRoutingModule } from "./user-routing.module";

import { CustomFormsModule } from 'ngx-custom-validators';
import { TranslateModule } from '@ngx-translate/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from "app/shared/shared.module";

import { MatchHeightModule } from 'app/shared/directives/match-height.directive';

import {MatSelectModule} from '@angular/material/select';
import { TagInputModule } from 'ngx-chips';
import { UiSwitchModule } from 'ngx-ui-switch';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatInputModule} from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';

import { HomeComponent } from './home/home.component';
import { EventsComponent } from './events/events.component';
import { WelcomeComponent } from './welcome/welcome.component';
import { NewPatientComponent } from './new-patient/new-patient.component';
import { PatientsComponent } from './patients/patients.component';
import { FeedbackSummaryPageComponent } from './feedback-summary/feedback-summary-page.component';
import { DiaryComponent } from './diary/diary.component';

import { NgxChartsModule } from '@swimlane/ngx-charts';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatRadioModule} from '@angular/material/radio';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatTableModule} from '@angular/material/table';
import {MatSortModule} from '@angular/material/sort';
import {MatPaginatorModule} from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { QRCodeModule } from 'angularx-qrcode';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { QuillModule } from 'ngx-quill';

@NgModule({
    exports: [
        TranslateModule
    ],
    imports: [
        CommonModule,
        UserRoutingModule,
        FormsModule,
        CustomFormsModule,
        NgbModule,
        MatchHeightModule,
        TranslateModule,
        MatSelectModule,
        TagInputModule,
        ReactiveFormsModule,
        UiSwitchModule,
        MatDatepickerModule,
        MatInputModule,
        MatNativeDateModule,
        NgxChartsModule,
        MatCheckboxModule,
        MatRadioModule,
        MatButtonToggleModule,
        MatCardModule,
        MatButtonModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatTabsModule,
        MatMenuModule,
        MatIconModule,
        MatExpansionModule,
        QRCodeModule,
        DragDropModule,
        QuillModule,
        SharedModule
    ],
    declarations: [
        HomeComponent,
        EventsComponent,
        WelcomeComponent,
        PatientsComponent,
        FeedbackSummaryPageComponent,
        DiaryComponent,
        NewPatientComponent,
    ]
})
export class UserModule { }

