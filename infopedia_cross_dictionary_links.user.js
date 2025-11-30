// ==UserScript==
// @name         Infopedia Cross-Dictionary Links
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Add cross-reference links between Português-Inglês and Português para Estrangeiros dictionaries
// @author       You
// @icon         https://www.infopedia.pt/apple-touch-icon.png
// @match        https://www.infopedia.pt/dicionarios/portugues-ingles/*
// @match        https://www.infopedia.pt/dicionarios/portugues-estrangeiros/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/infopedia_cross_dictionary_links.user.js
// @changelog    1.4 - Адаптивная вёрстка: на мобильных устройствах отображается только иконка
// @changelog    1.3 - Изменено место вставки ссылки: теперь в .menu-container (верхняя навигация)
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

            // Добавляем стили для адаптивной вёрстки
            const style = document.createElement('style');
            style.textContent = `
                @media (max-width: 767px) {
                    .infopedia-cross-link-text {
                        display: none !important;
                    }
                    .infopedia-cross-link-wrapper {
                        margin-left: 5px !important;
                    }
                    .infopedia-cross-link-container {
                        height: 40px !important;
                        padding: 0 8px !important;
                    }
                }
            `;
            document.head.appendChild(style);

            const menuContainer = document.querySelector('.menu-container');
            const headerLogo = document.querySelector('.header-logo');

            console.log('[Infopedia] menuContainer:', menuContainer);
            console.log('[Infopedia] headerLogo:', headerLogo);

            if (menuContainer && headerLogo) {
                console.log('[Infopedia] Элементы найдены, создаём ссылку');

                // Создаём обёртку с классом menu-container-cell
                const linkWrapper = document.createElement('div');
                linkWrapper.className = 'float-left menu-container-cell infopedia-cross-link-wrapper';
                linkWrapper.style.cssText = 'margin-left: 15px; display: flex; align-items: center;';

                // Создаём ссылку
                const linkContainer = document.createElement('a');
                linkContainer.href = targetDict;
                linkContainer.title = linkText; // Подсказка при наведении/тапе
                linkContainer.style.cssText = 'text-decoration: none; color: inherit;';

                const linkDiv = document.createElement('div');
                linkDiv.className = 'infopedia-cross-link-container';
                linkDiv.style.cssText = 'display: inline-flex; align-items: center; height: 48px; padding: 0 10px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; cursor: pointer;';
                linkDiv.onmouseover = function() { this.style.background = '#e9e9e9'; };
                linkDiv.onmouseout = function() { this.style.background = '#f9f9f9'; };

                const icon = document.createElement('img');
                icon.src = iconSrc;
                icon.style.cssText = 'height: 100%; margin-right: 8px;';
                icon.alt = linkText;

                const titleDiv = document.createElement('div');
                titleDiv.className = 'infopedia-cross-link-text';
                titleDiv.textContent = linkText;
                titleDiv.style.cssText = 'font-size: 14px; white-space: nowrap;';

                linkDiv.appendChild(icon);
                linkDiv.appendChild(titleDiv);
                linkContainer.appendChild(linkDiv);
                linkWrapper.appendChild(linkContainer);

                // Вставляем после header-logo
                headerLogo.parentNode.insertBefore(linkWrapper, headerLogo.nextSibling);
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
