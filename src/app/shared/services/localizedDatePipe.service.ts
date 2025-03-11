import { DatePipe } from '@angular/common';
import { Injectable, Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'localizedDate',
    pure: false
})

@Injectable()
export class LocalizedDatePipe implements PipeTransform {
    constructor() {
    }
    transform(value: any, pattern: string, lang: string): any {
        var localeLang = 'en-US'
        if(lang=='es'){
            localeLang = 'es-ES'
        }else if (lang == 'de') {
            localeLang = 'de-DE'
        }else if (lang == 'fr') {
            localeLang = 'fr-FR'
        }else if (lang == 'it') {
            localeLang = 'it-IT'
        }else if (lang == 'pt') {
            localeLang = 'pt-PT'
        }
        const datePipe: DatePipe = new DatePipe(localeLang);
        return datePipe.transform(value, pattern);
      }
}
//mediumDate