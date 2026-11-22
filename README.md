# Tpax2000 — L2 Raid Boss Tracker

## Что умеет
- Общий вход по одному логину и паролю.
- Active Respawn, Upcoming Respawn (1–5 часов), All Bosses.
- Добавление, редактирование, удаление РБ.
- Mark killed записывает серверное время убийства.
- Автоматическое обновление списка каждые 5 секунд.
- PostgreSQL хранит общие данные для всех участников.

## Публикация на Render
1. Создайте новый GitHub-репозиторий и загрузите в него все файлы проекта.
2. В Render создайте PostgreSQL database. Скопируйте Internal Database URL.
3. В Render нажмите New → Web Service и подключите GitHub-репозиторий.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Добавьте Environment Variables:
   - `DATABASE_URL` — Internal Database URL из Render PostgreSQL
   - `SITE_USER` — общий логин
   - `SITE_PASSWORD` — общий пароль
   - `SESSION_SECRET` — длинная случайная строка
   - `KILLER_LABEL` — подпись, которая будет показываться в поле «Who»
   - `NODE_ENV` — `production`
7. Нажмите Deploy.

Важно: пока не загружайте реальные пароли в GitHub. Все секреты вводятся только в Environment Variables Render.
