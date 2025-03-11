import { Component, OnInit, OnDestroy, ViewChild, TemplateRef, ElementRef, HostListener } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { NgbModal, NgbModalRef, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { EventsService } from 'app/shared/services/events.service';
import { AnimationOptions } from 'ngx-lottie';
import { AnimationItem } from 'lottie-web';

@Component({
  selector: 'app-land',
  templateUrl: './land-page.component.html',
  styleUrls: ['./land-page.component.scss']
})

export class LandPageComponent implements OnInit, OnDestroy {

  private subscription: Subscription = new Subscription();
  screenWidth: number;
  lang: string = 'en';
  modalReference: NgbModalRef;
  @ViewChild('containerboton') containerBoton: ElementRef;
  @ViewChild('btnaction') btnaction: ElementRef;
  part1AnimationData: any;
  part2AnimationData: any;
  part1Options: AnimationOptions = {
    loop: true
  };
  part2Options: AnimationOptions = {
    loop: false
  };
  showPart1: boolean = true;
  bottomPosition: string = '0px';
  @ViewChild('panelLogin', { static: false }) panelLogin: TemplateRef<any>;

  constructor(private http: HttpClient, public translate: TranslateService, private modalService: NgbModal, private eventsService: EventsService) {
    this.screenWidth = window.innerWidth;
    if (sessionStorage.getItem('lang') == null) {
      sessionStorage.setItem('lang', this.translate.store.currentLang);
    }
    this.lang = this.translate.store.currentLang;
    this.loadAnimationData();
  }

  loadAnimationData(): void {
    this.http.get('assets/img/home/animation/part1.json').subscribe(data => {
      this.part1AnimationData = data;
      this.part1Options = { ...this.part1Options, animationData: data };
    });

    this.http.get('assets/img/home/animation/part2.json').subscribe(data => {
      this.part2AnimationData = data;
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.calculateBottomPosition();
  }

  async calculateBottomPosition() {
    await this.delay(500);
    // Asegúrate de que ya se haya establecido la referencia a containerBoton
    if (this.containerBoton && this.containerBoton.nativeElement) {
      const containerRect = this.containerBoton.nativeElement.getBoundingClientRect();
      // Ahora usamos las dimensiones del contenedor para los cálculos
      const containerHeight = containerRect.height;

      const svgElement = document.querySelector('svg > g[clip-path*="__lottie_element_"]');
      if (svgElement) {
        const svgRect = svgElement.getBoundingClientRect();
        // Ya no dependemos de viewportHeight sino de containerHeight
        let additionalSpace = 13 * 10; // Valor por defecto para pantallas grandes
        additionalSpace = containerHeight / additionalSpace;
        if (containerRect.width > 1000) {
          additionalSpace = additionalSpace + 10;
        }
        const bottom = containerHeight - (svgRect.bottom - containerRect.top) + additionalSpace; // Ajustado para usar la altura del contenedor
        this.bottomPosition = `${bottom}px`;
      }
    }
  }

  async ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.modalService) {
      this.modalService.dismissAll();
    }
  }

  async ngOnInit() {
    this.eventsService.on('changelang', function (lang) {
      (async () => {
        this.lang = lang;
      })();
    }.bind(this));
    this.checkContainer();
  }

  async checkContainer() {
    await this.delay(200);
    if (!this.containerBoton) {
      if (!this.containerBoton.nativeElement) {
        this.checkContainer();
      } else {
        this.calculateBottomPosition();
      }
    } else {
      this.calculateBottomPosition();
    }
  }

  async animationCreated(animationItem: AnimationItem) {
    if (!this.showPart1) {
      animationItem.addEventListener('complete', () => {
        this.part1Options = { ...this.part1Options, animationData: this.part1AnimationData };
      });
      await this.delay(8000);
      this.showPart1 = true;
      //show the button
      this.btnaction.nativeElement.style.display = 'block';
      this.part1Options = { ...this.part1Options, animationData: this.part1AnimationData };
      this.openLogin(this.panelLogin);
    }
  }

  toggleAnimation(): void {
    this.part1Options = { ...this.part1Options, animationData: this.part2AnimationData };
    this.showPart1 = false;
    //hide the button despues de 2 segundos
    setTimeout(() => {
      this.btnaction.nativeElement.style.display = 'none';
    }, 2000);
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async closeModal() {
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
  }

  openLogin(panelLogin) {
    let ngbModalOptions: NgbModalOptions = {
      backdrop: true,
      keyboard: true,
      windowClass: 'ModalClass-sm' // xl, lg, sm, xs
    };
    if (this.modalReference != undefined) {
      this.modalReference.close();
      this.modalReference = undefined;
    }
    this.modalReference = this.modalService.open(panelLogin, ngbModalOptions);
  }
}
