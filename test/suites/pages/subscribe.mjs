/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import assert from "assert";
import webdriver from "selenium-webdriver";
import {checkLastError} from "../../misc/utils.mjs";
import {runFirstTest, takeScreenshot, writeScreenshotFile} from "./utils.mjs";

const {By, until} = webdriver;

async function clickSubscribe(driver, url)
{
  await driver.navigate().to(url);
  await driver.findElement(By.id("subscribe-button")).click();
  await driver.switchTo().window(
    await driver.wait(async() => (await driver.getAllWindowHandles())[2],
                      3000, "extension page didn't open")
  );
}

async function confirmSubscribe(driver)
{
  await driver.wait(until.ableToSwitchToFrame(0), 4000);
  let dialog = await driver.wait(
    until.elementLocated(By.id("dialog-content-predefined")), 4000
  );
  await driver.wait(async() =>
  {
    let [displayed, title] = await Promise.all([
      dialog.isDisplayed(),
      dialog.findElement(By.css(".title span")).getText()
    ]);
    return displayed && title == "ABP Testcase Subscription";
  }, 3000, "dialog shown");
  await dialog.findElement(By.css(".default-focus")).click();
}

async function checkSubscriptionAdded(driver, url)
{
  let [added, err] = await driver.executeAsyncScript(`
     let callback = arguments[arguments.length - 1];
     browser.runtime.sendMessage({type: "subscriptions.get",
                                  ignoreDisabled: true,
                                  downloadable: true}).then(subs =>
       subs.some(s =>
         s.url == "${url}abp-testcase-subscription.txt"
       )
     ).then(
       res => callback([res, null]),
       err => callback([null, err])
     );`);
  if (err)
    throw err;
  assert.ok(added, "subscription added");
}

export default () =>
{
  it("subscribes to a link", async function()
  {
    let {testPagesURL} = this.test.parent.parent;
    try
    {
      await clickSubscribe(this.driver, testPagesURL);
      await confirmSubscribe(this.driver);
      await checkSubscriptionAdded(this.driver, testPagesURL);
    }
    catch (e)
    {
      let screenshot = await takeScreenshot(this.driver);
      let scrPath = await writeScreenshotFile(screenshot, this.browserName,
                                              this.browserVersion,
                                              this.test.title, "actual");
      throw new Error(`${e.message}\n${testPagesURL}\n(see ${scrPath})`);
    }
    await runFirstTest(this.driver, this.browserName, this.browserVersion,
                       this.test.parent.parent.pageTests, this.test.title);
    await checkLastError(this.driver, this.extensionHandle);
  });
};
