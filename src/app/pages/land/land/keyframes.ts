import { style } from '@angular/animations';

export const swing = [
  style({ transform: 'rotate3d(0, 0, 1, 15deg)', offset: 0.2 }),
  style({ transform: 'rotate3d(0, 0, 1, -10deg)', offset: 0.4 }),
  style({ transform: 'rotate3d(0, 0, 1, 5deg)', offset: 0.6 }),
  style({ transform: 'rotate3d(0, 0, 1, -5deg)', offset: 0.8 }),
  style({ transform: 'rotate3d(0, 0, 1, 0deg)', offset: 1 })
];

export const slideOutLeft = [
  style({ opacity: 1 }),
  style({ transform: 'translate3d(-200%, 0, 0) rotate3d(0, 0, 1, -120deg)', opacity: 0 }),
];

export const slideOutRight = [
  style({ opacity: 1 }),
  style({ transform: 'translate3d(200%, 0, 0) rotate3d(0, 0, 1, 120deg)', opacity: 0 }),
];

export const fadeIn = [
  style({ opacity: 0, offset: 0 }),
  style({ opacity: 0.5, offset: 0.5 }),
  style({ opacity: 1, offset: 1 }),
];