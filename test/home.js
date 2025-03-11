const { Builder, By, Key, until } = require('selenium-webdriver')
const firefox = require('selenium-webdriver/firefox');
const { assert } = require('chai');

describe('Chat Logic', function() {
  let driver, username, password;
  beforeEach(async function() {
    let options = new firefox.Options();
    // options.headless();
    driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build()
    username = 'aitestingalpha@gmail.com';
    password = 'j1h4a8dh2d8ah34ha83';
    await login(driver, username, password);
  })
  afterEach(async function closeBrowser(){ 
      driver.close(); 
    });

  it('basic chat', async function() {
    await waitForElement(driver, By.css(".ng-valid"), 10000);
    await driver.findElement(By.css(".ng-valid")).sendKeys("Hola")
    await driver.findElement(By.css("button.mr-1")).click()
    await driver.wait(until.elementLocated(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")), 15000);
    let answer = await driver.findElement(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")).getText()
    assert(answer.includes("Hola"));
    await driver.findElement(By.css("button.float-right")).click()
  })

  it('new document', async function() {
    await waitForElement(driver, By.css(".ng-valid"), 10000);
    await driver.findElement(By.css(".ng-valid")).sendKeys("quiero subir un nuevo documento")
    await driver.findElement(By.css("button.mr-1")).click()
    await driver.wait(until.elementLocated(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")), 15000);
    let answer = await driver.findElement(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")).getText()
    assert(answer.includes("Select document"));
    await driver.findElement(By.css("button.float-right")).click()
  })

  it('new event', async function() {
    await waitForElement(driver, By.css(".ng-valid"), 10000);
    await driver.findElement(By.css(".ng-valid")).sendKeys("estoy tomando aspirina 50mg")
    await driver.findElement(By.css("button.mr-1")).click()
    await driver.wait(until.elementLocated(By.css(".border > span:nth-child(1)")), 15000);
    let answer = await driver.findElement(By.css(".border > span:nth-child(1)")).getText()
    assert(answer.includes("event"));
    await driver.findElement(By.css("button.float-right")).click()
  })
  
  it('new share', async function() {
    await waitForElement(driver, By.css(".ng-valid"), 10000);
    await driver.findElement(By.css(".ng-valid")).sendKeys("quiero compartir con mi medico")
    await driver.findElement(By.css("button.mr-1")).click()
    await driver.wait(until.elementLocated(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")), 15000);
    await driver.wait(until.elementLocated(By.css("#idHeader > button")), 5000);
    await driver.findElement(By.css("#idHeader > button")).click()
    let answer = await driver.findElement(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")).getText()
    assert(answer.includes("share"));
    const clear = await driver.findElement(By.css("button.float-right"));
    await driver.executeScript("arguments[0].click();", clear);
  })

  it('new contact', async function() {
    await waitForElement(driver, By.css(".ng-valid"), 10000);
    await driver.findElement(By.css(".ng-valid")).sendKeys("quiero contactar con mi medico")
    await driver.findElement(By.css("button.mr-1")).click()
    await driver.wait(until.elementLocated(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")), 15000);
    await driver.wait(until.elementLocated(By.css("#idHeader > button")), 5000);
    await driver.findElement(By.css("#idHeader > button")).click()
    let answer = await driver.findElement(By.css("div.chat-messages:nth-child(3) > div:nth-child(2) > span:nth-child(1)")).getText()
    assert(answer.includes("contact"));
    const clear = await driver.findElement(By.css("button.float-right"));
    await driver.executeScript("arguments[0].click();", clear);
  })

  it('new event detected', async function() {
    await waitForElement(driver, By.css(".ng-valid"), 10000);
    await driver.findElement(By.css(".ng-valid")).sendKeys("estoy sintiendome mareado, que me recomiendas??")
    await driver.findElement(By.css("button.mr-1")).click()
    await driver.wait(until.elementLocated(By.css(".border > span:nth-child(1)")), 35000);
    let answer = await driver.findElement(By.css(".border > span:nth-child(1)")).getText()
    assert(answer.includes("event"));
    await driver.findElement(By.css("button.float-right")).click()
  })

})

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