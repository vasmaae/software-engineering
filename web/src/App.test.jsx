import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("loads routes and combines number and transport filters", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          number: "1A",
          transport: "bus",
          start: "Вокзал",
          end: "Университет",
        },
        {
          id: 2,
          number: "1",
          transport: "tram",
          start: "Парк",
          end: "Площадь",
        },
        {
          id: 3,
          number: "5",
          transport: "trolleybus",
          start: "Музей",
          end: "Библиотека",
        },
      ],
    }),
  );
  render(<App />);
  expect(screen.getByRole("status").textContent).toContain("Загрузка");
  await screen.findByText("Найдено маршрутов: 3");
  fireEvent.change(screen.getByLabelText("Номер маршрута"), {
    target: { value: " 1a " },
  });
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Номер маршрута"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Вид транспорта"), {
    target: { value: "tram" },
  });
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByRole("list").textContent).toContain("Парк");
  fireEvent.change(screen.getByLabelText("Номер маршрута"), {
    target: { value: "999" },
  });
  expect(screen.getByText("Маршруты не найдены.")).toBeTruthy();
});

test("handles an empty catalog", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
  );
  render(<App />);
  expect(await screen.findByText("Маршруты не найдены.")).toBeTruthy();
});

test.each([{ ok: false }, new Error("Network failure")])(
  "shows API and network errors",
  async (result) => {
    vi.stubGlobal(
      "fetch",
      result instanceof Error
        ? vi.fn().mockRejectedValue(result)
        : vi.fn().mockResolvedValue(result),
    );
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Не удалось",
    );
  },
);

test("aborts the request on unmount", () => {
  let signal;
  vi.stubGlobal(
    "fetch",
    vi.fn((_, options) => {
      signal = options.signal;
      return new Promise(() => {});
    }),
  );
  const { unmount } = render(<App />);
  unmount();
  expect(signal.aborted).toBe(true);
});

test("does not show errors for an aborted request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
  );
  render(<App />);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(screen.queryByRole("alert")).toBeNull();
});
