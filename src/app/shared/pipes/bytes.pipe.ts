import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'bytes' 
})
export class BytesPipe implements PipeTransform {

  transform(bytes: number): string {
    
    const units = ['bytes', 'KB', 'MB', 'GB'];

    let i = 0;
    while(bytes >= 1024) {
      bytes /= 1024;
      i++;
    }

    return `${bytes.toFixed(2)} ${units[i]}`;

  }

}