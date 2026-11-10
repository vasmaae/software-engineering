import { useEffect, useState } from "react";
import { transportNames } from "./App.jsx";

export function Data({ path, children }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(path, { signal: controller.signal })
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
  }, [path]);

  if (result?.path !== path) return <p role="status">Загрузка…</p>;
  if (result.status === 404) return <p>Запись не найдена.</p>;
  if (result.status !== 200)
    return <p role="alert">Не удалось загрузить данные. Обновите страницу.</p>;
  return children(result.data);
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
            <h1>
              {transportNames[route.transport]} №{route.number}
            </h1>
            <label>
              Направление
              <select
                value={direction}
                onChange={(event) => setDirection(Number(event.target.value))}
              >
                {route.directions.map((item) => (
                  <option key={item.direction} value={item.direction}>
                    {item.stops[0].name} → {item.stops.at(-1).name}
                  </option>
                ))}
              </select>
            </label>
            <h2>Порядок остановок</h2>
            <ol className="ordered">
              {stops.map((stop, index) => (
                <li key={index}>
                  <a href={`#/stops/${stop.id}`}>{stop.name}</a>{" "}
                  <span>{stop.location}</span>
                </li>
              ))}
            </ol>
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
      <h1>Остановки</h1>
      <label>
        Название остановки
        <input
          type="search"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <Data path="/api/stops">
        {(stops) => {
          const found = stops.filter((stop) =>
            stop.name.toLowerCase().includes(query.trim().toLowerCase()),
          );
          return found.length === 0 ? (
            <p>Остановки не найдены.</p>
          ) : (
            <ul aria-label="Найденные остановки">
              {found.map((stop) => (
                <li key={stop.id}>
                  <div>
                    <a href={`#/stops/${stop.id}`}>{stop.name}</a>
                    <p>{stop.location}</p>
                  </div>
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
          <h1>{stop.name}</h1>
          <p>{stop.location}</p>
          <h2>Маршруты через остановку</h2>
          {stop.routes.length === 0 ? (
            <p>Через эту остановку пока нет маршрутов.</p>
          ) : (
            <ul>
              {stop.routes.map((route) => (
                <li key={`${route.id}-${route.direction}`}>
                  <a href={`#/routes/${route.id}?direction=${route.direction}`}>
                    {transportNames[route.transport]} №{route.number} →{" "}
                    {route.towards}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Data>
  );
}
