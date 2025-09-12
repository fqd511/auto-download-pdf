/**
 * Download handler for PDF files
 * Manages PDF download and file renaming operations
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { createLogger } = require('./logger');
const log = createLogger('download');

/**
 * Download PDF from detail page and rename it
 * @param {Object} page - Playwright page object
 * @param {string} grade - Current grade filter
 * @param {string} subject - Current subject filter
 * @param {string} downloadDir - Download directory path
 * @returns {Promise<boolean>} Success status
 */
async function downloadPDF(page, grade, subject, downloadDir) {
    try {
        log.info('Start download PDF');
        
        // Wait for download form to be visible
        const downloadForm = page.locator('form#dlform');
        await downloadForm.waitFor({ state: 'visible' });
        
        // Generate filename and create date-based subdirectory
        const currentDate = new Date();
        const dateString = currentDate.toISOString().split('T')[0];
        // Append id from current page URL at the end of file name
        const urlObj = new URL(page.url());
        const idParam = urlObj.searchParams.get('id');
        const idSuffix = idParam ? `-${idParam}` : '';
        const filename = `${grade}-${subject}-${dateString}${idSuffix}.pdf`;
        
        // Create date-based subdirectory within download directory
        const dateDir = path.join(downloadDir, dateString);
        await ensureDirectoryExists(dateDir);
        const filePath = path.join(dateDir, filename);
        
        // Preferred Path: Directly replicate the POST request that returns the PDF
        try {
            const ok = await downloadPDFViaDirectPost(page, filePath);
            if (ok) {
                log.info('Saved via direct POST:', filename);
                return true;
            }
        } catch (e) {
            log.warn('Direct POST failed, try other methods:', e?.message || e);
        }
        
        // Method 1: Try to catch actual download event
        try {
            log.debug('Method 1: listen for download event');
            
            const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
            const downloadButton = page.locator('button:has-text("下載 PDF 檔")');
            await downloadButton.click();
            
            const download = await downloadPromise;
            await download.saveAs(filePath);
            
            log.info('Saved via download event:', filename);
            return true;
            
        } catch (downloadEventError) {
            log.debug('Method 1 failed, try Method 2 (PDF preview)');
            
            // Method 2: Handle PDF preview page
            try {
                const downloadButton = page.locator('button:has-text("下載 PDF 檔")');
                
                // Click download button - this opens PDF preview in browser
                await downloadButton.click();
                log.debug('Clicked site download button, waiting preview');
                
                // Wait for page content to change (PDF preview loads)
                await page.waitForLoadState('networkidle');
                
                // Check if page content indicates PDF preview
                const pageContent = await page.content();
                if (pageContent.includes('application/pdf') || pageContent.includes('embed')) {
                    log.debug('PDF preview detected');
                    
                    // Set up download listener
                    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
                    
                    // Try multiple methods to trigger download
                    let downloadTriggered = false;
                    
                    // Method 2a: Look for browser download button in PDF viewer
                    const browserDownloadSelectors = [
                        '[aria-label*="下载"], [aria-label*="Download"], [aria-label*="下載"]',
                        'button[title*="下载"], button[title*="Download"], button[title*="下載"]',
                        '[data-tooltip*="下载"], [data-tooltip*="Download"]',
                        'button[class*="download"]',
                        '#download, .download',
                        'a[download]'
                    ];
                    
                    for (const selector of browserDownloadSelectors) {
                        try {
                            const downloadBtn = page.locator(selector);
                            const count = await downloadBtn.count();
                            if (count > 0) {
                                log.debug('Found viewer download button:', selector);
                                await downloadBtn.first().click();
                                downloadTriggered = true;
                                break;
                            }
                        } catch (err) {
                            // Continue trying
                        }
                    }
                    
                    // Method 2b: Try keyboard shortcuts
                    if (!downloadTriggered) {
                        log.debug('Try hotkey to download');
                        try {
                            // Try Ctrl+S (Windows/Linux) or Cmd+S (Mac)
                            const isMac = process.platform === 'darwin';
                            await page.keyboard.press(isMac ? 'Meta+S' : 'Control+S');
                            downloadTriggered = true;
                        } catch (keyError) {
                            log.debug('Hotkey failed');
                        }
                    }
                    
                    if (downloadTriggered) {
                        try {
                            const download = await downloadPromise;
                            await download.saveAs(filePath);
                            log.info('Saved via browser viewer:', filename);
                            return true;
                        } catch (downloadWaitError) {
                            log.debug('Download event wait failed, try direct URL');
                        }
                    }
                }
                
                // Method 2c: If all else fails, try to extract PDF URL and download directly
                log.debug('Try extract PDF URL for direct download');
                return await extractAndDownloadPDF(page, grade, subject, downloadDir);
                
            } catch (previewError) {
                log.debug('Method 2 failed, try Method 3 (HTTP request)');
                return await downloadPDFAlternative(page, grade, subject, downloadDir);
            }
        }
        
    } catch (error) {
        log.error('Download PDF failed:', error?.message || error);
        return false;
    }
}

