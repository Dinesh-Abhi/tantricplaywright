// import { test, expect } from '@playwright/test';
// const fs = require('fs');
// const csv = require('csv-parser');
// const { parse } = require('json2csv'); // Ensure you have installed this package

// // Function to read credentials from a CSV file
// async function getCredentials(filePath) {
//   return new Promise((resolve, reject) => {
//     const results = [];
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on('data', (data) => results.push(data))
//       .on('end', () => {
//         if (results.length > 0) {
//           resolve(results);
//         } else {
//           reject(new Error('No data found in CSV file'));
//         }
//       })
//       .on('error', (error) => reject(error));
//   });
// }

// // Function to attempt login and handle errors
// async function attemptLogin(page, username, password) {
//   try {
//     await page.goto('http://10.11.51.201:8000/hub/login?next=%2Fhub%2F', { waitUntil: 'networkidle' });

//     // Fill in login credentials
//     await page.getByLabel('Username:').fill(username);
//     await page.getByLabel('Password:').fill(password);
//     await page.getByRole('button', { name: 'Sign In' }).click();

//     // Check for error message indicating invalid credentials
//     const errorMessage = page.getByText('Invalid username or password.');
//     const errorVisible = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

//     if (errorVisible) {
//       console.log(`Login failed for user ${username}: Invalid username or password.`);
//       return false; // Login failed
//     }

//     // If no error message, proceed to check for successful login
//     console.log(`No error message for user ${username}. Checking further...`);

//     // Wait for the 'Start' button to be visible
//     const startButton = page.getByRole('button', { name: 'Start' });
//     try {
//       await startButton.waitFor({ state: 'visible', timeout: 3000 });
//       await startButton.click();
//       console.log(`Start button clicked for user ${username}.`);
//     } catch (error) {
//       console.log(`Start button not visible for user ${username}.`);
//       // Optionally handle this case if needed
//     }

//     // Wait for up to 3 minutes for 'Nbgrader' to be visible
//     const startTime = Date.now();
//     const timeout = 3 * 60 * 1000; // 3 minutes
//     let nbgraderVisible = false;

//     while (Date.now() - startTime < timeout) {
//       nbgraderVisible = await page.getByText('Nbgrader', { exact: true }).isVisible({ timeout: 3000 }).catch(() => false);
      
//       if (nbgraderVisible) {
//         console.log(`'Nbgrader' text visible for user ${username}.`);
//         return true; // Login succeeded
//       }

//       // Wait 5 seconds before checking again
//       await page.waitForTimeout(5000);
//     }

//     console.log(`'Nbgrader' text not visible for user ${username} within the timeout period.`);
//     return false; // 'Nbgrader' text did not appear in time
//   } catch (error) {
//     console.error(`Login failed for user ${username}: ${error.message}`);
//     return false; // Login failed
//   }
// }

// // Function to process a batch of credentials
// async function processBatch(credentialsList, browser) {
//   let successfulLoginCount = 0;
//   const failedUsers = [];
//   // Create an array of promises for the login tests in this batch
//   const loginPromises = credentialsList.map(async ({ username, password }) => {
//     const context = await browser.newContext();
//     const page = await context.newPage();

//     try {
//       console.log(`Attempting login for user ${username} in new context`);
//       const loginSuccessful = await attemptLogin(page, username, password);

//       if (loginSuccessful) {
//         console.log(`Login succeeded for user ${username}`);
//         successfulLoginCount++;
//       } else {
//         console.log(`Login failed for user ${username}, trying next user...`);
//         failedUsers.push(username);
//       }
//     } catch (error) {
//       console.error(`Error during login attempt for user ${username}: ${error.message}`);
//       failedUsers.push(username);
//     } finally {
//       await context.close();
//     }
//   });

//   await Promise.all(loginPromises);

//   // Write failed users to a CSV file
//   if (failedUsers.length > 0) {
//     const csv = parse(failedUsers.map(username => ({ username })));
//     fs.appendFileSync('failed_users.csv', csv, 'utf8');
//     console.log(`Failed users written to failed_users.csv`);
//   }
  
//   return successfulLoginCount;
// }

// // Function to split an array into chunks
// function chunkArray(array, chunkSize) {
//   const result = [];
//   for (let i = 0; i < array.length; i += chunkSize) {
//     result.push(array.slice(i, i + chunkSize));
//   }
//   return result;
// }

// test('login tests', async ({ browser }) => {
//   console.time('Total Execution Time'); // Start the timer
//   const credentialsList = await getCredentials('First50users.csv');
//   const batches = chunkArray(credentialsList, 50); // Split into batches of 1
//   let totalSuccessfulLoginCount = 0;

//   for (const batch of batches) {
//     console.log(`Processing batch of ${batch.length} users...`);
//     const successfulLoginCount = await processBatch(batch, browser);
//     totalSuccessfulLoginCount += successfulLoginCount;
//     console.log(`Batch processed. Successful logins in this batch: ${successfulLoginCount}`);
//   }

//   console.log(`Total successful logins: ${totalSuccessfulLoginCount}`);
//   console.timeEnd('Total Execution Time'); // End the timer and log the duration
// });

