import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

// Function to read CSV file and return an array of user objects
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const users = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        users.push(row);
      })
      .on('end', () => {
        resolve(users);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

test('test', async ({ page }) => {
  // Read the CSV file
  const csvFilePath = path.join(__dirname, 'First50users.csv'); // Adjust path to your CSV file
  const users = await readCSV(csvFilePath);

  // Step 1: Log in once
  await page.goto('http://10.11.51.201:8000/hub/login?next=%2Fhub%2F');
  await page.getByLabel('Username:').click();
  await page.getByLabel('Username:').fill('kmit');
  await page.getByLabel('Password:').click();
  await page.getByLabel('Password:').fill('kmit');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Navigate to the control panel
  await page.getByText('File', { exact: true }).click();
  const page1Promise = page.waitForEvent('popup');
  await page.locator('#jp-mainmenu-file').getByText('Hub Control Panel').click();
  const page1 = await page1Promise;
  await page1.getByRole('link', { name: 'Admin' }).click();
  await page1.getByRole('button', { name: 'Manage Groups' }).click();
  await page1.getByRole('link', { name: 'nbgrader-course101' }).click();

  // Step 2: Process each user
  for (const user of users) {
    try {
      await page1.getByTestId('username-input').click();
      await page1.getByTestId('username-input').fill(user.username); // Use username from CSV
      await page1.getByTestId('validate-user').click();
      await page1.getByTestId('submit').click();

      // Add checks or logging as needed here to validate the operation
      console.log(`Processed user: ${user.username}`);
    } catch (error) {
      console.error(`Error processing user ${user.username}:`, error);
    }
  }
});

