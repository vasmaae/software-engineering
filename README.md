# Справочник городского транспорта

Учебное web-приложение на React, Go и PostgreSQL. Посетитель ищет маршруты и
остановки, смотрит порядок остановок по направлениям и время отправления по типу
дня. Администратор после входа добавляет, редактирует и удаляет справочные данные.
Начальные данные вымышлены и не предназначены для планирования поездок.

[Задачи SGT](https://vasmaae.youtrack.cloud/issues/SGT) ·
[Правила разработки](docs/contributing.md) · [Прототип ЛР6](docs/prototype.md) ·
[Тестирование](docs/testing.md) · [Метрики](docs/quality.md)

## Запуск на компьютере

Нужны Docker Engine и Docker Compose. Скопируйте `.env.example` в `.env`,
установите собственный `POSTGRES_PASSWORD` и запустите:

```sh
docker compose up --build -d --wait
```

Откройте <http://localhost:8080>. Порт доступен только с этого компьютера.
Проверка API и PostgreSQL: `curl -f http://localhost:8080/api/health` (HTTP 204).
Для отдельной чистой демонстрации можно выбрать другой проект и порт:
`SGT_PORT=8081 docker compose -p sgt-demo up --build -d --wait`.

### Вход администратора

Логин — `admin`. Чтобы включить вход, сгенерируйте хеш для нового пароля
(12–256 байт) через Go 1.27. Команды для Bash или Zsh:

```sh
printf 'Пароль администратора: '
read -rs sgt_admin_secret
printf '\n'
printf '%s\n' "$sgt_admin_secret" | go run ./cmd/adminhash
unset sgt_admin_secret
```

Запишите выведенный хеш в `ADMIN_PASSWORD_HASH` внутри `.env` и выполните
`docker compose up -d api`. При пустом хеше вход отключён. Пароль храните отдельно,
файл `.env` не добавляйте в Git. Форма входа — раздел «Администрирование».
Сеанс действует до двух часов; перезапуск API завершает его. Для публикации за
TLS используйте `SECURE_COOKIE=true` и сохраняйте внешний Host при проксировании.
Штатный сценарий сдачи — локальный HTTP на loopback.

### Данные и обновление

При первом запуске пустого тома PostgreSQL выполняет `db/*.sql` по порядку.
`docker compose down` останавливает сервисы и сохраняет данные; флаг `-v` удаляет
том. Если используется том от **v0.1.1** (в нём применена только `001`), сначала
сохраните резервную копию, затем примените `002` и `003` вручную:

```sh
docker compose up -d --wait db
docker compose exec -T db pg_dump -U sgt --no-owner --no-privileges sgt > sgt-before-upgrade.sql
docker compose exec -T db psql -U sgt -d sgt -v ON_ERROR_STOP=1 < db/002_network.sql &&
  docker compose exec -T db psql -U sgt -d sgt -v ON_ERROR_STOP=1 < db/003_timetable.sql
docker compose up --build -d --wait
```

При обновлении с прототипа ЛР6 примените только `003`. Миграции транзакционные и
выполняются один раз. Справочник не обращается к внешним транспортным сервисам.

## Проверка и сборка

Установите Go 1.27, Node.js 24+ и PostgreSQL 18. Выполните `make setup`.
Для тестов используйте отдельную пустую БД, применив `db/*.sql` в порядке номеров:

```sh
for migration in db/*.sql; do
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" || break
done
make check
```

`make check` запускает форматирование, статический анализ, тесты Go с реальной
PostgreSQL, тесты React, метрики и сборку. Для браузерных тестов нужен Chromium
Playwright; команды и матрица критериев — в [руководстве](docs/testing.md).

## API

- `GET /api/health` — доступность PostgreSQL.
- `GET /api/routes?q=1&transport=tram` — каталог, фильтры необязательны.
- `GET /api/routes/{id}` — маршрут, направления и порядок остановок.
- `GET /api/routes/{id}/schedule?direction=0&day=weekday` — время отправления;
  направление `0` или `1`, тип дня `weekday` или `weekend`.
- `GET /api/stops`, `GET /api/stops/{id}` — остановки и проходящие направления.
- `GET/POST/DELETE /api/session` — состояние, вход, выход.
- `POST/PUT/DELETE /api/admin/stops` и `/api/admin/routes` — изменения справочника
  (`PUT` и `DELETE` принимают ID в пути); `PUT /api/admin/routes/{id}/schedule` —
  замена списка отправлений для указанного направления и типа дня.
  API проверяет сеанс и отклоняет межсайтовые изменяющие запросы.

## Релиз

Исходники, архив для Linux x86-64 и его SHA-256 доступны в
[GitHub Releases](https://github.com/vasmaae/software-engineering/releases).
Версии `v0.1.x` — ранние сборки ЛР5; `v1.0.0` — итоговый учебный выпуск.
Проверка и распаковка:

```sh
sha256sum -c sgt-linux-amd64.tar.gz.sha256
tar -xzf sgt-linux-amd64.tar.gz
```

Архив содержит `api`, `web/`, `db/` и `sgt-demo.sql` — снимок учебной БД.
Для запуска бинарника создайте пустую PostgreSQL 18, восстановите снимок командой
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sgt-demo.sql` и запустите
`DATABASE_URL="$DATABASE_URL" WEB_ROOT=web ./api`. Доступ: <http://localhost:8080>.
Используйте **либо** восстановление снимка, **либо** SQL-миграции. Для другого
процессора или ОС собирайте из исходников через Compose.
