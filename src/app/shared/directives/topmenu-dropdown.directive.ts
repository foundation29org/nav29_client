import { Directive, OnInit } from '@angular/core';
import { TopMenuLinkDirective } from './topmenu-link.directive';

@Directive({
  selector: '[appTopMenuDropdown]'
})
export class TopMenuDropdownDirective implements OnInit {
  protected navlinks: Array<TopMenuLinkDirective> = [];

    public ngOnInit(): any {
      //write your code here!
    }

    constructor() {
    }


}
