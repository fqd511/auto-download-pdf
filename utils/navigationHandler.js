/**
 * Navigation handler for filtering and selecting content
 * Manages grade and subject combinations
 */
'use strict';

const { createLogger } = require('./logger');
const log = createLogger('nav');

/**
 * Grade options available on the website
 */
const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

/**
 * Subject options and their URL parameter mappings
 */
const SUBJECTS = {
    '中': 'Chinese',
    '英': 'English', 
    '數': 'Maths',
    '常': 'GS'
};

/**
 * Navigate to filtered page using URL parameters
 * @param {Object} page - Playwright page object
 * @param {string} baseUrl - Base URL of the website
 * @param {string} grade - Grade to filter (P1-P6)
 * @param {string} subjectChinese - Subject in Chinese
 * @returns {Promise<boolean>} Success status
 */
async function navigateToFilteredPage(page, baseUrl, grade, subjectChinese) {
    try {
        const subjectEnglish = SUBJECTS[subjectChinese];
        if (!subjectEnglish) {
            log.error('Unknown subject:', subjectChinese);
            return false;
        }
        
        log.info('Navigate to filter page:', `${grade} - ${subjectChinese} (${subjectEnglish})`);
        
        // Construct URL with parameters
        const filterUrl = `${baseUrl}/?grade=${grade}&subject=${subjectEnglish}`;
        log.debug('Goto URL:', filterUrl);
        
        // Navigate to filtered page
        await page.goto(filterUrl, { waitUntil: 'networkidle' });
        
        // Wait for content to load
        await page.waitForLoadState('domcontentloaded');
        
        log.info('Arrived at filter page:', `${grade} - ${subjectChinese}`);
        return true;
    } catch (error) {
        log.error('Navigate to filter page failed:', error?.message || error);
        return false;
    }
}

/**
 * Get all filter combinations (grade + subject)
 * @returns {Array} Array of filter combinations
 */
function getFilterCombinations() {
    const combinations = [];
    
    for (const grade of GRADES) {
        for (const subjectChinese of Object.keys(SUBJECTS)) {
            combinations.push({ grade, subject: subjectChinese });
        }
    }
    
    return combinations;
}

/**
 * Click on the Nth item in the current list
 * @param {Object} page - Playwright page object
 * @param {number} n - Item number to click (1-based)
 * @returns {Promise<boolean>} Success status
 */
async function clickNthItem(page, n) {
    try {
        log.info('Click item index:', n);
        
        // Wait for items to load
        const sheetsContainer = page.locator('.sheet');
        await sheetsContainer.first().waitFor({ state: 'visible' });
        
        // Get all sheet items
        const itemCount = await sheetsContainer.count();
        
        if (itemCount === 0) {
            log.warn('No items found');
            return false;
        }
        
        if (n > itemCount) {
            log.warn(`Index ${n} out of range, items: ${itemCount}`);
            return false;
        }
        
        // Click on the nth item (convert to 0-based index)
        const targetItem = sheetsContainer.nth(n - 1);
        const linkElement = targetItem.locator('a').first();
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            linkElement.click()
        ]);
        
        log.info('Clicked item index:', n);
        return true;
        
    } catch (error) {
        log.error('Click item failed:', error?.message || error);
        return false;
    }
}

module.exports = {
    navigateToFilteredPage,
    getFilterCombinations,
    clickNthItem
};
