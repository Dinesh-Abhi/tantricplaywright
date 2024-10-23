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
function writeLoginResult(username, ip, result) {
    const csvRow = parse([{ username, ip, result }], { header: false });
    fs.appendFileSync('assign5results.csv', `${csvRow}\n`, 'utf8');
}

// Function to attempt login and handle errors
async function attemptLogin(page, ip, username, password) {
    try {
        await page.goto('http://10.11.51.225/');
        await page.getByPlaceholder('Enter username').click();
        await page.getByPlaceholder('Enter username').fill(username);
        await page.getByRole('button', { name: 'Connect to My Tantrik Instance' }).click();
        const erroruser = await page.getByText('You are not assigned to any Tantrik instance. Please reach out to the administrator for assistance.').isVisible({ timeout: 2000 }).catch(() => false);
        if (erroruser) {
            console.log(`Login failed for user ${username}: Invalid username or user not added main all users.`);
            writeLoginResult(username, ip, 'fail');
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
            writeLoginResult(username, ip, 'fail');
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

                const course = 'course-101';
                const coursecheck = courseLinks.find(course => course.includes('course101'));
                console.log("coursecheck->",coursecheck)
                if (coursecheck) {
                    console.log(`Course ${course} found for user ${username}, clicking on it.`);
                    await page.getByRole('link', { name: 'course101' }).click();
                    //   await page.getByRole('button', { name: 'Fetch', exact: true })
                    //   await page.getByRole('button', { name: 'Fetch', exact: true }).click();   
                    await expect(page.locator('span').filter({ hasText: 'Fetch' }).first()).toBeVisible();
                    const courseassignmentname = 'demo_assign5'

                    const fetchButton = page.locator('div.col-md-12:has(span.item_name:has-text("demo_assign5")) button.btn.btn-primary.btn-xs');          
                    try {
                        const isFetchButtonVisible = await fetchButton.isVisible({ timeout: 3000 });
                        console.log("isFetchButtonVisible:", isFetchButtonVisible);
                        if (isFetchButtonVisible) {
                            await fetchButton.click();
                            console.log(`Clicked on ${courseassignmentname} 'Fetch' button for user ${username}.`);
                        } else {
                            console.log(`'Fetch' button not visible for user ${username}, proceeding to next steps...`);
                        }
                    } catch (error) {
                        console.log(`'Fetch' button not visible for user ${username}, proceeding to next steps...`);
                        // console.error(`Error checking visibility of 'Fetch' button for user ${username}: ${error.message}`);
                    }
                    

                    await page.goto(`http://${ip}:8000/user/${username}/lab/tree/course101/${courseassignmentname}/${courseassignmentname}.ipynb`, { waitUntil: 'networkidle' });
                    console.log(`Navigated to assignment ${courseassignmentname} for user ${username}.`);
                    await page.waitForTimeout(1000);
                    await page.getByText('Run', { exact: true }).click();
                    console.log(`Clicked on Run for assignment ${courseassignmentname} for user ${username}.`);
                    // Wait for and click 'Run All Cells' button
                    await page.getByRole('menuitem', { name: 'Run All Cells', exact: true }).waitFor({ state: 'visible' });
                    await page.getByRole('menuitem', { name: 'Run All Cells', exact: true }).click();
                    console.log(`Clicked on Run all cells for assignment ${courseassignmentname} for user ${username}.`);

                    // Wait for and click 'Ok' button
                    await page.getByRole('button', { name: 'Ok', exact: true }).click();
                    console.log(`Clicked on Ok after completion of assignment ${courseassignmentname} for user ${username}.`);
                    
                    await page.getByText('Assignments', { exact: true }).click();
                    //submit assignment click
                    await page.getByText('demo_assign5course101Submitdemo_assign5').isVisible()
                    console.log(`Course ${course} submit button found for user ${username}.`);

                    await page.locator('div').filter({ hasText: /^demo_assign5course101Submit$/ }).locator('button').click();
                    console.log(`Course ${course} 'Submit' button clicked for user ${username}.`);

                    await page.getByText('File', { exact: true }).click();
                    await page.getByText('Log Out').nth(3).click();
                    console.log(`Successfully logged out for user ${username} after selecting ${course}.`);
                    writeLoginResult(username, ip, 'success');
                    return true;
                } else {
                    console.log(`Course ${course} not found for user ${username}, exiting.`);
                    writeLoginResult(username, ip, 'fail');
                    return false;
                }
            }
        }

        console.log(`'Nbgrader' text not visible for user ${username} within the timeout period.`);
        writeLoginResult(username, ip, 'fail');
        return false;
    } catch (error) {
        console.error(`Login failed for user ${username}: ${error.message}`);
        writeLoginResult(username, ip, 'fail');
        return false;
    }
}

// Function to process a batch of credentials
async function processBatch(credentialsList, browser) {
    const failedUsers = [];

    const loginPromises = credentialsList.map(async ({ ip, username, password }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            console.log(`Attempting login for user ${username} in new context`);
            const loginSuccessful = await attemptLogin(page, ip, username, password);

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
    const credentialsList = await getCredentials('Test.csv');//change the csv here with format ip,username,password
    const batches = chunkArray(credentialsList, 1); // Split into batches of 1

    for (const batch of batches) {
        console.log(`Processing batch of ${batch.length} users...`);
        await processBatch(batch, browser);
    }

    console.timeEnd('Total Execution Time'); // End the timer and log the duration
});
