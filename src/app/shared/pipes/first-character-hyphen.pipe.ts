import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'firstCharacterHyphen'
})
export class FirstCharacterHyphenPipe implements PipeTransform {
  transform(value: string): string {
    // IF value.charAt(0) === '-' DELETE - 
    // ELSE return value.charAt(0) === '-' ? '' : 'hyphen';
    if(value.charAt(0) === '-'){
      value = value.slice(1);
    }
    return value;
    
  }
}
