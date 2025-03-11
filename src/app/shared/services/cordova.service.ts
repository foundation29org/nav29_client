import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';
import { InsightsService } from 'app/shared/services/azureInsights.service';

declare var device;
declare let cordova: any;
declare let window: any;
declare let FileTransfer: any;
declare global {
    interface Navigator {
      camera: {
          getPicture: (par1,par2,par3) => any; // Or whatever is the type of the exitApp function
      }
    }
}

@Injectable()
export class CordovaService {

    langs: any = [];
    isMobile: boolean = false;
    num_permissions:number = 0;
    permissions:any;
    list_permissions:any;
    constructor() {
      var touchDevice = (navigator.maxTouchPoints || 'ontouchstart' in document.documentElement);
      //console.log('touchDevice', touchDevice)
      if (touchDevice>1 && /Android/i.test(navigator.userAgent)) {
        this.isMobile = true;
      } else if (touchDevice>1 && /iPhone/i.test(navigator.userAgent)) {
        this.isMobile = true;
      }
    }
    public insightsService: InsightsService


    checkPermissions(){
      this.permissions = cordova.plugins.permissions;

      this.list_permissions = [
        this.permissions.READ_EXTERNAL_STORAGE,
        this.permissions.WRITE_EXTERNAL_STORAGE,
        this.permissions.MANAGE_DOCUMENTS
      ];

      this.permissions.requestPermissions(this.list_permissions, this.requestSuccess, this.requestError);

      this.num_permissions = this.list_permissions.length;
    }

    requestSuccess(){
      for (var i = 0; i < this.num_permissions; i++) {
        this.permissions.checkPermission(this.list_permissions[i], function( status ){
          if ( status.hasPermission ) {
            //console.warn("Yes :D -> " + list_permissions[i]);
          }
          else {
            //console.warn("No :( -> " + list_permissions[i]);
          }
        });
      }
    }

    requestError(){
      console.warn("Permissions request error");
    }

    
    saveBlob2File (fileName, blob) {
      var folder = cordova.file.externalRootDirectory + 'Download'
      if(device.platform == 'iOS'){
        folder = cordova.file.documentsDirectory;
      }
      window.resolveLocalFileSystemURL(folder, function (dirEntry) {
        this.createFile(dirEntry, fileName, blob)
      }.bind(this), this.onErrorLoadFs)
    }

    createFile (dirEntry, fileName, blob) {
      // Creates a new file
      dirEntry.getFile(fileName, { create: true, exclusive: false }, function (fileEntry) {
        this.writeFile(fileEntry, blob)
      }.bind(this), this.onErrorCreateFile)
    }

    writeFile (fileEntry, dataObj) {
      // Create a FileWriter object for our FileEntry
      fileEntry.createWriter(function (fileWriter) {
        fileWriter.onwriteend = function () {
          Swal.fire({
              title: 'Saved on download folder.',
              icon: 'success',
              showCancelButton: false,
              confirmButtonColor: "#DD6B55",
              confirmButtonText: 'ok',
              }
          );
        }

        fileWriter.onerror = function (error) {
          console.log('Failed file write: ' + error)
          this.insightsService.trackException(error);
        }
        fileWriter.write(dataObj)
      })
    }

    onErrorLoadFs (error) {
      console.log(error)
      this.insightsService.trackException(error);
    }

    onErrorCreateFile (error) {
      console.log(error)
      this.insightsService.trackException(error);
    }

    goToExternalUrl(url){
      if (this.isMobile) {
        if(device.platform == 'iOS'){
          cordova.InAppBrowser.open(url, '_blank', 'location=yes');
        }else{
          cordova.InAppBrowser.open(url, '_blank', 'location=yes');
          //cordova.InAppBrowser.open(url, "_system", { location: "yes", closebuttoncaption: "Done" });
        }
      }else{
        window.open(url, '_blank');
      }
    }

    downloadFile(url, fileName){
      var dirFicheros, directorio;
      var esAndroid = false;
      var assetURL = url;
      if(device.platform == 'android' || device.platform == 'Android'){
        esAndroid = true;
        dirFicheros =  cordova.file.externalRootDirectory;
        directorio = 'Download';
      }else{
        dirFicheros =  cordova.file.documentsDirectory;
        directorio = 'Documents';
        cordova.InAppBrowser.open(assetURL, "_system", { location: "yes", closebuttoncaption: "Done" });
      }


      if(esAndroid){
        var fileTransfer = new FileTransfer();
        var urlToFile1 = dirFicheros + directorio + '/' + fileName;
        fileTransfer.download(assetURL, urlToFile1,
          function(entry) {
            window.resolveLocalFileSystemURL(dirFicheros, function (fileSystem) {
                fileSystem.getDirectory(directorio, { create: true }, function (dirEntry) {

                  Swal.fire({
                      title: 'Saved on download folder.',
                      icon: 'success',
                      showCancelButton: false,
                      confirmButtonColor: "#DD6B55",
                      confirmButtonText: 'ok',
                      }
                  );

                }, function(error){
                    console.log(error);
                    this.insightsService.trackException(error);
                    Swal.fire({
                        title: 'error2',
                        icon: 'error',
                        showCancelButton: false,
                        confirmButtonColor: "#DD6B55",
                        confirmButtonText: 'ok',
                        }
                    );
                });
            },
            function(event){
                console.log( event.target.error.code );
                this.insightsService.trackException(event.target.error);
                Swal.fire({
                    title: 'error3',
                    icon: 'error',
                    showCancelButton: false,
                    confirmButtonColor: "#DD6B55",
                    confirmButtonText: 'ok',
                    }
                );
            });

          },
          function(err) {
            console.log("Error4");
            this.insightsService.trackException(err);
            console.dir(err);
          });
        }
  }

}
