// ==UserScript==
// @name         Copy Page Link with Metadata
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Copy current page link with title, thumbnail and metadata
// @author       You
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/copy_link_with_metadata.user.js
// @changelog    1.6 - Улучшено: ленивая инициализация стилей (создаются только при первом использовании)
// @changelog    1.5 - Исправлена утечка памяти: стили toast уведомлений создаются один раз
// @changelog    1.4 - Добавлена проверка минимальной длины description (< 8 символов)
// ==/UserScript==

(function() {
    'use strict';

    // Флаг для отслеживания, были ли добавлены стили
    let toastStylesInitialized = false;

    // Функция для ленивой инициализации стилей toast уведомлений
    function initToastStyles() {
        if (toastStylesInitialized) {
            return;
        }

        const toastStyles = document.createElement('style');
        toastStyles.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(toastStyles);
        toastStylesInitialized = true;
    }

    // Функция для извлечения метаданных страницы
    function getPageMetadata() {
        const metadata = {};

        // Title
        metadata.title = document.title || '';

        // Current URL
        metadata.url = window.location.href;

        // Canonical link
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        metadata.canonicalUrl = canonicalLink ? canonicalLink.href : null;

        // Thumbnail (og:image или link[rel="image_src"])
        const ogImage = document.querySelector('meta[property="og:image"]');
        const imageSrc = document.querySelector('link[rel="image_src"]');
        metadata.thumbnail = ogImage ? ogImage.content : (imageSrc ? imageSrc.href : null);

        // Fallback на favicon если нет thumbnail
        if (!metadata.thumbnail) {
            const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
            metadata.thumbnail = favicon ? favicon.href : null;
        }

        // Преобразуем относительные URL в абсолютные
        if (metadata.thumbnail && !metadata.thumbnail.startsWith('http')) {
            metadata.thumbnail = new URL(metadata.thumbnail, window.location.href).href;
        }

        // Description
        const ogDescription = document.querySelector('meta[property="og:description"]');
        const metaDescription = document.querySelector('meta[name="description"]');
        let description = ogDescription ? ogDescription.content :
                          (metaDescription ? metaDescription.content : null);

        // Sanity check: если длина description < 12 символов, считаем его отсутствующим
        if (description && description.length < 12) {
            description = null;
        }

        metadata.description = description;

        // Site name
        const ogSiteName = document.querySelector('meta[property="og:site_name"]');
        metadata.siteName = ogSiteName ? ogSiteName.content : null;

        return metadata;
    }

    // Функция для экранирования HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Функция для генерации HTML-ссылки
    function generateLink(url, metadata) {
        let title = escapeHtml(metadata.title);

        // Добавляем site name если есть
        if (metadata.siteName && !metadata.title.includes(metadata.siteName)) {
            title = escapeHtml(metadata.siteName) + ' — ' + title;
        }

        // Создаём основную ссылку
        let linkHtml = `<a href="${escapeHtml(url)}">${title}</a>`;

        // Добавляем description как видимый текст в <small>
        if (metadata.description) {
            linkHtml += `<br/><small>${escapeHtml(metadata.description)}</small>`;
        }

        // Добавляем thumbnail если есть
        if (metadata.thumbnail) {
            linkHtml += `<br/><img data-editor-shrink="true" src="${escapeHtml(metadata.thumbnail)}"/>`;
        }

        return linkHtml;
    }

    // Функция для показа toast уведомления
    function showToast(message, type = 'success') {
        // Инициализируем стили при первом вызове
        initToastStyles();

        // Создаём toast элемент
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        // Убираем toast через 3 секунды
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // Функция для показа диалога выбора URL
    function showUrlChoiceDialog(currentUrl, canonicalUrl) {
        return new Promise((resolve) => {
            // Создаём модальное окно
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 24px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 600px;
                font-family: Arial, sans-serif;
            `;

            dialog.innerHTML = `
                <h3 style="margin-top: 0;">Выберите URL для копирования</h3>
                <div style="margin: 16px 0;">
                    <label style="display: block; margin-bottom: 12px; cursor: pointer;">
                        <input type="radio" name="urlChoice" value="current" checked style="margin-right: 8px;">
                        <strong>Текущий URL:</strong><br>
                        <span style="margin-left: 24px; word-break: break-all; color: #666;">${escapeHtml(currentUrl)}</span>
                    </label>
                    <label style="display: block; cursor: pointer;">
                        <input type="radio" name="urlChoice" value="canonical" style="margin-right: 8px;">
                        <strong>Канонический URL:</strong><br>
                        <span style="margin-left: 24px; word-break: break-all; color: #666;">${escapeHtml(canonicalUrl)}</span>
                    </label>
                </div>
                <div style="text-align: right;">
                    <button id="cancelBtn" style="padding: 8px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Отмена</button>
                    <button id="confirmBtn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Копировать</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Обработчики кнопок
            const confirmBtn = dialog.querySelector('#confirmBtn');
            const cancelBtn = dialog.querySelector('#cancelBtn');

            confirmBtn.onclick = () => {
                const selected = dialog.querySelector('input[name="urlChoice"]:checked').value;
                document.body.removeChild(overlay);
                resolve(selected === 'canonical' ? canonicalUrl : currentUrl);
            };

            cancelBtn.onclick = () => {
                document.body.removeChild(overlay);
                resolve(null);
            };

            // ESC для закрытия
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(overlay);
                    document.removeEventListener('keydown', escHandler);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    // Основная функция
    async function copyPageLink() {
        try {
            const metadata = getPageMetadata();
            let selectedUrl = metadata.url;

            // Если есть canonical URL - показываем диалог выбора
            if (metadata.canonicalUrl && metadata.canonicalUrl !== metadata.url) {
                selectedUrl = await showUrlChoiceDialog(metadata.url, metadata.canonicalUrl);

                // Если пользователь отменил
                if (!selectedUrl) {
                    showToast('Копирование отменено', 'error');
                    return;
                }
            }

            // Генерируем HTML-ссылку
            const linkHtml = generateLink(selectedUrl, metadata);

            // Копируем в буфер обмена как HTML
            try {
                // Используем современный Clipboard API для HTML
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([linkHtml], { type: 'text/html' }),
                        'text/plain': new Blob([linkHtml], { type: 'text/plain' })
                    })
                ]);
            } catch (clipboardError) {
                // Fallback на простой текст если HTML не поддерживается
                console.warn('HTML clipboard not supported, falling back to text:', clipboardError);
                if (typeof GM_setClipboard !== 'undefined') {
                    GM_setClipboard(linkHtml);
                } else {
                    await navigator.clipboard.writeText(linkHtml);
                }
            }

            showToast('Ссылка скопирована в буфер обмена!');
            console.log('Copied to clipboard:', linkHtml);

        } catch (error) {
            console.error('Error copying link:', error);
            showToast('Ошибка при копировании', 'error');
        }
    }

    // Регистрируем команду в меню Violentmonkey
    GM_registerMenuCommand('Копировать ссылку на страницу', copyPageLink);

})();
