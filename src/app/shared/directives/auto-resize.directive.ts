import { Directive, HostListener, ElementRef, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[autoResize]'
})
export class AutoResizeDirective implements AfterViewInit {

  constructor(private el: ElementRef) {}

  @HostListener('input')
  onInput(): void {
    this.adjustHeight();
  }

  ngAfterViewInit() {
    // Esperar un tick para asegurar que el DOM esté completamente cargado
    /*setTimeout(() => {
      this.adjustHeight();
    });*/
    setTimeout(() => this.adjustHeight(), 150);
  }

  private adjustHeight(): void {
    const textarea = this.el.nativeElement;
    textarea.style.overflow = 'hidden';
    textarea.style.height = 'auto';
    //textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.style.height = `${textarea.scrollHeight + 20}px`;
  }
}