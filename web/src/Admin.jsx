import { useEffect, useRef, useState } from "react";
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
    clear: () => setFeedback(null),
    notice: feedback && (
      <p className="feedback" role={feedback.error ? "alert" : "status"}>
        {feedback.message}
      </p>
    ),
  };
}

function Login({ onLogin }) {
  const action = useAction();
  return (
    <form
      className="panel login-form"
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

function EditorDialog({ title, action, onClose, children }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!action.pending) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="editor-title">{title}</h2>
        <button
          className="secondary"
          type="button"
          disabled={action.pending}
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>
      <div className="dialog-body">
        {children}
        {action.notice}
      </div>
    </dialog>
  );
}

function AdminTable({ title, columns, children }) {
  return (
    <div className="table-scroll" role="region" aria-label={title} tabIndex={0}>
      <table aria-label={title}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RowActions({ title, pending, onEdit, onDelete }) {
  return (
    <div className="row-actions">
      <button className="secondary" disabled={pending} onClick={onEdit}>
        Изменить
      </button>
      <button
        className="danger"
        disabled={pending}
        aria-label={`Удалить ${title}`}
        onClick={onDelete}
      >
        Удалить
      </button>
    </div>
  );
}

function StopEditor({ stop, onSave, action }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        action.run(async () => {
          await write(
            stop ? `/api/admin/stops/${stop.id}` : "/api/admin/stops",
            stop ? "PUT" : "POST",
            data,
          );
          onSave();
        }, "Остановка сохранена.");
      }}
    >
      <fieldset className="form-fields" disabled={action.pending}>
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
        </div>
      </fieldset>
    </form>
  );
}

