import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'tokens' 
})
export class TokensPipe implements PipeTransform {

  transform(bytes: number): string {
    
    const units = ['tokens', 'K tokens', 'M tokens', 'G tokens'];

    let i = 0;
    while(bytes >= 1000) {
      bytes /= 1000;
      i++;
    }

    return `${bytes.toFixed(2)} ${units[i]}`;

  }

}