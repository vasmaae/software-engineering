import { useState } from "react";
import { transportNames } from "./App.jsx";
import { Data, dayNames, directionLabel } from "./Public.jsx";

async function write(path, method, data) {
  const response = await fetch(path, {
    method,
    ...(data === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  if (!response.ok) throw new Error((await response.text()).trim());
}

function useAction() {
  const [feedback, setFeedback] = useState(null);
  const [pending, setPending] = useState(false);

  async function run(action, message) {
    setFeedback(null);
    setPending(true);
    try {
      await action();
      if (message) setFeedback({ message });
    } catch (error) {
      setFeedback({
        message: error.message || "Не удалось выполнить действие",
        error: true,
      });
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    run,
    notice: feedback && (
      <p role={feedback.error ? "alert" : "status"}>{feedback.message}</p>
    ),
  };
}

function Login({ onLogin }) {
  const action = useAction();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        action.run(async () => {
          await write("/api/session", "POST", data);
          onLogin();
        });
      }}
    >
      <fieldset disabled={action.pending}>
        <legend>Вход администратора</legend>
        <label>
          Логин
          <input name="username" required autoComplete="username" />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button>Войти</button>
      </fieldset>
      {action.notice}
    </form>
  );
}

function StopEditor({ stops, onChange, action }) {
  const [id, setId] = useState("");
  const stop = stops.find((item) => String(item.id) === id);
  return (
    <>
      <label>
        Остановка для редактирования
        <select value={id} onChange={(event) => setId(event.target.value)}>
          <option value="">Новая остановка</option>
          {stops.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.location}
            </option>
          ))}
        </select>
      </label>
      <form
        key={id}
        onSubmit={(event) => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(event.currentTarget));
          action.run(async () => {
            await write(
              stop ? `/api/admin/stops/${id}` : "/api/admin/stops",
              stop ? "PUT" : "POST",
              data,
            );
            onChange();
          }, "Остановка сохранена.");
        }}
      >
        <fieldset disabled={action.pending}>
          <legend>{stop ? "Изменить остановку" : "Добавить остановку"}</legend>
          <label>
            Название
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={stop?.name}
            />
          </label>
          <label>
            Расположение
            <input
              name="location"
              required
              maxLength={120}
              defaultValue={stop?.location}
            />
          </label>
          <div className="actions">
            <button>Сохранить остановку</button>
            {stop && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (window.confirm(`Удалить остановку «${stop.name}»?`)) {
                    action.run(async () => {
                      await write(`/api/admin/stops/${id}`, "DELETE");
                      onChange();
                    }, "Остановка удалена.");
                  }
                }}
              >
                Удалить остановку
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </>
  );
}

function StopsAdmin() {
  const [revision, setRevision] = useState(0);
  const action = useAction();
  return (
    <>
      <Data path={`/api/stops?revision=${revision}`}>
        {(stops) => (
          <StopEditor
            stops={stops}
            action={action}
            onChange={() => setRevision(revision + 1)}
          />
        )}
      </Data>
      {action.notice}
    </>
  );
}