/**
 * Try to replicate the exact POST that returns the PDF bytes and save directly
 * @param {import('playwright').Page} page
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function downloadPDFViaDirectPost(page, filePath) {
    // Read hidden inputs from the form to replicate exact payload
    const formData = await page.evaluate(() => {
        const form = document.querySelector('form#dlform');
        if (!form) return null;
        const data = {};
        form.querySelectorAll('input').forEach(input => {
            if (input.name) {
                data[input.name] = input.value ?? '';
            }
        });
        return data;
    });

    if (!formData || !formData.id || !formData.token) {
        log.debug('Direct POST missing required form fields (id/token)');
        return false;
    }

    const baseOrigin = new URL(page.url()).origin;
    const downloadUrl = `${baseOrigin}/paper/download.php`;

    // Use Playwright APIRequestContext bound to the same browser context
    const api = page.context().request;

    // Send as application/x-www-form-urlencoded via "form" option
    const response = await api.post(downloadUrl, {
        form: formData,
        headers: {
            Referer: page.url(),
            Accept: 'application/pdf, */*'
        }
    });

    if (!response.ok()) {
        log.debug(`Direct POST HTTP ${response.status()} ${response.statusText()}`);
        return false;
    }

    const headers = response.headers();
    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    const buffer = await response.body();

    // Validate content is real PDF
    const head = buffer.slice(0, 4).toString('utf8');
    if (!contentType.includes('application/pdf') && head !== '%PDF') {
        log.debug('Direct POST did not return PDF');
        return false;
    }

    await fs.writeFile(filePath, buffer);
    return true;
}

/**
 * Alternative PDF download method using direct HTTP request
 * @param {Object} page - Playwright page object
 * @param {string} grade - Current grade filter
 * @param {string} subject - Current subject filter
 * @param {string} downloadDir - Download directory path
 * @returns {Promise<boolean>} Success status
 */
async function downloadPDFAlternative(page, grade, subject, downloadDir) {
    try {
        log.debug('Method 3: HTTP request to download');
        
        // Get form data and cookies for authenticated download
        const [formData, cookies] = await Promise.all([
            page.evaluate(() => {
                const form = document.querySelector('form#dlform');
                if (!form) return null;
                
                const data = {};
                const inputs = form.querySelectorAll('input[type="hidden"]');
                inputs.forEach(input => {
                    data[input.name] = input.value;
                });
                return data;
            }),
            page.context().cookies()
        ]);
        
        if (!formData) {
            throw new Error('No download form data');
        }
        
        log.debug('Form data fetched, building HTTP request');
        
        // Prepare cookies for axios
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        // Get base URL and construct download URL
        const baseUrl = new URL(page.url()).origin;
        const downloadUrl = `${baseUrl}/paper/download.php`;
        
        // Use axios to download PDF with proper headers
        const userAgent = await page.evaluate(() => navigator.userAgent);
        const referer = page.url();

        // Ensure body is x-www-form-urlencoded
        const urlBody = new URLSearchParams();
        Object.entries(formData).forEach(([k, v]) => urlBody.append(k, v));

        const response = await axios.post(downloadUrl, urlBody.toString(), {
            headers: {
                'Cookie': cookieString,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': userAgent,
                'Referer': referer,
                'Accept': 'application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            responseType: 'arraybuffer',
            timeout: 30000,
            maxRedirects: 5
        });
        
        // Verify response is PDF
        const buffer = Buffer.from(response.data);
        if (buffer.length === 0 || buffer.toString('utf8', 0, 4) !== '%PDF') {
            throw new Error('Response is not valid PDF');
        }
        
        // Generate filename and create date-based subdirectory
        const currentDate = new Date();
        const dateString = currentDate.toISOString().split('T')[0];
        // Append id from current page URL at the end of file name
        const urlObj = new URL(page.url());
        const idParam = urlObj.searchParams.get('id');
        const idSuffix = idParam ? `-${idParam}` : '';
        const filename = `${grade}-${subject}-${dateString}${idSuffix}.pdf`;
        
        // Create date-based subdirectory within download directory
        const dateDir = path.join(downloadDir, dateString);
        await ensureDirectoryExists(dateDir);
        const filePath = path.join(dateDir, filename);
        
        // Save the PDF file
        await fs.writeFile(filePath, buffer);
        
        log.info('Saved via HTTP request:', filename);
        return true;
        
    } catch (error) {
        log.error('HTTP request download failed:', error?.message || error);
        return false;
    }
}

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path
 */
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
        log.debug('Created download directory:', dirPath);
    }
}


