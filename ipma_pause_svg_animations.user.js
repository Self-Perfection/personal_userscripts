// ==UserScript==
// @name         IPMA Pause SVG Animations
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Pause animated SVG images on IPMA website to reduce CPU usage
// @author       You
// @icon         https://www.ipma.pt/opencms/bin/icons/favicon.ico
// @match        https://www.ipma.pt/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/ipma_pause_svg_animations.user.js
// @changelog    1.0 - Initial version: pause *anim.svg animations after 0.5s
// ==/UserScript==

(() => {
    'use strict';

    console.log('[IPMA] SVG Animation Pauser started');

    // Check if URL ends with anim.svg (before query params)
    const isAnimSvgUrl = (u) => {
        if (!u) return false;
        try {
            const url = new URL(u, document.baseURI);
            const pathname = url.pathname.toLowerCase();
            return pathname.endsWith('anim.svg');
        } catch {
            const path = (u.split('?')[0] || '').toLowerCase();
            return path.endsWith('anim.svg');
        }
    };

    const processImages = () => {
        const imgs = [...document.querySelectorAll('img[src]')].filter(img =>
            isAnimSvgUrl(img.getAttribute('src'))
        );

        console.log(`[IPMA] Found ${imgs.length} <img> with *anim.svg src`);

        imgs.forEach((img) => {
            // Skip if already processed
            if (img.dataset.ipmaProcessed) return;
            img.dataset.ipmaProcessed = 'true';

            const src = img.currentSrc || img.getAttribute('src');
            const obj = document.createElement('object');
            obj.setAttribute('type', 'image/svg+xml');
            obj.setAttribute('data', src);

            // Preserve sizing/layout
            obj.className = img.className;
            obj.id = img.id || '';
            obj.title = img.title || '';
            if (img.getAttribute('width')) obj.setAttribute('width', img.getAttribute('width'));
            if (img.getAttribute('height')) obj.setAttribute('height', img.getAttribute('height'));
            obj.style.cssText = img.style.cssText || '';
            if (!obj.style.width && img.width) obj.style.width = img.width + 'px';
            if (!obj.style.height && img.height) obj.style.height = img.height + 'px';

            const computedDisplay = getComputedStyle(img).display;
            obj.style.display = computedDisplay === 'inline' ? 'inline-block' : computedDisplay;

            obj.addEventListener('load', () => {
                const doc = obj.contentDocument;
                const svg = doc && doc.documentElement && doc.documentElement.tagName.toLowerCase() === 'svg'
                    ? doc.documentElement
                    : doc && doc.querySelector && doc.querySelector('svg');

                if (svg && typeof svg.pauseAnimations === 'function') {
                    // Pause after 0.5 seconds to let animation start
                    setTimeout(() => {
                        svg.pauseAnimations();
                        console.log(`[IPMA] Paused animation for: ${src}`);
                    }, 500);
                } else {
                    console.warn('[IPMA] Could not pause (no svg or pauseAnimations):', src);
                }
            });

            img.replaceWith(obj);
        });
    };

    // Process images on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processImages);
    } else {
        processImages();
    }

    // Watch for dynamically added images
    const observer = new MutationObserver((mutations) => {
        let hasNewImages = false;
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    if (node.tagName === 'IMG' && isAnimSvgUrl(node.getAttribute('src'))) {
                        hasNewImages = true;
                    } else if (node.querySelectorAll) {
                        const imgs = node.querySelectorAll('img[src]');
                        if ([...imgs].some(img => isAnimSvgUrl(img.getAttribute('src')))) {
                            hasNewImages = true;
                        }
                    }
                }
            });
        });

        if (hasNewImages) {
            processImages();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[IPMA] Watching for dynamic content...');
})();
