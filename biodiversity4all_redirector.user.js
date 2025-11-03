// ==UserScript==
// @name         Biodiversity4all to iNaturalist Redirect
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Redirect from biodiversity4all.org to inaturalist.org
// @author       You
// @match        https://www.biodiversity4all.org/observations/*
// @icon         https://www.biodiversity4all.org/assets/favicon-2820897efd0b773a52e4e5a889eadc20db75035803eb864ae4a41d4cd7d52ab8.png
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Получаем текущий URL
    const currentUrl = window.location.href;

    // Извлекаем ID наблюдения из URL
    const match = currentUrl.match(/\/observations\/(.+)/);

    if (match && match[1]) {
        // Формируем новый URL для iNaturalist
        const newUrl = `https://www.inaturalist.org/observations/${match[1]}`;

        // Перенаправляем
        window.location.replace(newUrl);
    }
})();
