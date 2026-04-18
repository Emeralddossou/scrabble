// DocumentFragment.js - Batch DOM operations for performance

class DocumentFragment {
    /**
     * Create a batch renderer
     * @param {HTMLElement} container - Container to append to
     */
    constructor(container) {
        this.container = container;
        this.fragment = document.createDocumentFragment();
        this.operations = [];
    }

    /**
     * Add element to batch
     * @param {HTMLElement} element
     * @returns {DocumentFragment}
     */
    add(element) {
        this.operations.push({ type: 'append', element });
        this.fragment.appendChild(element);
        return this;
    }

    /**
     * Remove element from batch
     * @param {HTMLElement} element
     * @returns {DocumentFragment}
     */
    remove(element) {
        this.operations.push({ type: 'remove', element });
        return this;
    }

    /**
     * Add multiple elements at once
     * @param {Array<HTMLElement>} elements
     * @returns {DocumentFragment}
     */
    addMultiple(elements) {
        elements.forEach(el => this.add(el));
        return this;
    }

    /**
     * Clear all content (prepare for repopulating)
     * @returns {DocumentFragment}
     */
    clear() {
        this.operations.push({ type: 'clear' });
        return this;
    }

    /**
     * Apply all batch operations at once
     * This triggers only ONE reflow
     * @returns {HTMLElement} The updated container
     */
    render() {
        const startTime = performance.now ? performance.now() : Date.now();

        // Apply operations to fragment
        this.operations.forEach(op => {
            switch (op.type) {
                case 'append':
                    this.fragment.appendChild(op.element);
                    break;
                case 'clear':
                    // Clear will happen when we replace container content
                    break;
                default:
                    break;
            }
        });

        // Single reflow operation
        if (this.operations.some(op => op.type === 'clear')) {
            this.container.innerHTML = '';
        }

        if (this.fragment.children.length > 0) {
            this.container.appendChild(this.fragment);
        }

        // Reset for next batch
        this.fragment = document.createDocumentFragment();
        this.operations = [];

        const endTime = performance.now ? performance.now() : Date.now();
        return { container: this.container, time: endTime - startTime };
    }

    /**
     * Cancel all pending operations
     */
    cancel() {
        this.operations = [];
        this.fragment = document.createDocumentFragment();
    }

    /**
     * Get number of pending operations
     * @returns {number}
     */
    getPendingCount() {
        return this.operations.length;
    }

    /**
     * Create a fragment for common pattern (like rendering rack)
     * @param {HTMLElement} container
     * @param {function(): Array<HTMLElement>} elementCreator
     * @param {function(): void} [beforeReplace]
     * @returns {Object} { time: number, elementCount: number }
     */
    static renderBatch(container, elementCreator, beforeReplace = null) {
        const fragment = new DocumentFragment(container);

        if (beforeReplace) beforeReplace();

        const elements = elementCreator();
        fragment.addMultiple(elements);

        const startTime = performance.now ? performance.now() : Date.now();
        const result = fragment.render();
        const endTime = performance.now ? performance.now() : Date.now();

        return {
            time: endTime - startTime,
            elementCount: elements.length,
            container: result.container
        };
    }
}

// Quick render helper for common case
DocumentFragment.quickRender = function(container, elements) {
    if (!Array.isArray(elements)) return { time: 0, elementCount: 0 };

    const fragment = document.createDocumentFragment();
    elements.forEach(el => fragment.appendChild(el));

    const startTime = performance.now ? performance.now() : Date.now();
    container.appendChild(fragment);
    const endTime = performance.now ? performance.now() : Date.now();

    return {
        time: endTime - startTime,
        elementCount: elements.length
    };
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentFragment;
}

// Global export for script tags
if (typeof window !== 'undefined') {
    window.DocumentFragment = DocumentFragment;
}
