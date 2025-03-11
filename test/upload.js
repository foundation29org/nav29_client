const { Builder, By, until } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { assert } = require('chai');
const path = require('path');

describe('Uploader', () => {
  let driver, username, password;
  beforeEach(async () => {
    let options = new firefox.Options();
    // options.headless(); 
    driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
    username = 'suppapollo@gmail.com';
    password = 'j1h4a8dh2d8ah34ha83';
    await login(driver, username, password); // extracted login into helper
  });
  afterEach(async () => {
    await driver.close();
  });
  it('should upload file extract events', async () => {
    // wait 
    await waitForElement(driver, By.id('fileDropRef'), 5000);
    // find
    const input = await driver.findElement(By.id('fileDropRef'));
    let filePath = path.join(__dirname, '../example_files/test.pdf');
    // act 
    await input.sendKeys(filePath); 
    // wait
    await waitForElement(driver, By.css('span.ml-1:nth-child(4)'), 120000)
    // assert
    const message = await driver.findElement(By.css('span.ml-1:nth-child(4)')).getText();
    assert.include(message, 'View extracted events');
    // check the extracted events has the proper structure
    await waitForElement(driver, By.css('span.ng-star-inserted:nth-child(3) > p:nth-child(1) > strong:nth-child(1)'), 5000);
    const allergy = await driver.findElement(By.css('span.ng-star-inserted:nth-child(3) > p:nth-child(1) > strong:nth-child(1)')).getText();
    assert.include(allergy, 'Allergies');

    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > category-component:nth-child(4) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)'), 5000);
    const anomalies = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > category-component:nth-child(4) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)')).getText();
    assert.include(anomalies, 'Anomalies');

    await waitForElement(driver, By.css('category-component.ng-star-inserted:nth-child(5) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)'), 5000);
    const diagnosis = await driver.findElement(By.css('category-component.ng-star-inserted:nth-child(5) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)')).getText();
    assert.include(diagnosis, 'Diagnostics');

    await waitForElement(driver, By.css('category-component.ng-star-inserted:nth-child(6) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)'), 5000);
    const symptoms = await driver.findElement(By.css('category-component.ng-star-inserted:nth-child(6) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)')).getText();
    assert.include(symptoms, 'Symptoms');

    await waitForElement(driver, By.css('category-component.ng-star-inserted:nth-child(7) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)'), 5000);
    const drugs = await driver.findElement(By.css('category-component.ng-star-inserted:nth-child(7) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)')).getText();
    assert.include(drugs, 'Drugs');

    await waitForElement(driver, By.css('category-component.ng-star-inserted:nth-child(8) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)'), 5000);
    const treatments = await driver.findElement(By.css('category-component.ng-star-inserted:nth-child(8) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)')).getText();
    assert.include(treatments, 'Treatments');

  });

  it('should delete uploaded file', async () => {
    // delete test    
    await driver.get('http://localhost:4200/home?my=Data');
  
    await waitForElement(driver, By.css('#dropdownSympt'), 5000);
    await driver.findElement(By.css('#dropdownSympt')).click();
  
    await waitForElement(driver, By.linkText('Delete'), 5000);
    await driver.findElement(By.linkText('Delete')).click();
  
    await waitForElement(driver, By.css('.swal2-confirm'), 5000);
    await driver.findElement(By.css('.swal2-confirm')).click();
  
    await waitForElement(driver, By.css('.toast-title'), 5000);
    
    let toast;

    try {
      toast = await driver.findElement(By.css('.toast-title')).getText();
      assert.include(toast, 'Deleted');
    } catch (e) {
      await driver.sleep(500);
      toast = await driver.findElement(By.css('.toast-title')).getText();
      assert.include(toast, 'Deleted'); 
    }
  });

  it('should upload file summarize and delete it', async () => {
    // wait 
    await waitForElement(driver, By.id('fileDropRef'), 5000);
    // find
    const input = await driver.findElement(By.id('fileDropRef'));
    let filePath = path.join(__dirname, '../example_files/test.pdf');
    // act 
    await input.sendKeys(filePath); 
    // wait
    await waitForElement(driver, By.css('span.ml-1:nth-child(3)'), 120000)
    // assert
    const message = await driver.findElement(By.css('span.ml-1:nth-child(3)')).getText();
    assert.include(message, 'View summary');
    // wait
    await waitForElement(driver, By.css('span.ml-1:nth-child(4)'), 120000)
    // assert
    const message2 = await driver.findElement(By.css('span.ml-1:nth-child(4)')).getText();
    assert.include(message2, 'View extracted events');
    // click it and check the summary structure
    await driver.findElement(By.css('span.ml-1:nth-child(3)')).click();
    // wait
    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > h5:nth-child(1)'), 5000);
    // assert
    const purpose = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > h5:nth-child(1)')).getText();
    assert.include(purpose, 'Document Purpose');

    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > h5:nth-child(1)'), 5000);
    const patient = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > h5:nth-child(1)')).getText();
    assert.include(patient, 'Patient Introduction');

    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(3) > h5:nth-child(1)'), 5000);
    const anomalies = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(3) > h5:nth-child(1)')).getText();
    assert.include(anomalies, 'Anomalies');

    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > h5:nth-child(1)'), 5000);
    const information = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > h5:nth-child(1)')).getText();
    assert.include(information, 'Key Information');

    // delete test    
    await driver.get('http://localhost:4200/home?my=Data');
  
    await waitForElement(driver, By.css('#dropdownSympt'), 5000);
    await driver.findElement(By.css('#dropdownSympt')).click();
  
    await waitForElement(driver, By.linkText('Delete'), 5000);
    await driver.findElement(By.linkText('Delete')).click();
  
    await waitForElement(driver, By.css('.swal2-confirm'), 5000);
    await driver.findElement(By.css('.swal2-confirm')).click();
  
    await waitForElement(driver, By.css('.toast-title'), 5000);
    
    let toast;

    try {
      toast = await driver.findElement(By.css('.toast-title')).getText();
      assert.include(toast, 'Deleted');
    } catch (e) {
      await driver.sleep(500);
      toast = await driver.findElement(By.css('.toast-title')).getText();
      assert.include(toast, 'Deleted'); 
    }
  });

  it('should upload file summarize patient and delete it', async () => {
    // wait 
    await waitForElement(driver, By.id('fileDropRef'), 5000);
    // find
    const input = await driver.findElement(By.id('fileDropRef'));
    let filePath = path.join(__dirname, '../example_files/test.pdf');
    // act 
    await input.sendKeys(filePath); 
    // wait
    await waitForElement(driver, By.css('span.ml-1:nth-child(3)'), 120000)
    // assert
    const message = await driver.findElement(By.css('span.ml-1:nth-child(3)')).getText();
    assert.include(message, 'View summary');
    // wait
    await waitForElement(driver, By.css('span.ml-1:nth-child(4)'), 120000)
    // assert
    const message2 = await driver.findElement(By.css('span.ml-1:nth-child(4)')).getText();
    assert.include(message2, 'View extracted events');

    // go to My Data
    await driver.get('http://localhost:4200/home?my=Data');

    // wait to load summarize button
    await waitForElement(driver, By.css('button.btn-fab:nth-child(1)'), 10000);
    await driver.findElement(By.css('button.btn-fab:nth-child(1)')).click();
    // click it and wait for the patient summary to generate
    await waitForElement(driver, By.css('.swal2-confirm'), 10000);
    await driver.findElement(By.css('.swal2-confirm')).click();
    
    // wait
    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)'), 50000);
    // assert
    const name = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > p:nth-child(1) > strong:nth-child(1)')).getText();
    assert.include(name, 'Name');
    
    // wait
    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > p:nth-child(2) > strong:nth-child(1)'), 5000);
    // assert
    const age = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > p:nth-child(2) > strong:nth-child(1)')).getText();
    assert.include(age, 'Age');
    
    // wait
    await waitForElement(driver, By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > p:nth-child(3) > strong:nth-child(1)'), 5000);
    // assert
    const gender = await driver.findElement(By.css('#idBody > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > p:nth-child(3) > strong:nth-child(1)')).getText();
    assert.include(gender, 'Gender');

    // wait
    await waitForElement(driver, By.css('div.mt-3:nth-child(2) > h4:nth-child(1)'), 5000);
    // assert
    const status = await driver.findElement(By.css('div.mt-3:nth-child(2) > h4:nth-child(1)')).getText();
    assert.include(status, 'Current status');

    // wait
    await waitForElement(driver, By.css('div.mt-3:nth-child(3) > h4:nth-child(1)'), 5000);
    // assert
    const diagnoses = await driver.findElement(By.css('div.mt-3:nth-child(3) > h4:nth-child(1)')).getText();
    assert.include(diagnoses, 'Diagnoses');

    // wait
    await waitForElement(driver, By.css('div.mt-3:nth-child(4) > h4:nth-child(1)'), 5000);
    // assert
    const medication = await driver.findElement(By.css('div.mt-3:nth-child(4) > h4:nth-child(1)')).getText();
    assert.include(medication, 'Medication');

    // wait
    await waitForElement(driver, By.css('div.mt-3:nth-child(5) > h4:nth-child(1)'), 5000);
    // assert
    const treatments = await driver.findElement(By.css('div.mt-3:nth-child(5) > h4:nth-child(1)')).getText();
    assert.include(treatments, 'Treatments');

    // wait
    await waitForElement(driver, By.css('div.mt-3:nth-child(6) > h4:nth-child(1)'), 5000);
    // assert
    const laboratory = await driver.findElement(By.css('div.mt-3:nth-child(6) > h4:nth-child(1)')).getText();
    assert.include(laboratory, 'Laboratory findings');

    // wait
    await waitForElement(driver, By.css('div.mt-3:nth-child(7) > h4:nth-child(1)'), 5000);
    // assert
    const information = await driver.findElement(By.css('div.mt-3:nth-child(7) > h4:nth-child(1)')).getText();
    assert.include(information, 'Additional information');

    // delete test    
    await driver.get('http://localhost:4200/home?my=Data');
  
    await waitForElement(driver, By.css('#dropdownSympt'), 5000);
    await driver.findElement(By.css('#dropdownSympt')).click();
  
    await waitForElement(driver, By.linkText('Delete'), 5000);
    await driver.findElement(By.linkText('Delete')).click();
  
    await waitForElement(driver, By.css('.swal2-confirm'), 5000);
    await driver.findElement(By.css('.swal2-confirm')).click();
  
    await waitForElement(driver, By.css('.toast-title'), 5000);
    
    let toast;

    try {
      toast = await driver.findElement(By.css('.toast-title')).getText();
      assert.include(toast, 'Deleted');
    } catch (e) {
      await driver.sleep(500);
      toast = await driver.findElement(By.css('.toast-title')).getText();
      assert.include(toast, 'Deleted'); 
    }
  });
});

// helper functions

async function login(driver, username, password) {
    // login helper function
    await driver.get('http://localhost:4200/');
    await driver.manage().window().maximize();
    await waitForElement(driver, By.css('.btn-dark:nth-child(2)'), 5000);
    await driver.findElement(By.css('.btn-dark:nth-child(2)')).click();
    await driver.findElement(By.css('.formGroup:nth-child(2) > .form-control')).sendKeys(username);
    await driver.findElement(By.css('.mt-2 > .form-control')).sendKeys(password);
    await driver.findElement(By.css('.formGroup > .btn')).click();
    // wait for login
    await waitForElement(driver, By.css('#navbarSupportedContent > ul > li.nav-item.active > a'), 10000);
}

async function waitForElement(driver, selector, timeout) {
    // wait for element helper function
    await driver.wait(until.elementLocated(selector), timeout);

}