function StopOrder({ direction, stops, initial = ["", ""] }) {
  const [ids, setIds] = useState(initial);
  const title = direction === 0 ? "Прямое направление" : "Обратное направление";
  return (
    <fieldset>
      <legend>{title}</legend>
      {ids.map((id, index) => (
        <label key={index}>
          {title} · остановка {index + 1}
          <select
            name={`direction${direction}`}
            value={id}
            required
            onChange={(event) => {
              setIds(
                ids.map((value, i) =>
                  i === index ? event.target.value : value,
                ),
              );
            }}
          >
            <option value="">Выберите остановку</option>
            {stops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name} — {stop.location}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={ids.length === 100}
          onClick={() => setIds([...ids, ""])}
        >
          Добавить позицию
        </button>
        <button
          type="button"
          className="secondary"
          disabled={ids.length === 2}
          onClick={() => setIds(ids.slice(0, -1))}
        >
          Убрать последнюю
        </button>
      </div>
    </fieldset>
  );
}

function RouteEditor({ route, stops, action, onChange }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const data = {
          number: values.get("number"),
          transport: values.get("transport"),
          directions: [0, 1].map((direction) =>
            values.getAll(`direction${direction}`).map(Number),
          ),
        };
        action.run(async () => {
          await write(
            route ? `/api/admin/routes/${route.id}` : "/api/admin/routes",
            route ? "PUT" : "POST",
            data,
          );
          onChange();
        }, "Маршрут сохранён.");
      }}
    >
      <fieldset disabled={action.pending}>
        <legend>{route ? "Изменить маршрут" : "Новый маршрут"}</legend>
        <label>
          Номер
          <input
            name="number"
            required
            maxLength={40}
            defaultValue={route?.number}
          />
        </label>
        <label>
          Вид транспорта
          <select name="transport" defaultValue={route?.transport}>
            {Object.entries(transportNames).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {[0, 1].map((direction) => (
          <StopOrder
            key={direction}
            direction={direction}
            stops={stops}
            initial={route?.directions
              .find((item) => item.direction === direction)
              ?.stops.map((stop) => String(stop.id))}
          />
        ))}
        <div className="actions">
          <button>Сохранить маршрут</button>
          {route && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить маршрут №${route.number} и его расписание?`,
                  )
                ) {
                  action.run(async () => {
                    await write(`/api/admin/routes/${route.id}`, "DELETE");
                    onChange();
                  }, "Маршрут удалён вместе с расписанием.");
                }
              }}
            >
              Удалить маршрут
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function RouteSelect({ routes, value, onChange, empty }) {
  return (
    <label>
      Выбор маршрута
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{empty}</option>
        {routes.map((route) => (
          <option key={route.id} value={route.id}>
            {transportNames[route.transport]} №{route.number}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoutesAdmin() {
  const [id, setId] = useState("");
  const [revision, setRevision] = useState(0);
  const action = useAction();
  function onChange() {
    setId("");
    setRevision(revision + 1);
  }
  return (
    <>
      <Data path={`/api/routes?revision=${revision}`}>
        {(routes) => (
          <RouteSelect
            routes={routes}
            value={id}
            onChange={setId}
            empty="Новый маршрут"
          />
        )}
      </Data>
      <Data path="/api/stops">
        {(stops) =>
          id ? (
            <Data path={`/api/routes/${id}`}>
              {(route) => (
                <RouteEditor
                  key={id}
                  route={route}
                  stops={stops}
                  action={action}
                  onChange={onChange}
                />
              )}
            </Data>
          ) : (
            <RouteEditor
              key={revision}
              stops={stops}
              action={action}
              onChange={onChange}
            />
          )
        }
      </Data>
      {action.notice}
    </>
  );
}

function ScheduleEditor({ route }) {
  const [direction, setDirection] = useState("0");
  const [day, setDay] = useState("weekday");
  const [revision, setRevision] = useState(0);
  const action = useAction();
  const suffix = `/routes/${route.id}/schedule?direction=${direction}&day=${day}`;
  return (
    <>
      <div className="filters">
        <label>
          Направление
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            {route.directions.map((item) => (
              <option key={item.direction} value={item.direction}>
                {directionLabel(item)}
              </option>
            ))}
          </select>
        </label>
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
      </div>
      <Data path={`/api${suffix}&revision=${revision}`}>
        {(times) => (
          <form
            key={suffix}
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(
                new FormData(event.currentTarget).get("times"),
              ).trim();
              action.run(async () => {
                await write(
                  `/api/admin${suffix}`,
                  "PUT",
                  value ? value.split(/[\s,;]+/) : [],
                );
                setRevision(revision + 1);
              }, "Расписание сохранено.");
            }}
          >
            <fieldset disabled={action.pending}>
              <legend>Плановое время отправления</legend>
              <label>
                Время в формате ЧЧ:ММ
                <textarea
                  name="times"
                  rows={4}
                  maxLength={1600}
                  defaultValue={times.join("\n")}
                />
              </label>
              <p>
                Разделяйте отправления пробелом или новой строкой. Пустое поле
                очищает расписание выбранного направления и типа дня.
              </p>
              <button>Сохранить расписание</button>
            </fieldset>
          </form>
        )}
      </Data>
      {action.notice}
    </>
  );
}

function SchedulesAdmin() {
  const [id, setId] = useState("");
  return (
    <>
      <Data path="/api/routes">
        {(routes) => (
          <RouteSelect
            routes={routes}
            value={id}
            onChange={setId}
            empty="Выберите маршрут"
          />
        )}
      </Data>
      {id && (
        <Data path={`/api/routes/${id}`}>
          {(route) => <ScheduleEditor key={id} route={route} />}
        </Data>
      )}
    </>
  );
}

export default function Admin() {
  const [revision, setRevision] = useState(0);
  const [section, setSection] = useState("stops");
  const action = useAction();
  function refresh() {
    setRevision(revision + 1);
  }
  return (
    <>
      <h1>Администрирование</h1>
      <Data path={`/api/session?revision=${revision}`}>
        {({ authenticated }) =>
          authenticated ? (
            <>
              <button
                className="secondary"
                disabled={action.pending}
                onClick={() =>
                  action.run(async () => {
                    await write("/api/session", "DELETE");
                    refresh();
                  })
                }
              >
                Выйти
              </button>
              <label className="section">
                Раздел администрирования
                <select
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                >
                  <option value="stops">Остановки</option>
                  <option value="routes">Маршруты</option>
                  <option value="schedules">Расписания</option>
                </select>
              </label>
              {section === "stops" ? (
                <StopsAdmin />
              ) : section === "routes" ? (
                <RoutesAdmin />
              ) : (
                <SchedulesAdmin />
              )}
            </>
          ) : (
            <Login onLogin={refresh} />
          )
        }
      </Data>
      {action.notice}
    </>
  );
}
