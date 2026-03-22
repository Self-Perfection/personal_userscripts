// ==UserScript==
// @name         Kagi Summarizer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Open current page summary in Kagi Summarizer
// @changelog    1.1 - Несколько пунктов меню для разных длин summary (overview, digest, medium), исправлена работа на мобильных
// @author       You
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/kagi_summarizer.user.js
// ==/UserScript==

(function() {
    'use strict';

    const lengths = [
        { length: 'overview', label: 'Overview (short)' },
        { length: 'digest', label: 'Digest (medium)' },
        { length: 'medium', label: 'Medium (long)' },
    ];

    for (const { length, label } of lengths) {
        GM_registerMenuCommand(`Kagi: ${label}`, () => {
            const url = new URL('https://kagi.com/summarizer');
            url.searchParams.set('target_language', '');
            url.searchParams.set('summary', 'summary');
            url.searchParams.set('length', length);
            url.searchParams.set('url', location.href);
            GM_openInTab(url.href, { active: true });
        });
    }
})();
