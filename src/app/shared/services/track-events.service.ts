import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
declare let gtag: any;

@Injectable()
export class TrackEventsService {
  _startTime: any;
  myuuid: string = uuidv4();

  constructor() {
    if(localStorage.getItem('uuid')==null){
      this.myuuid = uuidv4();
      localStorage.setItem('uuid', this.myuuid);
    }
    this._startTime = Date.now();
  }

  lauchEvent(category) {
    var secs = this.getElapsedSeconds();
    gtag('event', category, { 'myuuid': localStorage.getItem('uuid'), 'event_label': secs });
  }

  getElapsedSeconds() {
    var endDate = Date.now();
    var seconds = (endDate - this._startTime) / 1000;
    return seconds;
  };

}
