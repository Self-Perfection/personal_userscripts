# Создание нового userscript
* Имя файла должно заканчиваться на .user.js
* Заполняй @downloadURL как https://raw.githubusercontent.com/Self-Perfection/gov.pt_enhancement_userscripts/refs/heads/main/ + путь_к_файлу_в_репозитории

# Версионирование userscript

Формат версий: X.Y — релизная, X.Y.Z — dev (в процессе работы).

## При каждом коммите с изменением userscript:
* **Обязательно** поднять @version по следующим правилам:
  * Если версия X.Y (2 компонента, релизная) → X.Y.1
  * Если версия X.Y.Z (3 компонента, dev) → X.Y.(Z+1)
* **Не** добавлять строку @changelog на этом этапе

## При релизе (пользователь подтвердил завершение работы):
* Поднять @version: X.Y.Z → X.(Y+1)
* Добавить строку @changelog для новой версии
  * Формат: `// @changelog    X.Y - Описание изменения`
  * Пример: `// @changelog    1.7 - Добавлена проверка минимальной длины description`

# При пуше изменений userscript в новую ветку:
* **Обязательно** показать пользователю ссылку для установки скрипта из этой ветки в markdown формате
  * Формат URL: `https://raw.githubusercontent.com/Self-Perfection/gov.pt_enhancement_userscripts/refs/heads/НАЗВАНИЕ_ВЕТКИ/ИМЯ_ФАЙЛА.user.js`
  * Формат markdown: `[Установить ИМЯ_СКРИПТА vX.X](https://raw.githubusercontent.com/...)`
  * Пример: `[Установить Infopedia Cross-Dictionary Links v1.7](https://raw.githubusercontent.com/Self-Perfection/gov.pt_enhancement_userscripts/refs/heads/claude/fix-infopedia-mobile-layout-01VsVJXNCfMrzveEsHBHF7ay/infopedia_cross_dictionary_links.user.js)`
  * Эта ссылка позволяет протестировать изменения до мержа в main
