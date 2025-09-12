/**
 * Date calculation utilities for determining workday intervals
 * Calculates the number of working days between two dates
 */
'use strict';

const { createLogger } = require('./logger');
const log = createLogger('date');

// Load environment variables
require('dotenv').config({ path: '../.env' });

/**
 * Calculate working days between two dates (excluding weekends)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Number of working days
 */
function calculateWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return count;
}

/**
 * Get the N value based on working days since base date from environment
 * @returns {number} The calculated N value
 */
function getNValue() {
    // Get base date from environment variable
    const baseDateStr = process.env.BASE_DATE || '2025-09-10';
    const [year, month, day] = baseDateStr.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day); // month is 0-indexed
    const currentDate = new Date();
    
    const workingDays = calculateWorkingDays(baseDate, currentDate);
    
    log.debug('Base date:', baseDate.toDateString());
    log.debug('Current date:', currentDate.toDateString());
    log.debug('Working days interval:', workingDays);
    
    // Return at least 1 to avoid index issues
    return Math.max(1, workingDays);
}

module.exports = {
    calculateWorkingDays,
    getNValue
};
