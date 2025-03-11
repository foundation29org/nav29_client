import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-language-select-modal',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{ title }}</h4>
    </div>
    <div class="modal-body">
      <div [innerHTML]="text"></div>
      <select [(ngModel)]="selectedLang" class="form-control">
        <option *ngFor="let lang of languageOptions" [value]="lang.code">{{ lang.name }}</option>
      </select>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-primary" (click)="save()">{{'generics.Save' | translate}}</button>
    </div>
  `
})
export class LanguageSelectModalComponent {
  @Input() title: string;
  @Input() text: string;
  @Input() languageOptions: { code: string, name: string }[];
  @Input() selectedLang: string;

  constructor(public activeModal: NgbActiveModal) {}

  save() {
    this.activeModal.close(this.selectedLang);
  }
}