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

  return (
    <main>
      <p className="eyebrow">Учебный проект SGT</p>
      <nav aria-label="Разделы справочника">
        <a href="#/">Маршруты</a>
        <a href="#/stops">Остановки</a>
        <a href="#/admin">Администрирование</a>
      </nav>
      <p className="notice">
        Учебные данные. Не используйте их для планирования поездок.
      </p>
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
  );
}
