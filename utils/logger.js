/**
 * Simple logger utility with levels and optional scope
 * Provides consistent, timestamped logging across the project
 */

'use strict';

const LEVELS = [
    { name: 'silent', rank: 0 },
    { name: 'error', rank: 1 },
    { name: 'warn', rank: 2 },
    { name: 'info', rank: 3 },
    { name: 'debug', rank: 4 }
];

/**
 * Parse log level from env, default to "info"
 * DEBUG=true implies level "debug"
 */
function getEnvLevel() {
    const debugFlag = String(process.env.DEBUG || '').toLowerCase();
    if (debugFlag === 'true' || debugFlag === '1') return 'debug';
    const level = String(process.env.LOG_LEVEL || 'info').toLowerCase();
    const exists = LEVELS.some(l => l.name === level);
    return exists ? level : 'info';
}

/**
 * Format current time as HH:MM:SS
 */
function time() {
    const d = new Date();
    return [
        String(d.getHours()).padStart(2, '0'),
        String(d.getMinutes()).padStart(2, '0'),
        String(d.getSeconds()).padStart(2, '0')
    ].join(':');
}

/**
 * Create a logger with optional scope/tag
 */
function createLogger(scope) {
    const envLevel = getEnvLevel();
    const threshold = LEVELS.find(l => l.name === envLevel)?.rank ?? 3;

    function shouldLog(levelName) {
        const rank = LEVELS.find(l => l.name === levelName)?.rank ?? 3;
        return rank <= threshold;
    }

    function prefix(levelName) {
        const head = `[${time()}] [${levelName.toUpperCase()}]`;
        return scope ? `${head} [${scope}]` : head;
    }

    return {
        info: (...args) => {
            if (!shouldLog('info')) return;
            console.log(prefix('info'), ...args);
        },
        warn: (...args) => {
            if (!shouldLog('warn')) return;
            console.warn(prefix('warn'), ...args);
        },
        error: (...args) => {
            if (!shouldLog('error')) return;
            console.error(prefix('error'), ...args);
        },
        debug: (...args) => {
            if (!shouldLog('debug')) return;
            console.log(prefix('debug'), ...args);
        }
    };
}

const logger = createLogger();

module.exports = {
    createLogger,
    logger
};