import { test, expect } from '@playwright/test';
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

// Function to write results to a CSV file
async function writeResults(filePath, data) {
  let existingData = [];
  if (fs.existsSync(filePath)) {
    // Read existing data if file exists
    existingData = await new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => results.push(row))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  // Combine existing data with new data
  const combinedData = [...existingData, ...data];

  // Write combined data to file
  const csvData = parse(combinedData, { header: true });
  fs.writeFileSync(filePath, csvData, 'utf8');
}

// Function to attempt login and handle errors
async function attemptLogin(ip, page, username) {
  try {
    await page.goto('http://10.11.51.225/');
    await page.getByPlaceholder('Enter username').click();
    await page.getByPlaceholder('Enter username').fill(username);
    await page.getByRole('button', { name: 'Connect to My Tantrik Instance' }).click();

    const erroruser = await page.getByText('You are not assigned to any Tantrik instance. Please reach out to the administrator for assistance.').isVisible({ timeout: 2000 }).catch(() => false);

    if (erroruser) {
      console.log(`Login failed for user ${username}: Invalid username or password.`);
      return false; // Login failed
    }
    console.log(`Connected to My Tantrik Instance`);
    //   await page.waitForNavigation({ waitUntil: 'networkidle' });
    // Debug: Check the URL to confirm redirection
    console.log(`Current URL: ${page.url()}`);

    // Wait for the password field to be visible and interactable
    const passwordField = page.getByLabel('Password:');
    await passwordField.waitFor({ state: 'visible', timeout: 1000 });

    // Click and fill the password field with the username
    await passwordField.click();
    await passwordField.fill(username);
    await page.getByRole('button', { name: 'Sign In' }).click();
    const errorMessageSelector = 'text="Invalid username or password."'; // Ensure this selector matches the exact text
    const errorMessageVisible = await page.locator(errorMessageSelector).isVisible({ timeout: 5000 }).catch(() => false);

    console.log("Invalid username or password message visible:", errorMessageVisible);

    if (errorMessageVisible) {
      console.log(`Login failed for user ${username}: Invalid username or password.`);
      return false; // Login failed
    }
    console.log(`No error message for user ${username}. Checking further...`);

    const startButton = page.getByRole('button', { name: 'Start' });
    try {
      await startButton.waitFor({ state: 'visible', timeout: 2000 });
      await startButton.click();
      console.log(`Start button clicked for user ${username}.`);
    } catch (error) {
      console.log(`Start button not visible for user ${username}.`);
    }

    const startTime = Date.now();
    const timeout = 3 * 60 * 1000; // 3 minutes
    let nbgraderVisible = false;

    while (Date.now() - startTime < timeout) {
      nbgraderVisible = await page.getByText('Nbgrader', { exact: true }).isVisible({ timeout: 3000 }).catch(() => false);

      if (nbgraderVisible) {
        console.log(`'Nbgrader' text visible for user ${username}.`);
        await page.getByText('Nbgrader', { exact: true }).click();
        await page.waitForTimeout(1000);
        await page.locator('#jp-mainmenu-nbgrader').getByText('Assignment List').click();
        await expect(page.getByRole('button', { name: 'dl2' })).toBeVisible();
        return true; // Login succeeded
      }

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
async function processBatch(credentialsList, browser, resultFilePath) {
  let successfulLoginCount = 0;
  const updatedCredentials = [];

  const loginPromises = credentialsList.map(async (record) => {
    const { ip, port, username, password } = record;
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log(`Attempting login for user ${username} in new context`);
      const loginSuccessful = await attemptLogin(ip, page, username);

      if (loginSuccessful) {
        console.log(`Login succeeded for user ${username}`);
        successfulLoginCount++;
        updatedCredentials.push({ ...record, result: '1' });
      } else {
        console.log(`Login failed for user ${username}`);
        updatedCredentials.push({ ...record, result: '0' });
      }
    } catch (error) {
      console.error(`Error during login attempt for user ${username}: ${error.message}`);
      updatedCredentials.push({ ...record, result: '0' });
    } finally {
      await context.close();
    }
  });

  await Promise.all(loginPromises);

  // Write updated credentials to the result CSV file
  await writeResults(resultFilePath, updatedCredentials);
  console.log(`Results written to ${resultFilePath}`);

  return successfulLoginCount;
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
  const csvFilePath = 'AllData.csv'; // Path to your CSV file
  const resultCsvFilePath = 'result.csv'; // Path to your result CSV file
  const credentialsList = await getCredentials(csvFilePath);
  const batches = chunkArray(credentialsList, 10); // Split into batches of 1
  let totalSuccessfulLoginCount = 0;

  for (const batch of batches) {
    console.log(`Processing batch of ${batch.length} users...`);
    const successfulLoginCount = await processBatch(batch, browser, resultCsvFilePath);
    totalSuccessfulLoginCount += successfulLoginCount;
    console.log(`Batch processed. Successful logins in this batch: ${successfulLoginCount}`);
  }

  console.log(`Total successful logins: ${totalSuccessfulLoginCount}`);
  console.timeEnd('Total Execution Time'); // End the timer and log the duration
});
