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
    const maxHeight = parseInt(getComputedStyle(textarea).maxHeight) || 200;
    const minHeight = parseInt(getComputedStyle(textarea).minHeight) || 24;
    
    // Reset height to auto para calcular el scrollHeight correcto
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    
    // Calcular la altura deseada (scrollHeight + padding si es necesario)
    let desiredHeight = scrollHeight;
    
    // Aplicar límites
    if (desiredHeight < minHeight) {
      desiredHeight = minHeight;
    } else if (desiredHeight > maxHeight) {
      desiredHeight = maxHeight;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
    
    textarea.style.height = `${desiredHeight}px`;
    
    // Mantener el scroll al final cuando se está escribiendo
    if (textarea.scrollHeight > textarea.clientHeight) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }
}