function StopsAdmin() {
  const [editor, setEditor] = useState(null);
  const [revision, setRevision] = useState(0);
  const action = useAction();

  function open(stop) {
    action.clear();
    setEditor({ stop });
  }

  function refresh() {
    setRevision((value) => value + 1);
  }

  const isOpen = editor !== null;

  return (
    <>
      <div className="table-heading">
        <h2>Остановки</h2>
        <button disabled={action.pending} onClick={() => open()}>
          Добавить остановку
        </button>
      </div>
      {!isOpen && action.notice}
      <Data path="/api/stops" revision={revision}>
        {(stops) =>
          stops.length === 0 ? (
            <p className="empty-state">В справочнике пока нет остановок.</p>
          ) : (
            <AdminTable
              title="Список остановок"
              columns={["Название", "Расположение", "Действия"]}
            >
              {stops.map((stop) => (
                <tr key={stop.id}>
                  <th scope="row">{stop.name}</th>
                  <td>{stop.location}</td>
                  <td>
                    <RowActions
                      title={`остановку «${stop.name}»`}
                      pending={action.pending}
                      onEdit={() => open(stop)}
                      onDelete={() => {
                        if (
                          window.confirm(`Удалить остановку «${stop.name}»?`)
                        ) {
                          action.run(async () => {
                            await write(
                              `/api/admin/stops/${stop.id}`,
                              "DELETE",
                            );
                            refresh();
                          }, "Остановка удалена.");
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </AdminTable>
          )
        }
      </Data>
      {isOpen && (
        <EditorDialog
          title={editor.stop ? "Изменить остановку" : "Добавить остановку"}
          action={action}
          onClose={() => setEditor(null)}
        >
          <StopEditor
            stop={editor.stop}
            action={action}
            onSave={() => {
              setEditor(null);
              refresh();
            }}
          />
        </EditorDialog>
      )}
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
      <fieldset className="form-fields" disabled={action.pending}>
        <div className="form-columns">
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
        </div>
        <div className="form-columns">
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
        </div>
        <div className="actions">
          <button>Сохранить маршрут</button>
        </div>
      </fieldset>
    </form>
  );
}

function RoutesAdmin() {
  const [id, setId] = useState(null);
  const [revision, setRevision] = useState(0);
  const action = useAction();

  function open(routeID) {
    action.clear();
    setId(routeID);
  }

  function refresh() {
    setRevision((value) => value + 1);
  }

  function editor(stops, route) {
    return (
      <RouteEditor
        route={route}
        stops={stops}
        action={action}
        onChange={() => {
          setId(null);
          refresh();
        }}
      />
    );
  }

  return (
    <>
      <div className="table-heading">
        <h2>Маршруты</h2>
        <button disabled={action.pending} onClick={() => open(0)}>
          Добавить маршрут
        </button>
      </div>
      {id === null && action.notice}
      <Data path="/api/routes" revision={revision}>
        {(routes) =>
          routes.length === 0 ? (
            <p className="empty-state">В справочнике пока нет маршрутов.</p>
          ) : (
            <AdminTable
              title="Список маршрутов"
              columns={["Маршрут", "Конечные остановки", "Действия"]}
            >
              {routes.map((route) => (
                <tr key={route.id}>
                  <th scope="row">
                    {transportNames[route.transport]} №{route.number}
                  </th>
                  <td>
                    {route.start} → {route.end}
                  </td>
                  <td>
                    <RowActions
                      title={`маршрут №${route.number}`}
                      pending={action.pending}
                      onEdit={() => open(route.id)}
                      onDelete={() => {
                        if (
                          window.confirm(
                            `Удалить маршрут №${route.number} и его расписание?`,
                          )
                        ) {
                          action.run(async () => {
                            await write(
                              `/api/admin/routes/${route.id}`,
                              "DELETE",
                            );
                            refresh();
                          }, "Маршрут удалён вместе с расписанием.");
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </AdminTable>
          )
        }
      </Data>
      {id !== null && (
        <EditorDialog
          title={id ? "Изменить маршрут" : "Добавить маршрут"}
          action={action}
          onClose={() => setId(null)}
        >
          <Data path="/api/stops">
            {(stops) =>
              id ? (
                <Data path={`/api/routes/${id}`}>
                  {(route) => editor(stops, route)}
                </Data>
              ) : (
                editor(stops)
              )
            }
          </Data>
        </EditorDialog>
      )}
    </>
  );
}

function ScheduleEditor({ route, action }) {
  const [direction, setDirection] = useState("0");
  const [day, setDay] = useState("weekday");
  const [revision, setRevision] = useState(0);
  const suffix = `/routes/${route.id}/schedule?direction=${direction}&day=${day}`;
  return (
    <>
      <fieldset className="form-columns form-fields" disabled={action.pending}>
        <label>
          Направление
          <select
            value={direction}
            onChange={(event) => {
              action.clear();
              setDirection(event.target.value);
            }}
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
          <select
            value={day}
            onChange={(event) => {
              action.clear();
              setDay(event.target.value);
            }}
          >
            {Object.entries(dayNames).map(([value, title]) => (
              <option key={value} value={value}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
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
            <fieldset className="form-fields" disabled={action.pending}>
              <label>
                Время в формате ЧЧ:ММ
                <textarea
                  name="times"
                  rows={4}
                  maxLength={1600}
                  defaultValue={times.join("\n")}
                />
              </label>
              <p className="muted">
                Разделяйте отправления пробелом или новой строкой. Пустое поле
                очищает расписание выбранного направления и типа дня.
              </p>
              <button>Сохранить расписание</button>
            </fieldset>
          </form>
        )}
      </Data>
    </>
  );
}

function SchedulesAdmin() {
  const [selected, setSelected] = useState(null);
  const action = useAction();

  return (
    <>
      <div className="table-heading">
        <h2>Расписания</h2>
      </div>
      <Data path="/api/routes">
        {(routes) =>
          routes.length === 0 ? (
            <p className="empty-state">
              Добавьте маршрут, чтобы составить расписание.
            </p>
          ) : (
            <AdminTable
              title="Расписания маршрутов"
              columns={["Маршрут", "Конечные остановки", "Действия"]}
            >
              {routes.map((route) => (
                <tr key={route.id}>
                  <th scope="row">
                    {transportNames[route.transport]} №{route.number}
                  </th>
                  <td>
                    {route.start} → {route.end}
                  </td>
                  <td>
                    <button
                      className="secondary"
                      aria-label="Изменить расписание"
                      onClick={() => {
                        action.clear();
                        setSelected(route);
                      }}
                    >
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )
        }
      </Data>
      {selected && (
        <EditorDialog
          title={`Расписание · ${transportNames[selected.transport]} №${selected.number}`}
          action={action}
          onClose={() => setSelected(null)}
        >
          <Data path={`/api/routes/${selected.id}`}>
            {(route) => <ScheduleEditor route={route} action={action} />}
          </Data>
        </EditorDialog>
      )}
    </>
  );
}

const tabs = [
  { id: "stops", label: "Остановки", Panel: StopsAdmin },
  { id: "routes", label: "Маршруты", Panel: RoutesAdmin },
  { id: "schedules", label: "Расписания", Panel: SchedulesAdmin },
];

export default function Admin() {
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(0);
  const action = useAction();
  const { id, Panel } = tabs[active];

  function refresh() {
    setRevision((value) => value + 1);
  }

  function moveTab(event, index) {
    const destinations = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    const next = destinations[event.key];
    setActive(next);
    document.getElementById(`admin-tab-${tabs[next].id}`).focus();
  }

  return (
    <Data path={`/api/session?revision=${revision}`}>
      {({ authenticated }) => (
        <>
          <div className="admin-heading">
            <h1>Администрирование</h1>
            {authenticated && (
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
            )}
          </div>
          {authenticated ? (
            <div className="panel admin-panel">
              <div
                className="admin-tabs"
                role="tablist"
                aria-label="Управление справочником"
              >
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`admin-tab-${tab.id}`}
                    aria-selected={active === index}
                    aria-controls="admin-tab-panel"
                    tabIndex={active === index ? 0 : -1}
                    onClick={() => setActive(index)}
                    onKeyDown={(event) => moveTab(event, index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <section
                id="admin-tab-panel"
                className="admin-tab-panel"
                role="tabpanel"
                aria-labelledby={`admin-tab-${id}`}
              >
                <Panel />
              </section>
            </div>
          ) : (
            <Login onLogin={refresh} />
          )}
          {action.notice}
        </>
      )}
    </Data>
  );
}
