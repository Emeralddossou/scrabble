// js/DOMCache.js - DOM element caching for performance

class DOMCache {
    constructor() {
        /** @private @type {Map<string, HTMLElement>} */
        this.cache = new Map();

        /** @private @type {Map<string, NodeList>} */
        this.listCache = new Map();

        /** Performance metrics */
        this.metrics = {
            hits: 0,
            misses: 0,
            clears: 0
        };
    }

    /**
     * Get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    getById(id) {
        if (this.cache.has(id)) {
            this.metrics.hits++;
            return this.cache.get(id);
        }

        const element = document.getElementById(id);
        if (element) {
            this.cache.set(id, element);
            this.metrics.misses++;
        }

        return element;
    }

    /**
     * Get element by selector
     * @param {string} selector - CSS selector
     * @param {boolean} [cache=true] - Whether to cache result
     * @returns {HTMLElement|null}
     */
    querySelector(selector, cache = true) {
        const key = `query:${selector}`;

        if (cache && this.cache.has(key)) {
            this.metrics.hits++;
            return this.cache.get(key);
        }

        const element = document.querySelector(selector);
        if (element && cache) {
            this.cache.set(key, element);
            this.metrics.misses++;
        }

        return element;
    }

    /**
     * Get all elements by selector
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    querySelectorAll(selector) {
        const key = `queryAll:${selector}`;

        if (this.listCache.has(key)) {
            this.metrics.hits++;
            return this.listCache.get(key);
        }

        const elements = document.querySelectorAll(selector);
        this.listCache.set(key, elements);
        this.metrics.misses++;

        return elements;
    }

    /**
     * Cache multiple elements at once
     * @param {Array<string>} ids - Array of element IDs
     * @returns {Object<string, HTMLElement>}
     */
    cacheMultiple(ids) {
        const result = {};

        ids.forEach(id => {
            result[id] = this.getById(id);
        });

        return result;
    }

    /**
     * Check if element is cached
     * @param {string} id - Element ID
     * @returns {boolean}
     */
    has(id) {
        return this.cache.has(id);
    }

    /**
     * Clear cache for specific ID
     * @param {string} id - Element ID
     */
    clear(id = null) {
        if (id) {
            this.cache.delete(id);
            this.listCache.forEach((value, key) => {
                if (key.includes(id)) {
                    this.listCache.delete(key);
                }
            });
        } else {
            this.cache.clear();
            this.listCache.clear();
            this.metrics.clears++;
        }
    }

    /**
     * Get performance metrics
     * @returns {Object}
     */
    getMetrics() {
        return {
            ...this.metrics,
            total: this.metrics.hits + this.metrics.misses,
            hitRate: this.metrics.total > 0 ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * Clear metrics
     */
    resetMetrics() {
        this.metrics = { hits: 0, misses: 0, clears: 0 };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMCache;
}

// Global export for script tags
if (typeof window !== 'undefined') {
    window.DOMCache = DOMCache;
}
