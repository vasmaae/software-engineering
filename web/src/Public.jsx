import { useEffect, useState } from "react";
import { transportNames } from "./App.jsx";

export function Data({ path, revision = 0, children }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(path, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => ({
        path,
        status: response.status,
        data: response.ok ? await response.json() : null,
      }))
      .then(setResult)
      .catch((error) => {
        if (error.name !== "AbortError") setResult({ path, status: 503 });
      });
    return () => controller.abort();
  }, [path, revision]);

  if (result?.path !== path) return <p role="status">Загрузка…</p>;
  if (result.status === 404) return <p>Запись не найдена.</p>;
  if (result.status !== 200)
    return <p role="alert">Не удалось загрузить данные. Обновите страницу.</p>;
  return children(result.data);
}

export const dayNames = { weekday: "Будни", weekend: "Выходные" };

export function directionLabel(item) {
  return `${item.stops[0].name} → ${item.stops.at(-1).name}`;
}

function Schedule({ id, direction, stop }) {
  const [day, setDay] = useState("weekday");
  return (
    <section className="panel detail-panel" aria-label="Расписание">
      <h2>Расписание</h2>
      <p className="muted">Плановое отправление: {stop}</p>
      <label>
        Тип дня
        <select value={day} onChange={(event) => setDay(event.target.value)}>
          {Object.entries(dayNames).map(([value, title]) => (
            <option key={value} value={value}>
              {title}
            </option>
          ))}
        </select>
      </label>
      <Data
        path={`/api/routes/${id}/schedule?direction=${direction}&day=${day}`}
      >
        {(times) =>
          times.length === 0 ? (
            <p className="empty-state">
              Для выбранного направления и типа дня расписания нет.
            </p>
          ) : (
            <ul className="departures" aria-label="Время отправления">
              {times.map((time) => (
                <li key={time}>
                  <time>{time}</time>
                </li>
              ))}
            </ul>
          )
        }
      </Data>
    </section>
  );
}

export function RoutePage({ id, initialDirection }) {
  const [direction, setDirection] = useState(initialDirection);
  return (
    <Data path={`/api/routes/${id}`}>
      {(route) => {
        const stops =
          route.directions.find((item) => item.direction === direction)
            ?.stops ?? [];
        return (
          <>
            <a className="breadcrumb" href="#/">
              ← Все маршруты
            </a>
            <div className="detail-heading">
              <span
                className={`route-badge ${route.transport}`}
                aria-hidden="true"
              >
                {route.number}
              </span>
              <h1>
                {transportNames[route.transport]} №{route.number}
              </h1>
            </div>
            <div className="panel direction-control">
              <label>
                Направление
                <select
                  value={direction}
                  onChange={(event) => setDirection(Number(event.target.value))}
                >
                  {route.directions.map((item) => (
                    <option key={item.direction} value={item.direction}>
                      {directionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="detail-grid">
              <section
                className="panel detail-panel"
                aria-labelledby="route-stops"
              >
                <h2 id="route-stops">Порядок остановок</h2>
                <ol className="ordered" role="list">
                  {stops.map((stop, index) => (
                    <li key={index}>
                      <a href={`#/stops/${stop.id}`}>{stop.name}</a>
                      <span>{stop.location}</span>
                    </li>
                  ))}
                </ol>
              </section>
              {stops.length > 0 && (
                <Schedule id={id} direction={direction} stop={stops[0].name} />
              )}
            </div>
          </>
        );
      }}
    </Data>
  );
}

export function StopCatalog() {
  const [query, setQuery] = useState("");
  return (
    <>
      <div className="page-heading">
        <h1>Остановки</h1>
      </div>
      <div className="panel search-panel">
        <label>
          Название остановки
          <input
            type="search"
            value={query}
            maxLength={100}
            placeholder="Например, Вокзал"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <Data path="/api/stops">
        {(stops) => {
          const found = stops.filter((stop) =>
            stop.name.toLowerCase().includes(query.trim().toLowerCase()),
          );
          return found.length === 0 ? (
            <p className="panel empty-state">Остановки не найдены.</p>
          ) : (
            <ul
              className="card-grid"
              aria-label="Найденные остановки"
              role="list"
            >
              {found.map((stop) => (
                <li key={stop.id}>
                  <a
                    className="collection-card stop-card"
                    href={`#/stops/${stop.id}`}
                    aria-label={`${stop.name} — ${stop.location}`}
                  >
                    <strong>{stop.name}</strong>
                    <span className="muted">{stop.location}</span>
                  </a>
                </li>
              ))}
            </ul>
          );
        }}
      </Data>
    </>
  );
}

export function StopPage({ id }) {
  return (
    <Data path={`/api/stops/${id}`}>
      {(stop) => (
        <>
          <a className="breadcrumb" href="#/stops">
            ← Все остановки
          </a>
          <div className="page-heading">
            <h1>{stop.name}</h1>
            <p className="muted">{stop.location}</p>
          </div>
          <section className="panel detail-panel" aria-labelledby="stop-routes">
            <h2 id="stop-routes">Маршруты через остановку</h2>
            {stop.routes.length === 0 ? (
              <p className="empty-state">
                Через эту остановку пока нет маршрутов.
              </p>
            ) : (
              <ul className="link-list" role="list">
                {stop.routes.map((route) => (
                  <li key={`${route.id}-${route.direction}`}>
                    <a
                      href={`#/routes/${route.id}?direction=${route.direction}`}
                    >
                      {transportNames[route.transport]} №{route.number} →{" "}
                      {route.towards}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Data>
  );
}
