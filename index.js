/**
 * Main automation script for PDF download
 * Automates login, navigation, filtering, and PDF downloads
 */

require('dotenv').config({ path: './.env' });
const { chromium } = require('playwright');
const { performLogin } = require('./utils/loginHandler');
const { navigateToFilteredPage, getFilterCombinations, clickNthItem } = require('./utils/navigationHandler');
const { downloadPDF } = require('./utils/downloadHandler');
const { getNValue } = require('./utils/dateCalculator');
const { createLogger } = require('./utils/logger');

const log = createLogger('main');

/**
 * Main automation function
 */
async function main() {
    let browser = null;
    let context = null;
    let page = null;
    
    try {
        log.info('=== Start task: auto download PDFs ===');
        
        // Validate environment variables
        const username = process.env.USERNAME1;
        const password = process.env.PASSWORD;
        const loginUrl = process.env.LOGIN_URL;
        const downloadDir = process.env.DOWNLOAD_DIR || './downloads';
        
        if (!username || !password || !loginUrl) {
            throw new Error('Missing env: USERNAME, PASSWORD, LOGIN_URL');
        }
        
        if (username === 'your_email@example.com') {
            log.warn('Please set real USERNAME/PASSWORD in env');
            return;
        }
        
        // Calculate N value based on working days
        const nValue = getNValue();
        log.info('Resolved N value (working-day index):', nValue);
        
        // Launch browser
        log.info('Launching browser...');
        browser = await chromium.launch({ 
            headless: true, // Set to true for headless mode
            slowMo: 10 // Add delay between actions for debugging
        });
        
        context = await browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1280, height: 720 }
        });
        
        page = await context.newPage();
        
        // Navigate to login page
        log.info('Goto login page:', loginUrl);
        await page.goto(loginUrl, { waitUntil: 'networkidle' });
        
        // Perform login (will auto-redirect to main page)
        const loginSuccess = await performLogin(page, username, password);
        if (!loginSuccess) {
            throw new Error('Login failed');
        }
        
        // Get base URL for navigation
        const baseUrl = new URL(loginUrl).origin;
        
        // Get all filter combinations
        const combinations = getFilterCombinations();
        log.info('Total filter combinations:', combinations.length);
        
        let downloadCount = 0;
        let successCount = 0;
        let skipCount = 0;
        
        // Process each combination
        for (let i = 0; i < combinations.length; i++) {
            const { grade, subject } = combinations[i];
            
            log.info(`=== Process combination ${i + 1}/${combinations.length}: ${grade} - ${subject} ===`);
            
            try {
                // Navigate to filtered page using URL parameters
                const navSuccess = await navigateToFilteredPage(page, baseUrl, grade, subject);
                if (!navSuccess) {
                    log.warn(`Skip ${grade}-${subject}: navigation failed`);
                    skipCount++;
                    continue;
                }
                
                // Click on Nth item
                const clickSuccess = await clickNthItem(page, nValue);
                if (!clickSuccess) {
                    log.warn(`Skip ${grade}-${subject}: cannot click #${nValue}`);
                    skipCount++;
                    continue;
                }
                
                // Download PDF
                const downloadSuccess = await downloadPDF(page, grade, subject, downloadDir);
                if (downloadSuccess) {
                    downloadCount++;
                    successCount++;
                }
                
            } catch (error) {
                log.error(`Error processing ${grade}-${subject}:`, error?.message || error);
                skipCount++;
                
                // Try to go back to main page
                try {
                    await page.goto(baseUrl, { waitUntil: 'networkidle' });
                } catch (navError) {
                    log.error('Failed to return to home:', navError?.message || navError);
                }
            }
        }
        
        log.info('=== Task done ===');
        log.info('Downloaded PDFs:', downloadCount);
        log.info('Successful combos:', successCount);
        log.info('Skipped combos:', skipCount);
        log.info('Total combos:', combinations.length);
        
    } catch (error) {
        log.error('Main execution error:', error?.message || error);
    } finally {
        // Clean up
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();

        log.info('Browser closed');
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the main function
if (require.main === module) {
    main().catch(err => log.error('Main promise rejected:', err));
}

module.exports = main;
