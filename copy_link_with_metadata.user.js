// ==UserScript==
// @name         Copy Page Link with Metadata
// @namespace    http://tampermonkey.net/
// @version      3.1.2
// @description  Copy current page link with title, thumbnail and metadata
// @author       You
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/copy_link_with_metadata.user.js
// @changelog    3.1 - Исправлено: диалог выбора не реагировал на клики на сайтах с агрессивным CSS (Wired.com и др.) — переход на <dialog> + Shadow DOM
// @changelog    3.0 - Исправлено: галочка "Запомнить" сохраняет только выбор из своего диалога, не затрагивая другое поле
// @changelog    2.9 - Исправлена совместимость с YouTube (CSP Trusted Types): диалог строится через DOM вместо innerHTML; улучшены сообщения об ошибках с указанием этапа
// @changelog    2.8 - Добавлена возможность запомнить предпочтения выбора URL и заголовка для каждого домена
// @changelog    2.7 - Улучшено: автоматическое удаление коротких заголовков, если они полностью содержатся в других вариантах
// @changelog    2.6 - Исправлено: игнорирование различий http/https при сравнении URL (диалог не показывается, если URL отличаются только протоколом)
// @changelog    2.5 - Исправлено: нормализация заголовков перед сравнением (удаление переносов строк и лишних пробелов)
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

    // Функция для нормализации URL при сравнении (приводит http к https)
    function normalizeUrlForComparison(url) {
        if (!url) return url;
        return url.replace(/^http:\/\//i, 'https://');
    }

    // Функция для нормализации заголовков (удаление переносов строк и лишних пробелов)
    function normalizeTitle(title) {
        if (!title) return title;

        return title
            .replace(/[\r\n]+/g, ' ')  // Заменяем переносы строк на пробелы
            .replace(/\s+/g, ' ')       // Заменяем множественные пробелы на одинарные
            .trim();                     // Убираем пробелы в начале и конце
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

    // Функции для работы с предпочтениями доменов
    const DOMAIN_PREFS_PREFIX = 'domainPrefs_';

    // Получить домен из URL
    function getDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            console.warn('Failed to extract domain from URL:', url, e);
            return null;
        }
    }

    // Сохранить предпочтения для домена
    function savePreference(domain, titlePreference, urlPreference) {
        try {
            GM_setValue(DOMAIN_PREFS_PREFIX + domain, { titlePreference, urlPreference });
        } catch (e) {
            console.error('Failed to save preferences:', e);
        }
    }

    // Сохранить только предпочтение URL для домена (не затрагивает titlePreference)
    function saveUrlPreference(domain, urlPreference) {
        try {
            const current = GM_getValue(DOMAIN_PREFS_PREFIX + domain, {});
            GM_setValue(DOMAIN_PREFS_PREFIX + domain, Object.assign({}, current, { urlPreference }));
        } catch (e) {
            console.error('Failed to save URL preference:', e);
        }
    }

    // Сохранить только предпочтение заголовка для домена (не затрагивает urlPreference)
    function saveTitlePreference(domain, titlePreference) {
        try {
            const current = GM_getValue(DOMAIN_PREFS_PREFIX + domain, {});
            GM_setValue(DOMAIN_PREFS_PREFIX + domain, Object.assign({}, current, { titlePreference }));
        } catch (e) {
            console.error('Failed to save title preference:', e);
        }
    }

    // Получить предпочтения для домена
    function getPreference(domain) {
        if (!domain) return null;
        return GM_getValue(DOMAIN_PREFS_PREFIX + domain, null);
    }

    // Универсальная функция для показа диалога выбора
    // options: [{value: '...', label: '...', source: '...', checked: true/false}, ...]
    // showRememberCheckbox: если true, показывает чекбокс "Запомнить выбор для этого домена"
    // Возвращает: {value: selectedValue, remember: checkboxState} или null при отмене
    function showChoiceDialog(title, options, fieldName = 'choice', showRememberCheckbox = false) {
        return new Promise((resolve) => {
            // <dialog> в основном DOM — top layer для позиционирования
            // Shadow DOM внутри — полная изоляция стилей от страницы
            const dialog = document.createElement('dialog');
            dialog.style.cssText = 'background: transparent; border: none; padding: 0; max-width: 600px; width: 90vw; max-height: 90vh; overflow: visible;';

            // Стили для ::backdrop
            const backdropStyle = document.createElement('style');
            backdropStyle.textContent = 'dialog[open]::backdrop { background: rgba(0,0,0,0.5); }';
            document.head.appendChild(backdropStyle);

            // Shadow DOM для изоляции содержимого от стилей страницы
            const shadowHost = document.createElement('div');
            dialog.appendChild(shadowHost);
            const shadow = shadowHost.attachShadow({ mode: 'open' });

            // Все стили внутри Shadow DOM
            const style = document.createElement('style');
            style.textContent = `
                :host { display: block; }
                * { box-sizing: border-box; }
                .dialog-content {
                    background: white;
                    padding: 24px;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    font-family: Arial, sans-serif;
                    color: #333;
                    max-height: 90vh;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                h3 { margin-top: 0; color: #333; }
                .options { margin: 16px 0; }
                label.option { display: block; margin-bottom: 12px; cursor: pointer; }
                input[type="radio"] {
                    margin-right: 8px;
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                    vertical-align: middle;
                }
                .source { color: #999; font-weight: normal; }
                .value { display: block; margin-left: 24px; word-break: break-all; color: #666; }
                .remember { margin: 16px 0; padding-top: 12px; border-top: 1px solid #eee; }
                label.remember-label { cursor: pointer; display: inline-flex; align-items: center; }
                input[type="checkbox"] {
                    margin-right: 8px;
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                .remember-text { color: #666; }
                .buttons { text-align: right; }
                button {
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                button.cancel {
                    margin-right: 8px;
                    border: 1px solid #ddd;
                    background: white;
                    color: #333;
                }
                button.confirm {
                    background: #4CAF50;
                    color: white;
                    border: none;
                }
            `;
            shadow.appendChild(style);

            // Содержимое диалога
            const content = document.createElement('div');
            content.className = 'dialog-content';

            const h3 = document.createElement('h3');
            h3.textContent = title;
            content.appendChild(h3);

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'options';

            options.forEach((opt, idx) => {
                const label = document.createElement('label');
                label.className = 'option';

                const input = document.createElement('input');
                input.type = 'radio';
                input.name = fieldName;
                input.value = String(idx);
                input.checked = opt.checked || false;

                const strong = document.createElement('strong');
                strong.textContent = opt.label;
                if (opt.source) {
                    const sourceSpan = document.createElement('span');
                    sourceSpan.className = 'source';
                    sourceSpan.textContent = ` (${opt.source})`;
                    strong.appendChild(sourceSpan);
                }

                const valueSpan = document.createElement('span');
                valueSpan.className = 'value';
                valueSpan.textContent = opt.value;

                label.appendChild(input);
                label.appendChild(strong);
                label.appendChild(document.createElement('br'));
                label.appendChild(valueSpan);
                optionsDiv.appendChild(label);
            });

            content.appendChild(optionsDiv);

            // Чекбокс "Запомнить"
            let rememberCheckbox = null;
            if (showRememberCheckbox) {
                const rememberDiv = document.createElement('div');
                rememberDiv.className = 'remember';

                const rememberLabel = document.createElement('label');
                rememberLabel.className = 'remember-label';

                rememberCheckbox = document.createElement('input');
                rememberCheckbox.type = 'checkbox';

                const rememberText = document.createElement('span');
                rememberText.className = 'remember-text';
                rememberText.textContent = 'Запомнить выбор для этого домена';

                rememberLabel.appendChild(rememberCheckbox);
                rememberLabel.appendChild(rememberText);
                rememberDiv.appendChild(rememberLabel);
                content.appendChild(rememberDiv);
            }

            // Кнопки
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'buttons';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancel';
            cancelBtn.textContent = 'Отмена';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'confirm';
            confirmBtn.textContent = 'Выбрать';

            buttonsDiv.appendChild(cancelBtn);
            buttonsDiv.appendChild(confirmBtn);
            content.appendChild(buttonsDiv);

            shadow.appendChild(content);

            document.body.appendChild(dialog);
            dialog.showModal();

            function cleanup() {
                dialog.close();
                dialog.remove();
                backdropStyle.remove();
            }

            confirmBtn.addEventListener('click', () => {
                const selected = shadow.querySelector(`input[name="${fieldName}"]:checked`);
                const selectedIdx = parseInt(selected.value);
                const remember = rememberCheckbox ? rememberCheckbox.checked : false;
                cleanup();
                resolve({
                    value: options[selectedIdx].value,
                    remember: remember
                });
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            dialog.addEventListener('cancel', (e) => {
                e.preventDefault();
                cleanup();
                resolve(null);
            });

            // Клик по backdrop — закрытие
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    cleanup();
                    resolve(null);
                }
            });
        });
    }

    // Основная функция
    async function copyPageLink() {
        let stage = 'инициализация';
        try {
            stage = 'получение метаданных';
            const metadata = getPageMetadata();
            let selectedUrl = metadata.url;
            let selectedTitle = metadata.title;
            let selectedUrlType = 'current';
            let selectedTitleType = 'document.title';

            // Получаем домен и загружаем предпочтения
            const domain = getDomainFromUrl(metadata.url);
            const preferences = domain ? getPreference(domain) : null;

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
                type: 'current',
                checked: true
            });
            seenUrls.add(normalizeUrlForComparison(currentUrl));

            // Canonical URL
            if (canonicalUrl && !seenUrls.has(normalizeUrlForComparison(canonicalUrl))) {
                urlOptions.push({
                    value: canonicalUrl,
                    label: 'Канонический URL',
                    source: 'link[rel="canonical"]',
                    type: 'canonical',
                    checked: false
                });
                seenUrls.add(normalizeUrlForComparison(canonicalUrl));
            }

            // OG URL
            if (ogUrl && !seenUrls.has(normalizeUrlForComparison(ogUrl))) {
                urlOptions.push({
                    value: ogUrl,
                    label: 'Open Graph URL',
                    source: 'og:url',
                    type: 'og:url',
                    checked: false
                });
                seenUrls.add(normalizeUrlForComparison(ogUrl));
            }

            // Показываем диалог выбора URL только если есть варианты
            stage = 'диалог выбора URL';
            if (urlOptions.length > 1) {
                // Проверяем, есть ли сохраненное предпочтение для URL
                if (preferences && preferences.urlPreference) {
                    // Ищем опцию с соответствующим типом
                    const preferredOption = urlOptions.find(opt => opt.type === preferences.urlPreference);
                    if (preferredOption) {
                        selectedUrl = preferredOption.value;
                        selectedUrlType = preferredOption.type;
                    } else {
                        // Предпочтение есть, но соответствующий URL недоступен - показываем диалог
                        const result = await showChoiceDialog('Выберите URL для копирования', urlOptions, 'urlChoice', true);

                        if (!result) {
                            showToast('Копирование отменено', 'error');
                            return;
                        }

                        selectedUrl = result.value;
                        // Находим тип выбранного URL
                        const selectedOption = urlOptions.find(opt => opt.value === result.value);
                        selectedUrlType = selectedOption ? selectedOption.type : 'current';

                        // Сохраняем предпочтение, если пользователь отметил чекбокс
                        if (result.remember && domain) {
                            saveUrlPreference(domain, selectedUrlType);
                        }
                    }
                } else {
                    // Нет сохраненного предпочтения - показываем диалог
                    const result = await showChoiceDialog('Выберите URL для копирования', urlOptions, 'urlChoice', true);

                    if (!result) {
                        showToast('Копирование отменено', 'error');
                        return;
                    }

                    selectedUrl = result.value;
                    // Находим тип выбранного URL
                    const selectedOption = urlOptions.find(opt => opt.value === result.value);
                    selectedUrlType = selectedOption ? selectedOption.type : 'current';

                    // Сохраняем предпочтение, если пользователь отметил чекбокс
                    if (result.remember && domain) {
                        saveUrlPreference(domain, selectedUrlType);
                    }
                }
            }

            // Собираем все варианты title
            const allTitles = [];

            // document.title
            if (metadata.documentTitle) {
                const normalizedDocTitle = normalizeTitle(metadata.documentTitle);
                const titleWithSiteName = addSiteNameToTitle(normalizedDocTitle, metadata.siteName);
                allTitles.push({
                    value: titleWithSiteName,
                    label: 'Заголовок страницы',
                    source: 'document.title',
                    type: 'document.title'
                });
            }

            // og:title
            if (metadata.ogTitle) {
                const normalizedOgTitle = normalizeTitle(metadata.ogTitle);
                const titleWithSiteName = addSiteNameToTitle(normalizedOgTitle, metadata.siteName);
                allTitles.push({
                    value: titleWithSiteName,
                    label: 'Open Graph заголовок',
                    source: 'og:title',
                    type: 'og:title'
                });
            }

            // Фильтруем: удаляем заголовки, которые полностью содержатся в других
            const titleOptions = [];
            const seenTitles = new Set();

            for (const title of allTitles) {
                // Проверяем, не содержится ли этот заголовок полностью в каком-то другом
                const isContained = allTitles.some(other =>
                    other !== title &&
                    other.value.toLowerCase().includes(title.value.toLowerCase())
                );

                if (!isContained && !seenTitles.has(title.value)) {
                    titleOptions.push({
                        value: title.value,
                        label: title.label,
                        source: title.source,
                        type: title.type,
                        checked: titleOptions.length === 0 // Первый добавленный будет checked
                    });
                    seenTitles.add(title.value);
                }
            }

            // Показываем диалог выбора title только если есть варианты
            stage = 'диалог выбора заголовка';
            if (titleOptions.length > 1) {
                // Проверяем, есть ли сохраненное предпочтение для заголовка
                if (preferences && preferences.titlePreference) {
                    // Ищем опцию с соответствующим типом
                    const preferredOption = titleOptions.find(opt => opt.type === preferences.titlePreference);
                    if (preferredOption) {
                        selectedTitle = preferredOption.value;
                        selectedTitleType = preferredOption.type;
                    } else {
                        // Предпочтение есть, но соответствующий заголовок недоступен - показываем диалог
                        const result = await showChoiceDialog('Выберите заголовок', titleOptions, 'titleChoice', true);

                        if (!result) {
                            showToast('Копирование отменено', 'error');
                            return;
                        }

                        selectedTitle = result.value;
                        // Находим тип выбранного заголовка
                        const selectedOption = titleOptions.find(opt => opt.value === result.value);
                        selectedTitleType = selectedOption ? selectedOption.type : 'document.title';

                        // Сохраняем предпочтение, если пользователь отметил чекбокс
                        if (result.remember && domain) {
                            saveTitlePreference(domain, selectedTitleType);
                        }
                    }
                } else {
                    // Нет сохраненного предпочтения - показываем диалог
                    const result = await showChoiceDialog('Выберите заголовок', titleOptions, 'titleChoice', true);

                    if (!result) {
                        showToast('Копирование отменено', 'error');
                        return;
                    }

                    selectedTitle = result.value;
                    // Находим тип выбранного заголовка
                    const selectedOption = titleOptions.find(opt => opt.value === result.value);
                    selectedTitleType = selectedOption ? selectedOption.type : 'document.title';

                    // Сохраняем предпочтение, если пользователь отметил чекбокс
                    if (result.remember && domain) {
                        saveTitlePreference(domain, selectedTitleType);
                    }
                }
            }

            // Обновляем metadata с выбранным title
            metadata.title = selectedTitle;

            // Генерируем HTML-ссылку
            stage = 'генерация HTML';
            const linkHtml = generateLink(selectedUrl, metadata);

            // Копируем в буфер обмена как HTML
            stage = 'копирование в буфер обмена';
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
            console.error(`Error at stage "${stage}":`, error);
            showToast(`Ошибка на этапе "${stage}": ${error.message}`, 'error');
        }
    }

    // Регистрируем команду в меню Violentmonkey
    GM_registerMenuCommand('Копировать ссылку на страницу', copyPageLink);

})();
