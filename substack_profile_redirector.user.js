// ==UserScript==
// @name         Substack Profile to Subdomain Redirect
// @namespace    https://github.com/Self-Perfection
// @version      1.1
// @description  Redirect from substack.com/@username to username.substack.com
// @author       Self-Perfection
// @match        https://substack.com/@*
// @icon         https://substackcdn.com/icons/substack/icon.svg
// @grant        none
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/substack_profile_redirector.user.js
// @changelog    1.1 - Первая версия: редирект substack.com/@username на username.substack.com
// ==/UserScript==

(function() {
    'use strict';

    // Только страница профиля: /@username (с возможным завершающим слэшем).
    // Имена с символами, недопустимыми в поддомене (например, "_"), не трогаем.
    const match = window.location.pathname.match(/^\/@([a-z0-9-]+)\/?$/i);

    if (match) {
        const newUrl = `https://${match[1].toLowerCase()}.substack.com/${window.location.search}${window.location.hash}`;
        window.location.replace(newUrl);
    }
})();
