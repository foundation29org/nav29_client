import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-inactivity-warning',
  templateUrl: './inactivity-warning.component.html',
  styleUrls: ['./inactivity-warning.component.scss']
})
export class InactivityWarningComponent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
  @Input() visible: boolean = false;
  @Input() timeRemaining: number = 180; // 3 minutos en segundos
  @Output() keepAlive = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @ViewChild('keepAliveButton', { static: false }) keepAliveButton: ElementRef<HTMLButtonElement>;

  private destroy$ = new Subject<void>();
  private timerInterval: any = null;
  public displayTime: number = 180;
  private shouldFocusButton: boolean = false;

  constructor(public translate: TranslateService) {}

  ngOnInit(): void {
    if (this.visible) {
      this.startTimer();
      this.shouldFocusButton = true;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('>>> InactivityWarningComponent ngOnChanges:', changes);
    if (changes['visible'] && changes['visible'].currentValue) {
      console.log('>>> InactivityWarningComponent: visible changed to true');
      this.displayTime = this.timeRemaining;
      this.startTimer();
      this.shouldFocusButton = true;
    } else if (changes['visible'] && !changes['visible'].currentValue) {
      console.log('>>> InactivityWarningComponent: visible changed to false');
      this.stopTimer();
      this.shouldFocusButton = false;
    }
    
    if (changes['timeRemaining']) {
      this.displayTime = this.timeRemaining;
    }
  }

  ngAfterViewChecked(): void {
    // Enfocar el botón cuando el modal se muestra
    if (this.shouldFocusButton && this.keepAliveButton && this.visible) {
      setTimeout(() => {
        if (this.keepAliveButton && this.keepAliveButton.nativeElement) {
          this.keepAliveButton.nativeElement.focus();
          this.shouldFocusButton = false;
        }
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopTimer();
  }

  private startTimer(): void {
    this.stopTimer();
    this.displayTime = this.timeRemaining;
    
    this.timerInterval = setInterval(() => {
      this.displayTime--;
      if (this.displayTime <= 0) {
        this.stopTimer();
        this.onTimerExpired();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  onKeepAlive(): void {
    this.stopTimer();
    this.keepAlive.emit();
  }

  private onTimerExpired(): void {
    this.stopTimer();
    this.closed.emit();
  }

  get minutes(): number {
    return Math.floor(this.displayTime / 60);
  }

  get seconds(): number {
    return this.displayTime % 60;
  }

  get progress(): number {
    return (this.displayTime / this.timeRemaining) * 100;
  }
}

