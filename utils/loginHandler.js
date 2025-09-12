/**
 * Login handler for target website
 * Handles authentication and session management
 */

const { createLogger } = require('./logger');
const log = createLogger('login');

/**
 * Perform login to target website
 * @param {Object} page - Playwright page object
 * @param {string} username - User email
 * @param {string} password - User password
 * @returns {Promise<boolean>} Success status
 */
async function performLogin(page, username, password) {
    try {
        log.info('Start login flow');
        
        // Wait for email input and fill it
        await page.waitForSelector('input[type="email"]');
        await page.fill('input[type="email"]', username);
        log.debug('Filled username');
        
        // Fill password
        await page.fill('input[type="password"]', password);
        log.debug('Filled password');
        
        // Click login button and wait for navigation
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('button[name="login"]')
        ]);
        log.debug('Clicked login button');
        
        // Check if we're redirected to main page (login success)
        const currentUrl = page.url();
        log.debug('Current URL:', currentUrl);
        
        // Check for login success by URL change or presence of user account elements
        const loginUrlObj = new URL(page.url());
        const isMainPage = !loginUrlObj.pathname.includes('login');
        
        if (isMainPage) {
            log.info('Login success, redirected to home');
            
            // Wait for page to fully load
            await page.waitForLoadState('networkidle');
            
            // Optional: Try to find user account indicators
            try {
                await page.locator('a:has-text("我的帳戶"), a:has-text("登出")').first().waitFor({ 
                    state: 'visible', 
                    timeout: 3000 
                });
                log.debug('Confirmed login by account UI');
            } catch (e) {
                log.warn('Account UI not found; URL indicates logged-in');
            }
            
            return true;
        } else {
            log.warn('Login failed: still on login page');
            return false;
        }
        
    } catch (error) {
        log.error('Login error:', error?.message || error);
        return false;
    }
}

module.exports = {
    performLogin
};
