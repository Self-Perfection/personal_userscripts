// ==UserScript==
// @name         Infopedia Cross-Dictionary Links
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Add cross-reference links between Português-Inglês and Português para Estrangeiros dictionaries
// @author       You
// @icon         https://www.infopedia.pt/apple-touch-icon.png
// @match        https://www.infopedia.pt/dicionarios/portugues-ingles/*
// @match        https://www.infopedia.pt/dicionarios/portugues-estrangeiros/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/infopedia_cross_dictionary_links.user.js
// @changelog    1.6 - Диалог настроек вызывается через GM_registerMenuCommand (убрана кнопка со страницы)
// @changelog    1.5 - Добавлена автоочистка cookies с настройками и статистикой удалений
// @changelog    1.4 - Адаптивная вёрстка: на мобильных устройствах отображается только иконка
// @changelog    1.3 - Изменено место вставки ссылки: теперь в .menu-container (верхняя навигация)
// @changelog    1.2 - Добавлено подробное логирование для отладки (console.log)
// @changelog    1.1 - Добавлена иконка скрипта (apple-touch-icon.png)
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Infopedia] Скрипт запущен');

    // ========== COOKIE AUTO-CLEANUP FUNCTIONALITY ==========

    // Настройки по умолчанию
    const SETTINGS_KEY = 'infopedia_cookie_cleanup_enabled';
    const STATS_KEY = 'infopedia_cookie_deletion_stats';
    const CLEANUP_INTERVAL = 5000; // 5 секунд

    // Получение настроек
    function isCleanupEnabled() {
        return GM_getValue(SETTINGS_KEY, false);
    }

    // Сохранение настроек
    function setCleanupEnabled(enabled) {
        GM_setValue(SETTINGS_KEY, enabled);
    }

    // Получение статистики
    function getStats() {
        return GM_getValue(STATS_KEY, {});
    }

    // Сохранение статистики
    function saveStats(stats) {
        GM_setValue(STATS_KEY, stats);
    }

    // Получение всех cookies текущего домена
    function getAllCookies() {
        const cookies = {};
        const cookieString = document.cookie;
        if (cookieString) {
            cookieString.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name) {
                    cookies[name] = value;
                }
            });
        }
        return cookies;
    }

    // Удаление cookie
    function deleteCookie(name) {
        // Удаляем для разных путей и доменов
        const paths = ['/', '', window.location.pathname];
        const domains = ['', '.infopedia.pt', 'infopedia.pt', '.www.infopedia.pt'];

        paths.forEach(path => {
            domains.forEach(domain => {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}`;
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
            });
        });
    }

    // Функция автоочистки cookies
    function cleanupCookies() {
        const cookies = getAllCookies();
        const stats = getStats();
        let deletedCount = 0;

        Object.keys(cookies).forEach(cookieName => {
            deleteCookie(cookieName);
            stats[cookieName] = (stats[cookieName] || 0) + 1;
            deletedCount++;
        });

        if (deletedCount > 0) {
            saveStats(stats);
            console.log(`[Infopedia Cookie Cleanup] Удалено ${deletedCount} cookie(s)`);
        }
    }

    // Запуск периодической очистки
    let cleanupIntervalId = null;
    function startCleanup() {
        if (cleanupIntervalId) return;
        console.log('[Infopedia Cookie Cleanup] Автоочистка включена');
        cleanupCookies(); // Сразу очищаем
        cleanupIntervalId = setInterval(cleanupCookies, CLEANUP_INTERVAL);
    }

    function stopCleanup() {
        if (cleanupIntervalId) {
            clearInterval(cleanupIntervalId);
            cleanupIntervalId = null;
            console.log('[Infopedia Cookie Cleanup] Автоочистка отключена');
        }
    }

    // Создание UI для настроек
    function createSettingsDialog() {
        const stats = getStats();
        const enabled = isCleanupEnabled();

        // Создаём overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Создаём диалог
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

        // Заголовок
        const title = document.createElement('h2');
        title.textContent = 'Настройки автоочистки cookies';
        title.style.cssText = 'margin-top: 0; margin-bottom: 20px; font-size: 18px;';

        // Чекбокс для включения/выключения
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText = 'margin-bottom: 20px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'infopedia-cleanup-checkbox';
        checkbox.checked = enabled;
        checkbox.style.cssText = 'margin-right: 8px;';

        const label = document.createElement('label');
        label.htmlFor = 'infopedia-cleanup-checkbox';
        label.textContent = 'Включить автоматическую очистку cookies';
        label.style.cssText = 'cursor: pointer; user-select: none;';

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);

        // Статистика
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = 'margin-bottom: 20px;';

        const statsTitle = document.createElement('h3');
        statsTitle.textContent = 'Статистика удалений:';
        statsTitle.style.cssText = 'margin-top: 0; margin-bottom: 10px; font-size: 16px;';

        const statsList = document.createElement('div');
        statsList.style.cssText = 'max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;';

        if (Object.keys(stats).length === 0) {
            statsList.textContent = 'Пока нет данных';
            statsList.style.color = '#999';
        } else {
            // Сортируем по количеству удалений (по убыванию)
            const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
            sortedStats.forEach(([cookieName, count]) => {
                const statItem = document.createElement('div');
                statItem.style.cssText = 'display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;';
                statItem.innerHTML = `
                    <span style="font-family: monospace; word-break: break-all;">${cookieName}</span>
                    <span style="font-weight: bold; margin-left: 10px; white-space: nowrap;">${count}</span>
                `;
                statsList.appendChild(statItem);
            });
        }

        statsContainer.appendChild(statsTitle);
        statsContainer.appendChild(statsList);

        // Кнопки
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

        const resetButton = document.createElement('button');
        resetButton.textContent = 'Сбросить статистику';
        resetButton.style.cssText = 'padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;';
        resetButton.onclick = () => {
            if (confirm('Вы уверены, что хотите сбросить статистику?')) {
                saveStats({});
                overlay.remove();
                createSettingsDialog(); // Перерисовываем диалог
            }
        };

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Сохранить';
        saveButton.style.cssText = 'padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;';
        saveButton.onclick = () => {
            const newEnabled = checkbox.checked;
            setCleanupEnabled(newEnabled);

            if (newEnabled) {
                startCleanup();
            } else {
                stopCleanup();
            }

            overlay.remove();
        };

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Закрыть';
        closeButton.style.cssText = 'padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;';
        closeButton.onclick = () => overlay.remove();

        buttonsContainer.appendChild(resetButton);
        buttonsContainer.appendChild(closeButton);
        buttonsContainer.appendChild(saveButton);

        // Собираем диалог
        dialog.appendChild(title);
        dialog.appendChild(checkboxContainer);
        dialog.appendChild(statsContainer);
        dialog.appendChild(buttonsContainer);

        overlay.appendChild(dialog);

        // Закрытие по клику на overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        document.body.appendChild(overlay);
    }

    // Инициализация автоочистки при загрузке
    if (isCleanupEnabled()) {
        startCleanup();
    }

    // Регистрируем команду в меню userscript manager
    GM_registerMenuCommand('Настройки автоочистки cookies', createSettingsDialog);

    // ========== END COOKIE AUTO-CLEANUP FUNCTIONALITY ==========

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
