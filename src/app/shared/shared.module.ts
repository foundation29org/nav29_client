import { NgModule } from '@angular/core';
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { PerfectScrollbarModule } from "ngx-perfect-scrollbar";
import { ClickOutsideModule } from 'ng-click-outside';

import { AutocompleteModule } from './components/autocomplete/autocomplete.module';
import { VeriffComponent } from './components/veriff/veriff.component';
import { InactivityWarningComponent } from './components/inactivity-warning/inactivity-warning.component';
import { PipeModule } from 'app/shared/pipes/pipe.module';
import {FirstCharacterDotPipe} from 'app/shared/pipes/first-character-dot.pipe';
import {FirstCharacterHyphenPipe} from 'app/shared/pipes/first-character-hyphen.pipe';

import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatInputModule} from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { QRCodeModule } from 'angularx-qrcode';

//COMPONENTS
import { FooterComponent } from "./footer/footer.component";
import { FooterLandComponent } from "./footer-land/footer-land.component";
import { NavbarComponent } from "./navbar/navbar.component";
import { NavbarD29Component } from "./navbar-dx29/navbar-dx29.component";
import { NavbarPagesComponent } from "./navbar-pages/navbar-pages.component";
import { HorizontalMenuComponent } from './horizontal-menu/horizontal-menu.component';
import { VerticalMenuComponent } from "./vertical-menu/vertical-menu.component";
import { NotificationSidebarComponent } from './notification-sidebar/notification-sidebar.component';
import { SafePipe } from 'app/shared/services/safe.pipe';
import { ShareModalComponent } from './share-modal/share-modal.component';
import { LanguageSelectModalComponent } from 'app/user/language-select/language-select.component';

//DIRECTIVES
import { ToggleFullscreenDirective } from "./directives/toggle-fullscreen.directive";
import { SidebarLinkDirective } from './directives/sidebar-link.directive';
import { SidebarDropdownDirective } from './directives/sidebar-dropdown.directive';
import { SidebarAnchorToggleDirective } from './directives/sidebar-anchor-toggle.directive';
import { SidebarDirective } from './directives/sidebar.directive';
import { TopMenuDirective } from './directives/topmenu.directive';
import { TopMenuLinkDirective } from './directives/topmenu-link.directive';
import { TopMenuDropdownDirective } from './directives/topmenu-dropdown.directive';
import { TopMenuAnchorToggleDirective } from './directives/topmenu-anchor-toggle.directive';
import { AutoResizeDirective } from './directives/auto-resize.directive';
import { AutoFocusDirective } from './directives/auto-focus.directive';




@NgModule({
    exports: [
        CommonModule,
        FooterComponent,
        FooterLandComponent,
        NavbarComponent,
        NavbarD29Component,
        NavbarPagesComponent,
        VerticalMenuComponent,
        HorizontalMenuComponent,
        NotificationSidebarComponent,
        ToggleFullscreenDirective,
        SidebarDirective,
        TopMenuDirective,
        NgbModule,
        TranslateModule,
        PipeModule,
        SafePipe,
        FirstCharacterDotPipe,
        FirstCharacterHyphenPipe,
        AutoResizeDirective,
        VeriffComponent,
        InactivityWarningComponent,
        ShareModalComponent,
        LanguageSelectModalComponent,
        AutoFocusDirective
    ],
    imports: [
        RouterModule,
        CommonModule,
        NgbModule,
        TranslateModule,
        FormsModule,
        OverlayModule,
        ReactiveFormsModule ,
        PerfectScrollbarModule,
        ClickOutsideModule,
        AutocompleteModule,
        PipeModule,
        MatDatepickerModule,
        MatInputModule,
        MatNativeDateModule,
        QRCodeModule
    ],
    declarations: [
        FooterComponent,
        FooterLandComponent,
        NavbarComponent,
        NavbarD29Component,
        NavbarPagesComponent,
        VerticalMenuComponent,
        HorizontalMenuComponent,
        NotificationSidebarComponent,
        ToggleFullscreenDirective,
        SidebarLinkDirective,
        SidebarDropdownDirective,
        SidebarAnchorToggleDirective,
        SidebarDirective,
        TopMenuLinkDirective,
        TopMenuDropdownDirective,
        TopMenuAnchorToggleDirective,
        TopMenuDirective,
        SafePipe,
        FirstCharacterDotPipe,
        FirstCharacterHyphenPipe,
        AutoResizeDirective,
        VeriffComponent,
        InactivityWarningComponent,
        ShareModalComponent,
        LanguageSelectModalComponent,
        AutoFocusDirective
    ]
})
export class SharedModule { }