/**
 * Extract PDF URL from preview page and download directly
 * @param {Object} page - Playwright page object
 * @param {string} grade - Current grade filter
 * @param {string} subject - Current subject filter
 * @param {string} downloadDir - Download directory path
 * @returns {Promise<boolean>} Success status
 */
async function extractAndDownloadPDF(page, grade, subject, downloadDir) {
    try {
        log.debug('Extract PDF URL for direct download');
        
        // Look for PDF URL in page content
        const pdfInfo = await page.evaluate(() => {
            // Check for embed tags with PDF
            const embeds = document.querySelectorAll('embed[type="application/pdf"]');
            if (embeds.length > 0) {
                return { url: embeds[0].src, method: 'embed' };
            }
            
            // Check for iframe with PDF
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                if (iframe.src && iframe.src.includes('.pdf')) {
                    return { url: iframe.src, method: 'iframe' };
                }
            }
            
            // Check for object tags
            const objects = document.querySelectorAll('object[type="application/pdf"]');
            if (objects.length > 0) {
                return { url: objects[0].data, method: 'object' };
            }
            
            // Check for any links to PDF files
            const pdfLinks = document.querySelectorAll('a[href*=".pdf"]');
            if (pdfLinks.length > 0) {
                return { url: pdfLinks[0].href, method: 'link' };
            }
            
            return null;
        });
        
        if (pdfInfo && pdfInfo.url) {
            log.debug('Found PDF URL:', pdfInfo.method, pdfInfo.url);
            
            // Download PDF using the extracted URL
            const cookies = await page.context().cookies();
            const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            
            const response = await axios.get(pdfInfo.url, {
                headers: {
                    'Cookie': cookieString,
                    'User-Agent': await page.evaluate(() => navigator.userAgent),
                    'Referer': page.url()
                },
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            // Generate filename and create date-based subdirectory
            const currentDate = new Date();
            const dateString = currentDate.toISOString().split('T')[0];
            // Append id from current page URL at the end of file name
            const urlObj = new URL(page.url());
            const idParam = urlObj.searchParams.get('id');
            const idSuffix = idParam ? `-${idParam}` : '';
            const filename = `${grade}-${subject}-${dateString}${idSuffix}.pdf`;
            
            // Create date-based subdirectory within download directory
            const dateDir = path.join(downloadDir, dateString);
            await ensureDirectoryExists(dateDir);
            const filePath = path.join(dateDir, filename);
            
            const buffer = Buffer.from(response.data);
            await fs.writeFile(filePath, buffer);
            
            log.info('Saved via URL extraction:', filename);
            return true;
            
        } else {
            log.debug('No PDF URL found');
            return false;
        }
        
    } catch (error) {
        log.error('Extract-and-download failed:', error?.message || error);
        return false;
    }
}

module.exports = {
    downloadPDF
};
