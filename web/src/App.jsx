import { useEffect, useState } from "react";

export const transportNames = {
  bus: "Автобус",
  tram: "Трамвай",
  trolleybus: "Троллейбус",
};

export default function App() {
  const [routes, setRoutes] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [transport, setTransport] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/routes", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Request failed");
        return response.json();
      })
      .then(setRoutes)
      .catch((error) => {
        if (error.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, []);

  // shortcut: filter the catalog locally; use API filters when pagination is needed.
  const filtered = routes?.filter(
    (route) =>
      route.number.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!transport || route.transport === transport),
  );

  return (
    <>
      <div className="catalog-banner">
        <h1>Маршруты</h1>
        <p>Остановки, направления и расписания городского транспорта.</p>
        <div className="banner-track" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="panel filters search-panel">
        <label>
          Номер маршрута
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={40}
            type="search"
            placeholder="Например, 1"
          />
        </label>
        <label>
          Вид транспорта
          <select
            value={transport}
            onChange={(event) => setTransport(event.target.value)}
          >
            <option value="">Все виды</option>
            {Object.entries(transportNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert">Не удалось загрузить маршруты. Обновите страницу.</p>
      ) : routes === null ? (
        <p role="status">Загрузка маршрутов…</p>
      ) : (
        <section aria-label="Результаты поиска" aria-live="polite">
          <p className="result-count">Найдено маршрутов: {filtered.length}</p>
          {filtered.length === 0 ? (
            <p className="panel empty-state">Маршруты не найдены.</p>
          ) : (
            <ul className="card-grid" role="list">
              {filtered.map((route) => (
                <li key={route.id}>
                  <a
                    className="collection-card route-card"
                    href={`#/routes/${route.id}`}
                    aria-label={`${transportNames[route.transport]} №${route.number}, ${route.start} → ${route.end}`}
                  >
                    <div className="route-card-heading">
                      <span className={`route-badge ${route.transport}`}>
                        {route.number}
                      </span>
                      <h2>{transportNames[route.transport]}</h2>
                    </div>
                    <div className="route-endpoints">
                      <span>{route.start}</span>
                      <span>{route.end}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
