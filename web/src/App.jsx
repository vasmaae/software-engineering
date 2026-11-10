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

  // shortcut: filter the small demo catalog locally; use API filters when pagination is needed.
  const filtered = routes?.filter(
    (route) =>
      route.number.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!transport || route.transport === transport),
  );

  return (
    <>
      <h1>Городской транспорт</h1>
      <p>Найдите маршрут и посмотрите его конечные остановки.</p>
      <div className="filters">
        <label>
          Номер маршрута
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={40}
            type="search"
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
          <p>Найдено маршрутов: {filtered.length}</p>
          {filtered.length === 0 ? (
            <p>Маршруты не найдены.</p>
          ) : (
            <ul>
              {filtered.map((route) => (
                <li key={route.id}>
                  <span className="number">{route.number}</span>
                  <div>
                    <h2>
                      <a href={`#/routes/${route.id}`}>
                        {transportNames[route.transport]} №{route.number}
                      </a>
                    </h2>
                    <p>
                      {route.start} → {route.end}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
