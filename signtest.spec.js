import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

// Function to read CSV file and return an array of user credentials
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

test('Sign up users from CSV', async ({ page }) => {
  const csvFilePath = path.join(__dirname, 'First50users.csv'); // Adjust path to your CSV file
  const users = await readCSV(csvFilePath);
  
  let successCount = 0;
  let failureCount = 0;

  for (const user of users) {
    try {
      await page.goto('http://10.11.51.201:8000/hub/signup');
      await page.getByLabel('Username:').click();
      await page.getByLabel('Username:').fill(user.username);
      await page.getByLabel('Password:').click();
      await page.getByLabel('Password:').fill(user.password);
      await page.locator('#password_confirmation_input').click();
      await page.locator('#password_confirmation_input').fill(user.password);
      await page.getByRole('button', { name: 'Create User' }).click();
      
      // Check if the success message is visible
      const success = await page.getByText('The signup was successful!').isVisible();
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      console.error(`Error processing user ${user.username}:`, error);
      failureCount++;
    }
  }

  console.log(`Sign-up Summary:`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  
  // Optionally, assert that there were no failures
  expect(failureCount).toBe(0);
});

