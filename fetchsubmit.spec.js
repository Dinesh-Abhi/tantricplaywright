import { test, expect } from '@playwright/test';
import axios from 'axios'; // Import axios for making HTTP requests
const fs = require('fs');
const csv = require('csv-parser');
const { parse } = require('json2csv'); // Ensure you have installed this package

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

// Function to attempt login and handle errors
async function attemptLogin(page, username, password) {
  try {
    await page.goto('http://10.11.51.201:8000/hub/login?next=%2Fhub%2F', { waitUntil: 'networkidle' });

    // Fill in login credentials
    await page.getByLabel('Username:').fill(username);
    await page.getByLabel('Password:').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Check for error message indicating invalid credentials
    const errorMessage = page.getByText('Invalid username or password.');
    const errorVisible = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    if (errorVisible) {
      console.log(`Login failed for user ${username}: Invalid username or password.`);
      return false; // Login failed
    }

    // If no error message, proceed to check for successful login
    console.log(`No error message for user ${username}. Checking further...`);

    // Wait for the 'Start' button to be visible
    const startButton = page.getByRole('button', { name: 'Start' });
    try {
      await startButton.waitFor({ state: 'visible', timeout: 3000 });
      await startButton.click();
      console.log(`Start button clicked for user ${username}.`);
    } catch (error) {
      console.log(`Start button not visible for user ${username}.`);
      // Optionally handle this case if needed
    }

    // Wait for up to 3 minutes for 'Nbgrader' to be visible
    const startTime = Date.now();
    const timeout = 3 * 60 * 1000; // 3 minutes
    let nbgraderVisible = false;

    while (Date.now() - startTime < timeout) {
      nbgraderVisible = await page.getByText('Nbgrader', { exact: true }).isVisible({ timeout: 3000 }).catch(() => false);
      
      if (nbgraderVisible) {
        console.log(`'Nbgrader' text visible for user ${username}.`);
        
        await page.getByText('Nbgrader', { exact: true }).click();
        await page.locator('#jp-mainmenu-nbgrader').getByText('Assignment List').click();

 try {
          await Promise.race([
            page.locator('div.col-md-12:has(span:has-text("cnn-example5"))')
                .locator('button:has-text("Fetch")')
                .click(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout exceeded for Fetch button')), 5000))
          ]);
          console.log(`'Fetch' button clicked for user ${username}.`);
        } catch (error) {
          console.log(`'Fetch' button not clicked for user ${username}: ${error.message}`);
        }

      	await page.goto(`http://10.11.51.201:8000/user/${username}/lab/tree/course101/cnn-example5/cnn-example5.ipynb`, { waitUntil: 'networkidle' });
      	      await page.waitForTimeout(3000);
        await page.getByText('Run', { exact: true }).click();
        
        // Wait for and click 'Run All Cells' button
        await page.getByRole('menuitem', { name: 'Run All Cells', exact: true }).waitFor({ state: 'visible', timeout: 5000 });
        await page.getByRole('menuitem', { name: 'Run All Cells', exact: true }).click();
        
        // Wait for and click 'Ok' button
        await page.getByRole('button', { name: 'Ok', exact: true }).click();

        await page.getByText('Nbgrader', { exact: true }).click();
        await page.locator('#jp-mainmenu-nbgrader').getByText('Assignment List').click();
        
        //submit assignment click
        await page.locator('div').filter({ hasText: /^cnn-example5course101Submit$/ }).locator('button').click();
        console.log(`'Submit' button clicked for user ${username}.`);
        
        // Log out
        await page.getByText('File', { exact: true }).click();
        await page.getByText('Log Out').nth(3).click();
        
        return true; // Login succeeded
      }

      // Wait 5 seconds before checking again
      await page.waitForTimeout(5000);
    }

    console.log(`'Nbgrader' text not visible for user ${username} within the timeout period.`);
    return false; // 'Nbgrader' text did not appear in time
  } catch (error) {
    console.error(`Login failed for user ${username}: ${error.message}`);
    return false; // Login failed
  }
}

// Function to process a batch of credentials
async function processBatch(credentialsList, browser) {
  let successfulLoginCount = 0;
  const failedUsers = [];
  // Create an array of promises for the login tests in this batch
  const loginPromises = credentialsList.map(async ({ username, password }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log(`Attempting login for user ${username} in new context`);
      const loginSuccessful = await attemptLogin(page, username, password);

      if (loginSuccessful) {
        console.log(`Login succeeded for user ${username}`);
        successfulLoginCount++;
      } else {
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

  // Write failed users to a CSV file
  if (failedUsers.length > 0) {
    const csv = parse(failedUsers.map(username => ({ username })));
    fs.appendFileSync('failed_users.csv', csv, 'utf8');
    console.log(`Failed users written to failed_users.csv`);
  }
  
  return successfulLoginCount;
}

// hit grader url after processing a batch
async function hitAdditionalUrl() {
console.log('started calling post grader')
const FormData = require('form-data');
let data = new FormData();
data.append('course_name', 'course101');
data.append('assignment_name', 'cnn-example5');

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'http://10.11.51.201:5000/autograde',
  headers: { 
    ...data.getHeaders()
  },
  data : data
};

axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
console.log('completed calling post grader api')
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
  const credentialsList = await getCredentials('First50users.csv');
  const batches = chunkArray(credentialsList, 20); // Split into batches of 20
  let totalSuccessfulLoginCount = 0;
 
  for (const batch of batches) {
    console.log(`Processing batch of ${batch.length} users...`);
    const successfulLoginCount = await processBatch(batch, browser);
    totalSuccessfulLoginCount += successfulLoginCount;
    console.log(`Batch processed. Successful logins in this batch: ${successfulLoginCount}`);
    // Hit additional URL with a separate browser instance after processing each batch
 	 await hitAdditionalUrl();
  }

  console.log(`Total successful logins: ${totalSuccessfulLoginCount}`);
  console.timeEnd('Total Execution Time'); // End the timer and log the duration
});
