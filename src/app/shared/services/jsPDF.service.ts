import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { jsPDF } from "jspdf";

@Injectable({
    providedIn: 'root'
  })
  
export class jsPDFService {
    constructor(public translate: TranslateService) {
    }
    lang: string = '';
    meses: any = {
        "enero": "January",
        "febrero": "February",
        "marzo": "March",
        "abril": "April",
        "mayo": "May",
        "junio": "June",
        "julio": "July",
        "agosto": "August",
        "septiembre": "September",
        "octubre": "October",
        "noviembre": "November",
        "diciembre": "December"
    };

    private newHeatherAndFooter(doc){
        // Footer
        var logoHealth = new Image();
        logoHealth.src = "assets/img/logo-foundation-twentynine-footer.png"
        doc.addImage(logoHealth, 'png', 20, 284, 25, 10);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 101, 138)
        doc.textWithLink("https://nav29.org", 148, 290, { url: 'https://nav29.org' });
        doc.setTextColor(0, 0, 0);
    }

    private getFormatDate(date) {
        var localeLang = 'en-US';
        if (this.lang == 'es') {
            localeLang = 'es-ES'
        }else if (this.lang == 'de') {
            localeLang = 'de-DE'
        }else if (this.lang == 'fr') {
            localeLang = 'fr-FR'
        }else if (this.lang == 'it') {
            localeLang = 'it-IT'
        }else if (this.lang == 'pt') {
            localeLang = 'pt-PT'
        }
        return date.toLocaleString(localeLang, { month: 'long' , day: 'numeric', year: 'numeric'});
    }

    private pad(number) {
        if (number < 10) {
            return '0' + number;
        }
        return number;
    }
    private checkIfNewPage(doc, lineText) {
        if (lineText < 270) {
            return lineText
        }
        else {
            doc.addPage()
            this.newHeatherAndFooter(doc)
            lineText = 20;
            return lineText;
        }
    }  
    

    private writeDataHeader(doc, pos, lineText, text) {
        doc.setTextColor(0, 0, 0)
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text(text, pos, lineText += 20);
    }

    private getDate() {
        var date = new Date()
        return date.getUTCFullYear() + this.pad(date.getUTCMonth() + 1) + this.pad(date.getUTCDate()) + this.pad(date.getUTCHours()) + this.pad(date.getUTCMinutes()) + this.pad(date.getUTCSeconds());
    };

    private writeAboutUs(doc,lineText){
        lineText = this.checkIfNewPage(doc, lineText);
        doc.setFont(undefined, 'bold');
        doc.text(this.translate.instant("generics.Foundation 29"), 10, lineText);
        this.writelinePreFooter(doc, this.translate.instant("about.footer1"), lineText += 5);
        lineText = this.checkIfNewPage(doc, lineText);
        this.writelinePreFooter(doc, this.translate.instant("about.footer2"), lineText += 5);
        lineText = this.checkIfNewPage(doc, lineText);
        this.writelinePreFooter(doc, this.translate.instant("about.footer3"), lineText += 5);
        if(this.lang =='es'){
            lineText = this.checkIfNewPage(doc, lineText);
            this.writelinePreFooter(doc, this.translate.instant("about.footer4"), lineText += 5);
        }
        lineText = this.checkIfNewPage(doc, lineText);
        lineText += 10;
        lineText = this.checkIfNewPage(doc, lineText);
        this.writelinePreFooter(doc, this.translate.instant("about.footer5"), lineText);
        doc.setFillColor(249,66,58);
        if(this.lang=='en'){
            doc.rect(52, lineText-5, 17, 8, 'FD'); //Fill and Border
        }else{
            doc.rect(57, lineText-5, 17, 8, 'FD'); //Fill and Border
        }
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        var url = "https://nav29.org/login";
        if(this.lang=='en'){
            doc.textWithLink(this.translate.instant("menu.Register"), 54, lineText, { url: url });
        }else{
            doc.textWithLink(this.translate.instant("menu.Register"), 59, lineText, { url: url });
        }
        
        lineText = this.checkIfNewPage(doc, lineText);
        doc.setTextColor(0, 0, 0)
        lineText += 5;
        doc.setFontSize(9);
        doc.setTextColor(117, 120, 125)
        doc.text(this.translate.instant("about.footer6"), 10, lineText += 5);
        doc.setTextColor(51, 101, 138)
        var url = "mailto:support@foundation29.org";
        doc.textWithLink("support@foundation29.org", (((this.translate.instant("about.footer6")).length*2)-18), lineText, { url: url });
        //lineText = this.checkIfNewPage(doc, lineText);
        doc.setTextColor(0, 0, 0);
    }

    writelinePreFooter(doc, text, lineText){
        doc.setFontSize(9);
        doc.setTextColor(117, 120, 125)
        doc.setFont(undefined, 'normal');
        doc.text(text, 10, lineText);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
    }

    generateResultsPDF2(summaryJson, lang, qrCodeDataURL){
        //create a copy of jsonContent
        console.log(summaryJson);
        let jsonContent = JSON.parse(JSON.stringify(summaryJson));
        this.lang = lang;
        const doc = new jsPDF();
        var lineText = 0;
        const maxCharsPerLine = 120;
    
        // Cabecera inicial
        var img_logo = new Image();
        img_logo.src = "assets/img/logo-lg-white.png"
        doc.addImage(img_logo, 'png', 10, 10, 45, 17);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        var actualDate = new Date();
        var dateHeader = this.getFormatDate(actualDate);
        if(lang=='es'){
            this.writeDataHeader(doc, 87, 5, dateHeader);
        }else{
            this.writeDataHeader(doc, 93, 5, dateHeader);
        }
    
        //Add QR
        if(qrCodeDataURL == null){
            var img_qr = new Image();
            img_qr.src = "assets/img/elements/qr.png"
            doc.addImage(img_qr, 'png', 160, 5, 32, 30);
            doc.setFontSize(8);
            doc.text('https://nav29.org', 164, 37);
            doc.setFontSize(10);
        }else{
            var img_qr = new Image();
            img_qr.src = qrCodeDataURL;
            doc.addImage(img_qr, 'png', 160, 5, 32, 30);
            doc.setFontSize(8);
            doc.text(this.translate.instant("pdf.Scan to view the patient data"), 156, 37);
            doc.setFontSize(10);
        }
    
        this.newHeatherAndFooter(doc);
    
        lineText += 45;
    
        const listSections = [
            "CurrentStatus",
            "Diagnoses",
            "Medication",
            "Treatments",
            "LaboratoryFindings",
            "AdditionalInformation"
        ];
    
        const orderedSections = [
            { key: "Name", label: "summary.Name", isTitle: true },
            { key: "Age", label: "summary.Age", isTitle: true },
            { key: "Gender", label: "summary.Gender", isTitle: true },
            { key: "CurrentStatus", label: "summary.CurrentStatus", isTitle: false },
            { key: "Diagnoses", label: "summary.Diagnoses", isTitle: false },
            { key: "Medication", label: "summary.Medication", isTitle: false },
            { key: "Treatments", label: "summary.Treatments", isTitle: false },
            { key: "LaboratoryFindings", label: "summary.LaboratoryFindings", isTitle: false },
            { key: "AdditionalInformation", label: "summary.AdditionalInformation", isTitle: false }
        ];
    
        let nameTitleX = 10;
        let ageTitleX = 100;
        let genderTitleX = 150;
    
        // Imprimir 'Name', 'Age', 'Gender' en la misma fila
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(this.translate.instant("summary.Name"), nameTitleX, lineText);
        doc.text(this.translate.instant("summary.Age"), ageTitleX, lineText);
        doc.text(this.translate.instant("summary.Gender"), genderTitleX, lineText);
        lineText += 5;
    
        // Imprimir los valores debajo de los títulos
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        if(jsonContent.Name != ''){
            doc.text(jsonContent.Name, nameTitleX, lineText);
        } else {
            doc.text('-', nameTitleX, lineText);
        }
        if(jsonContent.Age != ''){
            doc.text(jsonContent.Age, ageTitleX, lineText);
        } else {
            doc.text('-', ageTitleX, lineText);
        }
        if(jsonContent.Gender != ''){
            doc.text(jsonContent.Gender, genderTitleX, lineText);
        } else {
            doc.text('-', genderTitleX, lineText);
        }
    
        lineText += 10;
        lineText = this.checkIfNewPage(doc, lineText);
    
        // Borramos estas propiedades para que no se vuelvan a imprimir
        delete jsonContent.Name;
        delete jsonContent.Age;
        delete jsonContent.Gender;
    
        orderedSections.forEach(section => {
            if (jsonContent[section.key] !== undefined) {
                const content = jsonContent[section.key];
            
                // Imprimir el título de la sección
                lineText += 10;
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                let nameSection = this.translate.instant(section.label);
                doc.text(nameSection, 10, lineText);
                lineText += 7;
            
                if (!content || content.length == 0) {
                    doc.text('-', 10, lineText);
                    lineText += 5;
                    lineText = this.checkIfNewPage(doc, lineText);
                } else {
                    if (listSections.includes(section.key)) {
                        // Tratar el contenido como una lista
                        doc.setFontSize(10);
                        doc.setFont(undefined, 'normal');
            
                        if (Array.isArray(content)) {
                            for (let item of content) {
                                if (typeof item === 'string') {
                                    const words = item.split(' ');
                                    while (words.length) {
                                        let lineSegment = words.shift();
                                        while (words.length && (lineSegment.length + words[0].length + 1 <= maxCharsPerLine)) {
                                            lineSegment += ' ' + words.shift();
                                        }
                                        doc.text('- ' + lineSegment, 10, lineText);
                                        lineText += 5;
                                        lineText = this.checkIfNewPage(doc, lineText);
                                    }
                                } else if (typeof item === 'object') {
                                    if (section.key === 'AdditionalInformation') {
                                        if (item.date) {
                                            doc.text(item.date, 10, lineText);
                                            lineText += 5;
                                            lineText = this.checkIfNewPage(doc, lineText);
                                        }
                                    
                                        const relevantTypes = ['diagnosis', 'symptom', 'test', 'treatment', 'medication', 'other'];
                                        let typeText = '';
                                        if (item.type && relevantTypes.includes(item.type)) {
                                            const translatedType = this.translate.instant('steps.' + item.type);
                                            typeText = translatedType + ': ';
                                        }
                                    
                                        let eventText = item.event || '';
                                        
                                        // Combine type and event
                                        let line = '  '; // Indent for the second line
                                        
                                        // Add type in bold if it exists
                                        if (typeText) {
                                            doc.setFont(undefined, 'bold');
                                            doc.text(typeText, 10, lineText);
                                            doc.setFont(undefined, 'normal');
                                            line += ' '.repeat(Math.ceil(doc.getStringUnitWidth(typeText) / doc.getStringUnitWidth(' ')));
                                        }
                                        
                                        // Add event
                                        const words = eventText.split(' ');
                                        for (let word of words) {
                                            if ((line + word).length > maxCharsPerLine) {
                                                if (line.trim()) {
                                                    doc.text(line, 10, lineText);
                                                    lineText += 5;
                                                    lineText = this.checkIfNewPage(doc, lineText);
                                                }
                                                line = '    ' + word + ' '; // Further indent continuation lines
                                            } else {
                                                line += word + ' ';
                                            }
                                        }
                                        if (line.trim()) {
                                            doc.text(line, 10, lineText);
                                            lineText += 5;
                                            lineText = this.checkIfNewPage(doc, lineText);
                                        }
                                         // Add a separator line
                                        lineText += 2; // Add a small space before the line
                                        doc.setDrawColor(200, 200, 200); // Light gray color
                                        doc.line(10, lineText, 200, lineText); // Draw a line from x=10 to x=200
                                        lineText += 5; // Add space after the line
                                        lineText = this.checkIfNewPage(doc, lineText);
                                      } else {
                                        // Handle other object items as before
                                        for (let key in item) {
                                          doc.text(`- ${key}: ${item[key]}`, 10, lineText);
                                          lineText += 5;
                                          lineText = this.checkIfNewPage(doc, lineText);
                                        }
                                      }
                                }
                            }
                        } else if (typeof content === 'string') {
                            // Tratar el contenido como un string
                            const words = content.split(' ');
                            while (words.length) {
                                let lineSegment = words.shift();
                                while (words.length && (lineSegment.length + words[0].length + 1 <= maxCharsPerLine)) {
                                    lineSegment += ' ' + words.shift();
                                }
                                doc.text(lineSegment, 10, lineText);
                                lineText += 5;
                                lineText = this.checkIfNewPage(doc, lineText);
                            }
                        }
                    } else {
                        let typeElement = typeof content;
                        if (typeElement == 'object') {
                            // Tratar el contenido como un objeto
                            doc.setFontSize(10);
                            doc.setFont(undefined, 'normal');
                            for (let item in content) {
                                const words = content[item].split(' ');
                                while (words.length) {
                                    let lineSegment = words.shift();
                                    while (words.length && (lineSegment.length + words[0].length + 1 <= maxCharsPerLine)) {
                                        lineSegment += ' ' + words.shift();
                                    }
                                    doc.text('- ' + item + ': ' + lineSegment, 10, lineText);
                                    lineText += 5;
                                    lineText = this.checkIfNewPage(doc, lineText);
                                }
                            }
                        } else {
                            // Tratar el contenido como un párrafo
                            doc.setFontSize(10);
                            doc.setFont(undefined, 'normal');
                            const words = content.split(' ');
                            while (words.length) {
                                let lineSegment = words.shift();
                                while (words.length && (lineSegment.length + words[0].length + 1 <= maxCharsPerLine)) {
                                    lineSegment += ' ' + words.shift();
                                }
                                doc.text(lineSegment, 10, lineText);
                                lineText += 5;
                                lineText = this.checkIfNewPage(doc, lineText);
                            }
                        }
                    }
                }
            }
        });
    
        lineText += 10;
        this.writeAboutUs(doc, lineText);
    
        var pageCount = doc.internal.pages.length; //Total Page Number
        pageCount = pageCount - 1;
        for (var i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            //footer page
            doc.text(this.translate.instant("pdf.page") + ' ' + i + '/' + pageCount, 97, 290);
        }
    
        // Save file
        var date = this.getDate();
        doc.save('Nav29_Report_' + date + '.pdf');
    }

    generateResultsPDF(htmlContent: string, lang: string, qrCodeDataURL: string | null) {
        this.lang = lang;
        const doc = new jsPDF();
        let lineText = 0;
        const maxCharsPerLine = 200;
    
        // Header
        var img_logo = new Image();
        img_logo.src = "assets/img/logo-lg-white.png"
        doc.addImage(img_logo, 'png', 10, 10, 45, 17);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        var actualDate = new Date();
        var dateHeader = this.getFormatDate(actualDate);
        if (lang == 'es') {
            this.writeDataHeader(doc, 87, 5, dateHeader);
        } else {
            this.writeDataHeader(doc, 93, 5, dateHeader);
        }
    
        // Add QR code
        if (qrCodeDataURL == null) {
            var img_qr = new Image();
            img_qr.src = "assets/img/elements/qr.png"
            doc.addImage(img_qr, 'png', 160, 5, 32, 30);
            doc.setFontSize(8);
            doc.text('https://nav29.org', 164, 37);
            doc.setFontSize(10);
        } else {
            var img_qr = new Image();
            img_qr.src = qrCodeDataURL;
            doc.addImage(img_qr, 'png', 160, 5, 32, 30);
            doc.setFontSize(8);
            doc.text(this.translate.instant("pdf.Scan to view the patient data"), 156, 37);
            doc.setFontSize(10);
        }
    
        this.newHeatherAndFooter(doc);
    
        lineText = 45;
    
        // Parse HTML content
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
    
        // Process HTML elements
        lineText = this.processHTMLElement(doc, htmlDoc.body, 10, lineText, maxCharsPerLine);
        lineText = this.checkIfNewPage2(doc, lineText+20);
        // Add about us section
        lineText = doc.internal.pageSize.height - 60;
        this.writeAboutUs(doc, lineText);
    
        // Add page numbers
        var pageCount = doc.internal.pages.length - 1;
        for (var i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(this.translate.instant("pdf.page") + ' ' + i + '/' + pageCount, 97, 290);
        }
    
        // Save file
        var date = this.getDate();
        doc.save('Nav29_Report_' + date + '.pdf');
    }

    private processParagraph(doc: any, elem: Element, x: number, y: number, maxWidth: number, prefix: string = ''): number {
        const startX = x;
        let currentX = x;
        let currentY = y;
        
        if (prefix) {
            [currentX, currentY] = this.writeText(doc, prefix, currentX, currentY, maxWidth, true);
        }
        
        for (const child of Array.from(elem.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                const nodeText = child.textContent || '';
                [currentX, currentY] = this.writeText(doc, nodeText, currentX, currentY, maxWidth, false);
            } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'b') {
                const boldText = child.textContent || '';
                doc.setFont(undefined, 'bold');
                [currentX, currentY] = this.writeText(doc, boldText + ' ', currentX, currentY, maxWidth, true); // Added space after bold text
                doc.setFont(undefined, 'normal');
            }
        }
        
        return currentY + 5; // Add some space after each paragraph
    }
    
    private writeText(doc: any, text: string, x: number, y: number, maxWidth: number, isBold: boolean): [number, number] {
        const words = text.split(' ');
        let line = '';
        let currentX = x;
        let currentY = y;
        
        for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            const testWidth = doc.getStringUnitWidth(testLine) * doc.internal.getFontSize() / doc.internal.scaleFactor;
            
            if (testWidth > maxWidth - x) { // Subtract x to account for left margin
                doc.text(line, x, currentY);
                line = word;
                currentY += 5;
                currentX = x;
                currentY = this.checkIfNewPage2(doc, currentY);
            } else {
                line = testLine;
            }
        }
        
        if (line) {
            doc.text(line, currentX, currentY);
            currentX += doc.getStringUnitWidth(line) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        }
        
        return [currentX, currentY];
    }
    
    private processHTMLElement(doc: any, element: Element, x: number, y: number, maxWidth: number): number {
        for (const child of Array.from(element.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim() || '';
                if (text) {
                    [, y] = this.writeText(doc, text, x, y, maxWidth, false);
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const elem = child as Element;
                switch (elem.tagName.toLowerCase()) {
                    case 'h4':
                    case 'h5':
                        y = this.checkIfNewPage(doc, y + 10);
                        doc.setFontSize(elem.tagName === 'h4' ? 16 : 14);
                        doc.setFont(undefined, 'bold');
                        [, y] = this.writeText(doc, elem.textContent || '', x, y, maxWidth, true);
                        doc.setFontSize(10);
                        doc.setFont(undefined, 'normal');
                        y += 5;
                        break;
                    case 'p':
                        y = this.checkIfNewPage(doc, y + 5);
                        y = this.processParagraph(doc, elem, x, y, maxWidth);
                        break;
                    case 'table':
                        y = this.checkIfNewPage(doc, y + 10);
                        y = this.processTable(doc, elem, x, y, maxWidth);
                        break;
                    case 'ul':
                    case 'ol':
                        y = this.checkIfNewPage(doc, y + 5);
                        for (const li of Array.from(elem.getElementsByTagName('li'))) {
                            // Incrementar el margen para listas anidadas
                            y = this.processParagraph(doc, li, x + 10, y, maxWidth - 10, '• ');
                            y = this.checkIfNewPage2(doc, y);
                        }
                        y += 5; // Añadir espacio después de la lista
                        break;
                    case 'b':
                    case 'strong':
                        doc.setFont(undefined, 'bold');
                        [, y] = this.writeText(doc, elem.textContent || '', x, y, maxWidth, true);
                        doc.setFont(undefined, 'normal');
                        break;
                    default:
                        y = this.processHTMLElement(doc, elem, x, y, maxWidth);
                }
            }
            y = this.checkIfNewPage2(doc, y);
        }
        return y;
    }

    private processTable(doc: any, table: Element, x: number, y: number, maxWidth: number): number {
        const rows = table.getElementsByTagName('tr');
        const colWidths = [60, 60, 70]; // Ajusta los anchos de columna según sea necesario
    
        for (const row of Array.from(rows)) {
            const cells = row.children;
            let cellX = x;
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const cellText = cell.textContent || '';
                doc.setFont(undefined, cell.tagName.toLowerCase() === 'th' ? 'bold' : 'normal');
                
                // Ajustar el texto para que se ajuste al ancho de la columna
                const words = cellText.split(' ');
                let line = '';
                for (const word of words) {
                    const testLine = line + (line ? ' ' : '') + word;
                    const testWidth = doc.getStringUnitWidth(testLine) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                    
                    if (testWidth > colWidths[i]) {
                        doc.text(line, cellX, y);
                        line = word;
                        y += 5; // Ajusta la altura de la línea según sea necesario
                    } else {
                        line = testLine;
                    }
                }
                if (line) {
                    doc.text(line, cellX, y);
                }
                cellX += colWidths[i];
            }
            y += 10; // Ajusta la altura de la fila según sea necesario
            y = this.checkIfNewPage2(doc, y);
        }
        return y;
    }
    
    private checkIfNewPage2(doc, y) {
        const pageHeight = doc.internal.pageSize.height;
        const margin = 30; // Increased margin
        if (y > pageHeight - margin) {
            doc.addPage();
            this.newHeatherAndFooter(doc);
            return 45; // Return to top of new page, after header
        }
        return y;
    }
    
    // Order by descending key
    keyDescOrder = ((a, b) => {
        var a_month=a.split("-")[0]
        var a_year = a.split("-")[1]
        var b_month=b.split("-")[0]
        var b_year=b.split("-")[1]
        a_month = this.getMonthFromString(a_month);
        b_month = this.getMonthFromString(b_month);
        if(new Date(a_year).getTime() > new Date(b_year).getTime()){
            return 1;
        }
        else if(new Date(a_year).getTime() < new Date(b_year).getTime()){
            return -1;
        }
        else{
            if(new Date(a_month).getTime() > new Date(b_month).getTime()){
                return 1;
            }
            else if(new Date(a_month).getTime() < new Date(b_month).getTime()){
                return -1;
            }
            else{
                return 0;
            }
        }
    })

    getMonthFromString(mon) {
        if (this.lang != 'es') {
            return new Date(Date.parse(mon + " 1, 2012")).getMonth() + 1
        } else {
            var date = new Date(Date.parse(this.meses[mon] + " 1, 2012")).getMonth() + 1;
            return date;
        }

    }

    // Order by descending value
    valueDateDescOrder = ((a,b)=> {
        if(new Date(a).getTime() > new Date(b).getTime()){
            return -1;
        }
        else if(new Date(a).getTime() < new Date(b).getTime()){
            return -1;
        }
        else return 0;
    })

}
