/**
 * Date calculation utilities for determining workday intervals
 * Calculates the number of working days between two dates
 */
'use strict';

const { createLogger } = require('./logger');
const log = createLogger('date');

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
 * Get the N value based on working days since 2025-09-10
 * @returns {number} The calculated N value
 */
function getNValue() {
    // Base date comment was mismatched; ensure correct date (2025-09-10)
    const baseDate = new Date(2025, 8, 10); // month is 0-indexed
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
