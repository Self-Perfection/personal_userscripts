# Создание нового userscript
* Имя файла должно заканчиваться на .user.js
* Заполняй @downloadURL как https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/ + путь_к_файлу_в_репозитории

# Список действий при обновлении существующего userscript:
* **Обязательно** поднять @version (например, 1.3 → 1.4)
* **Обязательно** добавить строку @changelog с кратким описанием изменения
  * Формат: `// @changelog    X.X - Описание изменения`
  * Пример: `// @changelog    1.4 - Добавлена проверка минимальной длины description`
