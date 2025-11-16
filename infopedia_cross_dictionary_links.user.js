// ==UserScript==
// @name         Infopedia Cross-Dictionary Links
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Add cross-reference links between Português-Inglês and Português para Estrangeiros dictionaries
// @author       You
// @icon         https://www.infopedia.pt/apple-touch-icon.png
// @match        https://www.infopedia.pt/dicionarios/portugues-ingles/*
// @match        https://www.infopedia.pt/dicionarios/portugues-estrangeiros/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/infopedia_cross_dictionary_links.user.js
// @changelog    1.2 - Добавлено подробное логирование для отладки (console.log)
// @changelog    1.1 - Добавлена иконка скрипта (apple-touch-icon.png)
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Infopedia] Скрипт запущен');

    // Определяем текущий словарь и целевой словарь
    const currentPath = window.location.pathname;
    console.log('[Infopedia] Текущий путь:', currentPath);

    let targetDict = null;
    let iconSrc = null;
    let linkText = null;

    if (currentPath.includes('/dicionarios/portugues-ingles/')) {
        // Мы в Português-Inglês, создаём ссылку на Português para Estrangeiros
        const word = currentPath.split('/dicionarios/portugues-ingles/')[1];
        console.log('[Infopedia] Словарь: Português-Inglês, слово:', word);
        if (word) {
            targetDict = `/dicionarios/portugues-estrangeiros/${word}`;
            iconSrc = '/images/bandeira-pt.svg';
            linkText = 'Português para Estrangeiros';
        }
    } else if (currentPath.includes('/dicionarios/portugues-estrangeiros/')) {
        // Мы в Português para Estrangeiros, создаём ссылку на Português-Inglês
        const word = currentPath.split('/dicionarios/portugues-estrangeiros/')[1];
        console.log('[Infopedia] Словарь: Português para Estrangeiros, слово:', word);
        if (word) {
            targetDict = `/dicionarios/portugues-ingles/${word}`;
            iconSrc = '/images/bandeira-en.svg';
            linkText = 'Português-Inglês';
        }
    }

    console.log('[Infopedia] Целевой словарь:', targetDict);

    // Если определили целевой словарь, добавляем ссылку
    if (targetDict) {
        // Ждём загрузки DOM
        function addCrossLink() {
            console.log('[Infopedia] Попытка добавить ссылку...');
            const navContainer = document.querySelector('.nav-container');
            const searchDicioContainer = document.querySelector('#search-dicio-container');

            console.log('[Infopedia] navContainer:', navContainer);
            console.log('[Infopedia] searchDicioContainer:', searchDicioContainer);

            if (navContainer && searchDicioContainer) {
                console.log('[Infopedia] Элементы найдены, создаём ссылку');

                // Создаём ссылку
                const linkContainer = document.createElement('a');
                linkContainer.href = targetDict;
                linkContainer.style.cssText = 'display: inline-block; text-decoration: none; color: inherit; margin-left: 15px; vertical-align: top;';

                const linkDiv = document.createElement('div');
                linkDiv.className = 'dicionarios-pesquisa-dicio';
                linkDiv.style.cssText = 'display: inline-flex; align-items: center; padding: 5px 10px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; cursor: pointer;';
                linkDiv.onmouseover = function() { this.style.background = '#e9e9e9'; };
                linkDiv.onmouseout = function() { this.style.background = '#f9f9f9'; };

                const icon = document.createElement('img');
                icon.src = iconSrc;
                icon.style.cssText = 'width: 24px; margin-right: 5px; padding-bottom: 2px;';

                const titleDiv = document.createElement('div');
                titleDiv.className = 'titulo-dicio';
                titleDiv.textContent = linkText;
                titleDiv.style.cssText = 'font-size: 14px;';

                linkDiv.appendChild(icon);
                linkDiv.appendChild(titleDiv);
                linkContainer.appendChild(linkDiv);

                // Вставляем после search-dicio-container
                searchDicioContainer.parentNode.insertBefore(linkContainer, searchDicioContainer.nextSibling);
                console.log('[Infopedia] Ссылка добавлена успешно');
            } else {
                console.log('[Infopedia] ОШИБКА: Не найдены необходимые элементы');
            }
        }

        // Пытаемся добавить сразу, если DOM уже загружен
        console.log('[Infopedia] document.readyState:', document.readyState);
        if (document.readyState === 'loading') {
            console.log('[Infopedia] DOM ещё загружается, ждём DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', addCrossLink);
        } else {
            console.log('[Infopedia] DOM уже загружен, добавляем ссылку сразу');
            addCrossLink();
        }
    } else {
        console.log('[Infopedia] Целевой словарь не определён, скрипт завершён');
    }
})();
