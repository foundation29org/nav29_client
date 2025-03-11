import { Directive, ElementRef, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[autoFocus]'
})
export class AutoFocusDirective implements AfterViewInit {
  constructor(private elementRef: ElementRef) {}

  ngAfterViewInit() {
    this.elementRef.nativeElement.focus();
    if (this.elementRef.nativeElement.select) {
      this.elementRef.nativeElement.select();
    }
  }
}