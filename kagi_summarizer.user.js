// ==UserScript==
// @name         Kagi Summarizer
// @namespace    https://github.com/Self-Perfection
// @version      1.5
// @description  Open current page summary in Kagi Summarizer
// @changelog    1.5 - Добавлен @noframes: скрипт больше не запускается в iframe (открывались лишние вкладки)
// @changelog    1.4 - Иконка
// @changelog    1.3 - @namespace заменён с дефолтного tampermonkey.net на профиль автора
// @changelog    1.2 - Добавлен fallback через window.open при неработающем GM_openInTab (Android Firefox)
// @changelog    1.1 - Несколько пунктов меню для разных длин summary (overview, digest, medium), исправлена работа на мобильных
// @author       Self-Perfection
// @icon         https://kagi.com/favicon-summarizer-32x32.png
// @match        *://*/*
// @noframes
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

    function openUrl(targetUrl) {
        let opened;
        try {
            opened = GM_openInTab(targetUrl, { active: true });
        } catch (e) {
            // GM_openInTab may fail on some pages/browsers
        }
        if (!opened) {
            window.open(targetUrl, '_blank');
        }
    }

    for (const { length, label } of lengths) {
        GM_registerMenuCommand(`Kagi: ${label}`, () => {
            const url = new URL('https://kagi.com/summarizer');
            url.searchParams.set('target_language', '');
            url.searchParams.set('summary', 'summary');
            url.searchParams.set('length', length);
            url.searchParams.set('url', location.href);
            openUrl(url.href);
        });
    }
})();
