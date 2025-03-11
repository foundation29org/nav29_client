import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'firstCharacterDot'
})
export class FirstCharacterDotPipe implements PipeTransform {
  transform(value: string): string {
    return value.charAt(0) === '-' ? '' : 'dot';
  }
}
