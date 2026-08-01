// ==UserScript==
// @name         Fogos.pt - Координаты как omaps.app ссылки
// @namespace    https://github.com/Self-Perfection
// @version      1.1
// @description  Делает координаты на fogos.pt кликабельными ссылками на omaps.app и добавляет кнопку копирования
// @author       Self-Perfection
// @icon         https://fogos.pt/favicon.ico
// @match        https://fogos.pt/fogo/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/fogospt_geolinks.user.js
// @changelog    1.1 - @namespace заменён с дефолтного tampermonkey.net на профиль автора
// ==/UserScript==

(function() {
    'use strict';

    // Функция для копирования текста в буфер обмена
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(function() {
            // Показываем уведомление об успешном копировании
            showNotification('Координаты скопированы: ' + text);
        }).catch(function(err) {
            console.error('Ошибка копирования: ', err);
        });
    }

    // Функция для показа уведомления
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(notification);

        // Убираем уведомление через 3 секунды
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Основная функция обработки координат
    function processCoordinates() {
        const locationElements = document.querySelectorAll('.f-location');

        locationElements.forEach(element => {
            // Проверяем, не обработан ли уже этот элемент
            if (element.dataset.processed === 'true') {
                return;
            }

            // Ищем координаты в тексте (формат: число.число, -число.число)
            const coordPattern = /(-?\d+\.\d+),\s*(-?\d+\.\d+)/;
            const match = element.textContent.match(coordPattern);

            if (match) {
                const latitude = match[1];
                const longitude = match[2];
                const coordinates = `${latitude}, ${longitude}`;

                // Помечаем элемент как обработанный
                element.dataset.processed = 'true';

                // Создаем контейнер для координат и кнопок
                const coordContainer = document.createElement('div');
                coordContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                `;

                // Создаем ссылку на omaps.app
                const geoLink = document.createElement('a');
                geoLink.href = `https://omaps.app/${latitude},${longitude}`;
                geoLink.textContent = coordinates;
                geoLink.target = '_blank';
                geoLink.style.cssText = `
                    color: #007bff;
                    text-decoration: none;
                    font-weight: bold;
                `;
                geoLink.addEventListener('mouseover', () => {
                    geoLink.style.textDecoration = 'underline';
                });
                geoLink.addEventListener('mouseout', () => {
                    geoLink.style.textDecoration = 'none';
                });

                // Создаем кнопку копирования
                const copyButton = document.createElement('button');
                copyButton.innerHTML = '📋';
                copyButton.title = 'Скопировать координаты';
                copyButton.style.cssText = `
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 5px 8px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.2s;
                `;

                copyButton.addEventListener('click', () => {
                    copyToClipboard(coordinates);
                });

                copyButton.addEventListener('mouseover', () => {
                    copyButton.style.backgroundColor = '#e9ecef';
                });

                copyButton.addEventListener('mouseout', () => {
                    copyButton.style.backgroundColor = '#f8f9fa';
                });

                // Сохраняем существующую иконку карты, если она есть
                const mapIcon = element.querySelector('a[href*="google.com/maps"] i');
                if (mapIcon) {
                    const mapLink = mapIcon.parentElement;
                    coordContainer.appendChild(mapLink);
                }

                // Добавляем элементы в контейнер
                coordContainer.appendChild(geoLink);
                coordContainer.appendChild(copyButton);

                // Заменяем содержимое элемента
                element.innerHTML = '';
                element.appendChild(coordContainer);
            }
        });
    }

    // Запускаем обработку координат после загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processCoordinates);
    } else {
        processCoordinates();
    }

    // Также запускаем через небольшую задержку на случай динамической загрузки контента
    setTimeout(processCoordinates, 1000);

    // Отслеживаем изменения URL для SPA (Single Page Application)
    let currentUrl = window.location.href;

    // Следим за изменениями истории браузера (pushState/replaceState)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
        originalPushState.apply(history, arguments);
        setTimeout(processCoordinates, 500); // Небольшая задержка для загрузки контента
    };

    history.replaceState = function() {
        originalReplaceState.apply(history, arguments);
        setTimeout(processCoordinates, 500);
    };

    // Следим за событием popstate (кнопки назад/вперед)
    window.addEventListener('popstate', function() {
        setTimeout(processCoordinates, 500);
    });

    // Дополнительно отслеживаем изменения URL через интервал
    // (на случай если SPA использует другие методы навигации)
    setInterval(function() {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            setTimeout(processCoordinates, 500);
        }
    }, 1000);

})();
