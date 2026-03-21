// ==UserScript==
// @name         Kagi Summarizer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Open current page summary in Kagi Summarizer
// @author       You
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/kagi_summarizer.user.js
// ==/UserScript==

(function() {
    'use strict';

    GM_registerMenuCommand('Summarize in Kagi', () => {
        const url = new URL('https://kagi.com/summarizer');
        url.searchParams.set('target_language', '');
        url.searchParams.set('summary', 'summary');
        url.searchParams.set('length', 'digest');
        url.searchParams.set('url', location.href);
        window.open(url.href, '_blank');
    });
})();
