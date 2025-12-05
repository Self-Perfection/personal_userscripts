// ==UserScript==
// @name         Copy Page Link with Metadata
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Copy current page link with title, thumbnail and metadata
// @author       You
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/copy_link_with_metadata.user.js
// @changelog    2.4 - Исправлено: относительные URL (canonical, og:url) преобразуются в абсолютные для корректного сравнения
// @changelog    2.3 - Исправлена видимость radio buttons в диалоге на страницах с appearance:none в глобальных стилях
// @changelog    2.2 - Добавлена очистка URL: удаление пустого # в конце и UTM/tracking параметров (utm_*, fbclid, gclid и др.)
// @changelog    2.1 - Исправлен баг: в диалоге выбора показывается финальный заголовок (с siteName), улучшена проверка дубликатов siteName
// @changelog    2.0 - Добавлено извлечение автора (article:author, author, twitter:creator); кликабельная ссылка если автор - URL
// @changelog    1.9 - Расширена поддержка изображений: twitter:image, apple-touch-icon, фильтрация favicon < 32x32, умный выбор лучшего размера
// @changelog    1.8 - Исправлен баг: невидимый текст на кнопке отмены в диалоге (добавлен color: #333)
// @changelog    1.7 - Добавлены og:url и og:title; выбор из до 3 URL и 2 title (только если различаются); показ источника для каждого варианта
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

        // Title - собираем оба варианта
        metadata.documentTitle = document.title || '';
        const ogTitle = document.querySelector('meta[property="og:title"]');
        metadata.ogTitle = ogTitle ? ogTitle.content : null;
        // По умолчанию используем document.title
        metadata.title = metadata.documentTitle;

        // Current URL
        metadata.url = window.location.href;

        // Canonical link
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        metadata.canonicalUrl = canonicalLink && canonicalLink.href
            ? new URL(canonicalLink.href, window.location.href).href
            : null;

        // OG URL
        const ogUrl = document.querySelector('meta[property="og:url"]');
        metadata.ogUrl = ogUrl && ogUrl.content
            ? new URL(ogUrl.content, window.location.href).href
            : null;

        // Thumbnail - собираем все возможные источники в порядке приоритета
        // 1. Open Graph image (наиболее популярный)
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) {
            metadata.thumbnail = ogImage.content;
        }

        // 2. Twitter Card image (fallback для Twitter)
        if (!metadata.thumbnail) {
            const twitterImage = document.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]');
            if (twitterImage && twitterImage.content) {
                metadata.thumbnail = twitterImage.content;
            }
        }

        // 3. link[rel="image_src"] (старый стандарт)
        if (!metadata.thumbnail) {
            const imageSrc = document.querySelector('link[rel="image_src"]');
            if (imageSrc && imageSrc.href) {
                metadata.thumbnail = imageSrc.href;
            }
        }

        // 4. Apple Touch Icon (обычно качественные изображения)
        if (!metadata.thumbnail) {
            // Ищем apple-touch-icon, предпочитая большие размеры
            const appleTouchIcons = document.querySelectorAll(
                'link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'
            );

            // Сортируем по размеру (если указан), предпочитая большие
            let bestAppleIcon = null;
            let bestSize = 0;

            appleTouchIcons.forEach(icon => {
                const sizes = icon.getAttribute('sizes');
                if (sizes) {
                    const match = sizes.match(/(\d+)x(\d+)/);
                    if (match) {
                        const size = parseInt(match[1]);
                        if (size > bestSize) {
                            bestSize = size;
                            bestAppleIcon = icon;
                        }
                    }
                } else if (!bestAppleIcon) {
                    bestAppleIcon = icon;
                }
            });

            if (bestAppleIcon && bestAppleIcon.href) {
                metadata.thumbnail = bestAppleIcon.href;
            }
        }

        // 5. Favicon (последний fallback, только если >= 32x32 или размер неизвестен)
        if (!metadata.thumbnail) {
            const favicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');

            for (const favicon of favicons) {
                if (!favicon.href) continue;

                // Проверяем размер, если указан
                const sizes = favicon.getAttribute('sizes');
                if (sizes) {
                    const match = sizes.match(/(\d+)x(\d+)/);
                    if (match) {
                        const size = parseInt(match[1]);
                        // Игнорируем маленькие favicon (< 32x32)
                        if (size >= 32) {
                            metadata.thumbnail = favicon.href;
                            break;
                        }
                    }
                } else {
                    // Размер не указан - используем
                    metadata.thumbnail = favicon.href;
                    break;
                }
            }
        }

        // Преобразуем относительные URL в абсолютные
        if (metadata.thumbnail && !metadata.thumbnail.startsWith('http') && !metadata.thumbnail.startsWith('data:')) {
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

        // Author - собираем из разных источников, берем первый найденный
        let author = null;

        // 1. article:author (Open Graph для статей)
        const articleAuthor = document.querySelector('meta[property="article:author"]');
        if (articleAuthor && articleAuthor.content) {
            author = articleAuthor.content;
        }

        // 2. author (стандартный meta тег)
        if (!author) {
            const metaAuthor = document.querySelector('meta[name="author"]');
            if (metaAuthor && metaAuthor.content) {
                author = metaAuthor.content;
            }
        }

        // 3. twitter:creator (Twitter Cards)
        if (!author) {
            const twitterCreator = document.querySelector('meta[name="twitter:creator"], meta[property="twitter:creator"]');
            if (twitterCreator && twitterCreator.content) {
                author = twitterCreator.content;
            }
        }

        metadata.author = author;

        return metadata;
    }

    // Функция для проверки, является ли строка URL
    function isUrl(string) {
        if (!string) return false;
        // Простая проверка на URL
        return string.startsWith('http://') || string.startsWith('https://') || string.startsWith('//');
    }

    // Функция для очистки URL от tracking параметров и пустого якоря
    function cleanUrl(url) {
        if (!url) return url;

        try {
            const urlObj = new URL(url);

            // Удаляем UTM параметры и другие tracking параметры
            const paramsToRemove = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid'
            ];

            paramsToRemove.forEach(param => {
                urlObj.searchParams.delete(param);
            });

            // Собираем URL без hash, если hash пустой
            let result = urlObj.toString();

            // Удаляем одинокий # в конце (но сохраняем якоря типа #section)
            if (urlObj.hash === '#' || urlObj.hash === '') {
                // Убираем # из конца строки
                result = result.replace(/#$/, '');
            }

            return result;
        } catch (e) {
            // Если URL невалидный, возвращаем как есть
            console.warn('Failed to clean URL:', url, e);
            return url;
        }
    }

    // Функция для добавления siteName к заголовку, если его там нет
    function addSiteNameToTitle(title, siteName) {
        if (!siteName || !title) return title;

        // Нормализуем для проверки: убираем пробелы, приводим к нижнему регистру
        const normalizedTitle = title.toLowerCase().trim();
        const normalizedSiteName = siteName.toLowerCase().trim();

        // Проверяем различные варианты наличия siteName в title:
        // 1. Прямое вхождение
        // 2. В конце после дефиса " - "
        // 3. В начале с дефисом " — "
        if (normalizedTitle.includes(normalizedSiteName)) {
            return title; // siteName уже есть в заголовке
        }

        // Добавляем siteName в начало
        return siteName + ' — ' + title;
    }

    // Функция для экранирования HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Функция для генерации HTML-ссылки
    function generateLink(url, metadata) {
        // metadata.title уже содержит siteName, если он был добавлен
        const title = escapeHtml(metadata.title);

        // Создаём основную ссылку
        let linkHtml = `<a href="${escapeHtml(url)}">${title}</a>`;

        // Добавляем автора, если есть
        if (metadata.author) {
            let authorHtml;
            if (isUrl(metadata.author)) {
                // Если автор - это URL, делаем его кликабельной ссылкой
                authorHtml = `<a href="${escapeHtml(metadata.author)}">${escapeHtml(metadata.author)}</a>`;
            } else {
                // Если автор - это текст
                authorHtml = escapeHtml(metadata.author);
            }
            linkHtml += `<br/><small>Автор: ${authorHtml}</small>`;
        }

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

    // Универсальная функция для показа диалога выбора
    // options: [{value: '...', label: '...', source: '...', checked: true/false}, ...]
    function showChoiceDialog(title, options, fieldName = 'choice') {
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

            // Генерируем опции
            const optionsHtml = options.map((opt, idx) => `
                <label style="display: block; margin-bottom: 12px; cursor: pointer;">
                    <input type="radio" name="${fieldName}" value="${idx}" ${opt.checked ? 'checked' : ''} style="margin-right: 8px; appearance: auto; -webkit-appearance: radio; -moz-appearance: radio; width: auto; height: auto; padding: 0; border: none; border-radius: 0; cursor: pointer;">
                    <strong>${escapeHtml(opt.label)}${opt.source ? ` <span style="color: #999; font-weight: normal;">(${escapeHtml(opt.source)})</span>` : ''}</strong><br>
                    <span style="margin-left: 24px; word-break: break-all; color: #666;">${escapeHtml(opt.value)}</span>
                </label>
            `).join('');

            dialog.innerHTML = `
                <h3 style="margin-top: 0;">${escapeHtml(title)}</h3>
                <div style="margin: 16px 0;">
                    ${optionsHtml}
                </div>
                <div style="text-align: right;">
                    <button id="cancelBtn" style="padding: 8px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; color: #333; border-radius: 4px; cursor: pointer;">Отмена</button>
                    <button id="confirmBtn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Выбрать</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Обработчики кнопок
            const confirmBtn = dialog.querySelector('#confirmBtn');
            const cancelBtn = dialog.querySelector('#cancelBtn');

            confirmBtn.onclick = () => {
                const selected = dialog.querySelector(`input[name="${fieldName}"]:checked`);
                const selectedIdx = parseInt(selected.value);
                document.body.removeChild(overlay);
                resolve(options[selectedIdx].value);
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
            let selectedTitle = metadata.title;

            // Очищаем все URL от tracking параметров и пустого якоря
            const currentUrl = cleanUrl(metadata.url);
            const canonicalUrl = metadata.canonicalUrl ? cleanUrl(metadata.canonicalUrl) : null;
            const ogUrl = metadata.ogUrl ? cleanUrl(metadata.ogUrl) : null;

            // Собираем уникальные URL для выбора
            const urlOptions = [];
            const seenUrls = new Set();

            // Текущий URL (всегда первый)
            urlOptions.push({
                value: currentUrl,
                label: 'Текущий URL',
                source: 'window.location.href',
                checked: true
            });
            seenUrls.add(currentUrl);

            // Canonical URL
            if (canonicalUrl && !seenUrls.has(canonicalUrl)) {
                urlOptions.push({
                    value: canonicalUrl,
                    label: 'Канонический URL',
                    source: 'link[rel="canonical"]',
                    checked: false
                });
                seenUrls.add(canonicalUrl);
            }

            // OG URL
            if (ogUrl && !seenUrls.has(ogUrl)) {
                urlOptions.push({
                    value: ogUrl,
                    label: 'Open Graph URL',
                    source: 'og:url',
                    checked: false
                });
                seenUrls.add(ogUrl);
            }

            // Показываем диалог выбора URL только если есть варианты
            if (urlOptions.length > 1) {
                selectedUrl = await showChoiceDialog('Выберите URL для копирования', urlOptions, 'urlChoice');

                if (!selectedUrl) {
                    showToast('Копирование отменено', 'error');
                    return;
                }
            }

            // Собираем варианты title для выбора
            const titleOptions = [];
            const seenTitles = new Set();

            // document.title (всегда первый)
            if (metadata.documentTitle) {
                const titleWithSiteName = addSiteNameToTitle(metadata.documentTitle, metadata.siteName);
                titleOptions.push({
                    value: titleWithSiteName,
                    label: 'Заголовок страницы',
                    source: 'document.title',
                    checked: true
                });
                seenTitles.add(titleWithSiteName);
            }

            // og:title
            if (metadata.ogTitle) {
                const titleWithSiteName = addSiteNameToTitle(metadata.ogTitle, metadata.siteName);
                if (!seenTitles.has(titleWithSiteName)) {
                    titleOptions.push({
                        value: titleWithSiteName,
                        label: 'Open Graph заголовок',
                        source: 'og:title',
                        checked: false
                    });
                    seenTitles.add(titleWithSiteName);
                }
            }

            // Показываем диалог выбора title только если есть варианты
            if (titleOptions.length > 1) {
                selectedTitle = await showChoiceDialog('Выберите заголовок', titleOptions, 'titleChoice');

                if (!selectedTitle) {
                    showToast('Копирование отменено', 'error');
                    return;
                }
            }

            // Обновляем metadata с выбранным title
            metadata.title = selectedTitle;

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
