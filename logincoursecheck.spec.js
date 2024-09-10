import { test, expect } from '@playwright/test';
const fs = require('fs');
const csv = require('csv-parser');
const { parse } = require('json2csv');

// Function to read credentials from a CSV file
async function getCredentials(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        if (results.length > 0) {
          resolve(results);
        } else {
          reject(new Error('No data found in CSV file'));
        }
      })
      .on('error', (error) => reject(error));
  });
}

// Function to append login results to a CSV file
function writeLoginResult(username, result) {
  const csvRow = parse([{ username, result }], { header: false });
  fs.appendFileSync('login_results.csv', `${csvRow}\n`, 'utf8');
}

// Function to attempt login and handle errors
async function attemptLogin(page, username, password) {
  try {
    await page.goto('http://10.11.51.225/');
    await page.getByPlaceholder('Enter username').click();
    await page.getByPlaceholder('Enter username').fill(username);
    await page.getByRole('button', { name: 'Connect to My Tantrik Instance' }).click();
    const erroruser = await page.getByText('You are not assigned to any Tantrik instance. Please reach out to the administrator for assistance.').isVisible({ timeout: 2000 }).catch(() => false);
    if (erroruser) {
      console.log(`Login failed for user ${username}: Invalid username or user not added in server 225.`);
      writeLoginResult(username, 'fail');
      return false;
    }
    console.log(`Connected to My Tantrik Instance`);
    console.log(`Current URL: ${page.url()}`);
    const passwordField = page.getByLabel('Password:');
    await passwordField.waitFor({ state: 'visible' });
    await passwordField.click();
    await passwordField.fill(username);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // await page.goto('http://10.11.51.201:8000/hub/login?next=%2Fhub%2F', { waitUntil: 'networkidle' });
    // await page.getByLabel('Username:').fill(username);
    // await page.getByLabel('Password:').fill(password);
    // await page.getByRole('button', { name: 'Sign In' }).click();

    const errorMessage = page.getByText('Invalid username or password.');
    const errorVisible = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    if (errorVisible) {
      console.log(`Login failed for user ${username}: Invalid username or password.`);
      writeLoginResult(username, 'fail');
      return false;
    }

    console.log(`valid user ${username}. Checking further...`);

    const startButton = page.getByRole('button', { name: 'Start' });
    try {
      await startButton.waitFor({ state: 'visible', timeout: 3000 });
      await startButton.click();
      console.log(`Start button clicked for user ${username}.`);
    } catch (error) {
      console.log(`Start button not visible for user ${username}.`);
    }

    const startTime = Date.now();
    const timeout = 3 * 60 * 1000;
    let nbgraderVisible = false;

    while (Date.now() - startTime < timeout) {
      nbgraderVisible = await page.getByText('Nbgrader', { exact: true }).isVisible({ timeout: 3000 }).catch(() => false);

      if (nbgraderVisible) {
        console.log(`'Nbgrader' text visible for user ${username}.`);
        await page.getByText('Nbgrader', { exact: true }).click();
        await page.locator('#jp-mainmenu-nbgrader').getByText('Assignment List').click();
        await page.getByRole('button', { name: 'Toggle Dropdown' }).click();
        const courseLinks = await page.locator('role=link').allInnerTexts();
        console.log(`Courses available for ${username}: ${courseLinks.join(', ')}`);
        const course = 'dl2';
        const coursecheck = courseLinks.find(course => course.includes('dl2'));

        if (coursecheck) {
          console.log(`Course ${course} found for user ${username}, clicking on it.`);
          await page.getByRole('link', { name: course }).click();
          await page.getByText('File', { exact: true }).click();
          await page.getByText('Log Out').nth(3).click();
          console.log(`Successfully logged out for user ${username} after selecting ${course}.`);
          writeLoginResult(username, 'success');
          return true;
        } else {
          console.log(`Course ${course} not found for user ${username}, exiting.`);
          writeLoginResult(username, 'fail');
          return false;
        }
      }
    }

    console.log(`'Nbgrader' text not visible for user ${username} within the timeout period.`);
    writeLoginResult(username, 'fail');
    return false;
  } catch (error) {
    console.error(`Login failed for user ${username}: ${error.message}`);
    writeLoginResult(username, 'fail');
    return false;
  }
}

// Function to process a batch of credentials
async function processBatch(credentialsList, browser) {
  const failedUsers = [];

  const loginPromises = credentialsList.map(async ({ username, password }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log(`Attempting login for user ${username} in new context`);
      const loginSuccessful = await attemptLogin(page, username, password);

      if (!loginSuccessful) {
        console.log(`Login failed for user ${username}, trying next user...`);
        failedUsers.push(username);
      }
    } catch (error) {
      console.error(`Error during login attempt for user ${username}: ${error.message}`);
      failedUsers.push(username);
    } finally {
      await context.close();
    }
  });

  await Promise.all(loginPromises);
}

// Function to split an array into chunks
function chunkArray(array, chunkSize) {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

test('login tests', async ({ browser }) => {
  console.time('Total Execution Time'); // Start the timer
  const credentialsList = await getCredentials('demo.csv');
  const batches = chunkArray(credentialsList, 1); // Split into batches of 1

  for (const batch of batches) {
    console.log(`Processing batch of ${batch.length} users...`);
    await processBatch(batch, browser);
  }

  console.timeEnd('Total Execution Time'); // End the timer and log the duration
});
