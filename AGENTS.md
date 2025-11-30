# Создание нового userscript
* Имя файла должно заканчиваться на .user.js
* Заполняй @downloadURL как https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/ + путь_к_файлу_в_репозитории

# Список действий при обновлении существующего userscript:
* **Обязательно** поднять @version (например, 1.3 → 1.4)
* **Обязательно** добавить строку @changelog с кратким описанием изменения
  * Формат: `// @changelog    X.X - Описание изменения`
  * Пример: `// @changelog    1.4 - Добавлена проверка минимальной длины description`

# При пуше изменений userscript в новую ветку:
* **Обязательно** показать пользователю ссылку для установки скрипта из этой ветки
  * Формат: `https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/НАЗВАНИЕ_ВЕТКИ/ИМЯ_ФАЙЛА.user.js`
  * Пример: `https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/claude/fix-infopedia-mobile-layout-01VsVJXNCfMrzveEsHBHF7ay/infopedia_cross_dictionary_links.user.js`
  * Эта ссылка позволяет протестировать изменения до мержа в main
