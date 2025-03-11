import { Injectable } from '@angular/core';
import { Subject, Subscription } from 'rxjs';

@Injectable()
export class EventsService {
  private listeners: {[key: string]: Function[]} = {};
  private subscriptions: {[key: string]: Subscription[]} = {};
  public eventsSubject: Subject<{name: string, msg: any}> = new Subject();

  on(name: string, listener: Function) {
    if (!this.listeners[name]) {
        this.listeners[name] = [];
        this.subscriptions[name] = [];
    }

    this.listeners[name].push(listener);

    const subscription = this.eventsSubject
      .asObservable()
      .subscribe(event => {
        if (event.name === name) {
          listener(event.msg);
        }
      });

    this.subscriptions[name].push(subscription);
  }

  broadcast(name: string, msg: any) {
    this.eventsSubject.next({
        name,
        msg
    });
  }

  removeListener(name: string, listener: Function) {
    const listenerIndex = this.listeners[name]?.indexOf(listener);
    if (listenerIndex > -1) {
      this.listeners[name].splice(listenerIndex, 1);
      this.subscriptions[name][listenerIndex].unsubscribe();
      this.subscriptions[name].splice(listenerIndex, 1);
    }
  }

  destroy() {
    for (const subscriptionArr of Object.values(this.subscriptions)) {
      for (const subscription of subscriptionArr) {
        subscription.unsubscribe();
      }
    }
    
    this.listeners = {};
    this.subscriptions = {};
  }
}
