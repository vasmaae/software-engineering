import { useSyncExternalStore } from "react";
import Admin from "./Admin.jsx";
import App from "./App.jsx";
import { RoutePage, StopCatalog, StopPage } from "./Public.jsx";

function subscribe(callback) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export default function Site() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const [path, search] = hash.slice(1).split("?");
  const match = /^\/(routes|stops)\/(\d+)$/.exec(path);
  const direction =
    new URLSearchParams(search).get("direction") === "1" ? 1 : 0;
  const current =
    path === "/admin"
      ? "admin"
      : match?.[1] || (path === "/stops" ? "stops" : "routes");

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            Городской транспорт
          </div>
          <nav aria-label="Разделы справочника">
            <a
              href="#/"
              aria-current={current === "routes" ? "page" : undefined}
            >
              Маршруты
            </a>
            <a
              href="#/stops"
              aria-current={current === "stops" ? "page" : undefined}
            >
              Остановки
            </a>
            <a
              href="#/admin"
              aria-current={current === "admin" ? "page" : undefined}
            >
              Администрирование
            </a>
          </nav>
        </div>
      </header>
      <main className="shell main-content">
        {path === "" || path === "/" ? (
          <App />
        ) : path === "/admin" ? (
          <Admin />
        ) : path === "/stops" ? (
          <StopCatalog />
        ) : match?.[1] === "routes" ? (
          <RoutePage key={hash} id={match[2]} initialDirection={direction} />
        ) : match?.[1] === "stops" ? (
          <StopPage id={match[2]} />
        ) : (
          <h1>Страница не найдена</h1>
        )}
      </main>
    </>
  );
}
