import { expect, test } from "@playwright/test";

test("SGT-3/4/5/6/7/8: finds routes, directions, departures and linked stops", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Найдено маршрутов: 3")).toBeVisible();
  await page.getByLabel("Номер маршрута").fill("1");
  await page.getByLabel("Вид транспорта").selectOption("tram");
  await expect(page.getByText("Найдено маршрутов: 1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Трамвай №1" })).toBeVisible();
  await page.getByLabel("Номер маршрута").fill("999");
  await expect(page.getByText("Маршруты не найдены.")).toBeVisible();
  await page.getByLabel("Номер маршрута").fill("1");
  await page.getByLabel("Вид транспорта").selectOption("bus");
  await page.getByRole("link", { name: "Автобус №1" }).click();
  const order = page.locator("ol li a");
  await expect(order).toHaveText(["Вокзал", "Площадь Мира", "Университет"]);
  await expect(page.getByText("07:15")).toBeVisible();
  await page.getByLabel("Тип дня").selectOption("weekend");
  await expect(page.getByText("09:30")).toBeVisible();
  await expect(page.getByText("07:15")).toHaveCount(0);
  await page.getByLabel("Направление").selectOption("1");
  await expect(order).toHaveText(["Университет", "Площадь Мира", "Вокзал"]);
  await expect(page.getByText("Южная сторона")).toBeVisible();
  await expect(
    page.getByText("Для выбранного направления и типа дня расписания нет."),
  ).toBeVisible();
  await page.getByLabel("Тип дня").selectOption("weekday");
  await expect(page.getByText("07:45")).toBeVisible();
  await page.getByRole("link", { name: "Площадь Мира" }).click();
  await expect(
    page.getByRole("heading", { name: "Площадь Мира" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Автобус №1 → Университет" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Автобус №1 → Вокзал" }).click();
  await expect(page.getByLabel("Направление")).toHaveValue("1");
  await page.getByRole("link", { name: "Остановки", exact: true }).click();
  await page.getByLabel("Название остановки").fill("мИрА");
  await expect(page.getByRole("link", { name: "Площадь Мира" })).toHaveCount(2);
  await expect(page.getByText("Северная сторона")).toBeVisible();
  await expect(page.getByText("Южная сторона")).toBeVisible();
  await page.getByLabel("Название остановки").fill("нет такой остановки");
  await expect(page.getByText("Остановки не найдены.")).toBeVisible();
  await page.goto("/#/stops/2147483647");
  await expect(page.getByText("Запись не найдена.")).toBeVisible();
});

test("SGT-13: 360 px, visible focus and keyboard navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 760 });
  async function noOverflow() {
    expect(
      await page.locator("html").evaluate((html) => html.scrollWidth),
    ).toBeLessThanOrEqual(360);
  }
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Автобус №1" })).toBeVisible();
  await noOverflow();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Маршруты", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const stops = page.getByRole("link", { name: "Остановки", exact: true });
  await expect(stops).toBeFocused();
  await expect(stops).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Остановки", exact: true }),
  ).toBeVisible();
  await noOverflow();
  await page.goto("/#/routes/1");
  await expect(page.getByText("07:15")).toBeVisible();
  await noOverflow();
  await page.goto("/#/admin");
  await expect(page.getByLabel("Пароль")).toBeVisible();
  await noOverflow();
});

test("SGT-2/9/10/11/12/13: edits a catalog end to end, protects writes and logs out", async ({
  page,
  request,
}) => {
  const suffix = String(Date.now());
  const stopName = `Учебная остановка ${suffix}`;
  const changedStop = `Новая остановка ${suffix}`;
  const routeNumber = `Т${suffix}`;
  const updatedNumber = `${routeNumber}А`;
  const anonymous = await request.post("/api/admin/stops", {
    data: { name: stopName, location: "Север" },
  });
  expect(anonymous.status()).toBe(401);
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto("/#/admin");
  await page.getByLabel("Логин").fill("admin");
  await page.getByLabel("Пароль").fill("wrong-test-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("alert")).toHaveText("Неверный логин или пароль");

  // A failed login starts a short server cooldown. Poll through the public form.
  await page.getByLabel("Пароль").fill(process.env.E2E_ADMIN_PASSWORD);
  await expect(async () => {
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible({
      timeout: 650,
    });
  }).toPass({ timeout: 5000 });
  const sessions = await page.context().cookies();
  const session = sessions.find((cookie) => cookie.name === "sgt_session");
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Strict" });

  const setSection = (value) =>
    page.getByLabel("Раздел администрирования").selectOption(value);
  const selectRoute = (number) =>
    page
      .getByLabel("Выбор маршрута")
      .selectOption({ label: `Автобус №${number}` });
  const saveStop = () =>
    page.getByRole("button", { name: "Сохранить остановку" }).click();
  await page.getByLabel("Название", { exact: true }).fill(" ");
  await page.getByLabel("Расположение", { exact: true }).fill("Север");
  await saveStop();
  await expect(page.getByRole("alert")).toHaveText(
    "Укажите название и расположение остановки",
  );
  await page.getByLabel("Название", { exact: true }).fill(stopName);
  await saveStop();
  await expect(page.getByText("Остановка сохранена.")).toBeVisible();
  await page
    .getByLabel("Остановка для редактирования")
    .selectOption({ label: `${stopName} — Север` });
  await page.getByLabel("Название", { exact: true }).fill(changedStop);
  await saveStop();
  await expect(page.getByText("Остановка сохранена.")).toBeVisible();
  const stops = await (await request.get("/api/stops")).json();
  const created = stops.find((stop) => stop.name === changedStop);
  const station = stops.find((stop) => stop.name === "Вокзал");
  expect(created.location).toBe("Север");

  await setSection("routes");
  await page.getByLabel("Номер", { exact: true }).fill(routeNumber);
  const ordered = async (first, second) => {
    await page
      .getByLabel("Прямое направление · остановка 1")
      .selectOption(String(first));
    await page
      .getByLabel("Прямое направление · остановка 2")
      .selectOption(String(second));
    await page
      .getByLabel("Обратное направление · остановка 1")
      .selectOption(String(second));
    await page
      .getByLabel("Обратное направление · остановка 2")
      .selectOption(String(first));
  };
  await ordered(created.id, station.id);
  await page.getByRole("button", { name: "Сохранить маршрут" }).click();
  await expect(page.getByText("Маршрут сохранён.")).toBeVisible();
  await selectRoute(routeNumber);
  await expect(page.getByLabel("Прямое направление · остановка 1")).toHaveValue(
    String(created.id),
  );
  await page.getByLabel("Номер", { exact: true }).fill(updatedNumber);
  await ordered(station.id, created.id);
  await page.getByRole("button", { name: "Сохранить маршрут" }).click();
  await expect(page.getByText("Маршрут сохранён.")).toBeVisible();
  const [route] = await (
    await request.get(`/api/routes?q=${encodeURIComponent(updatedNumber)}`)
  ).json();
  expect(route.start).toBe("Вокзал");
  expect(route.end).toBe(changedStop);

  await setSection("stops");
  await page
    .getByLabel("Остановка для редактирования")
    .selectOption({ label: `${changedStop} — Север` });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить остановку" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Запись используется в маршруте",
  );

  await setSection("schedules");
  await selectRoute(updatedNumber);
  await page.getByLabel("Направление").selectOption("1");
  await page.getByLabel("Тип дня").selectOption("weekend");
  const times = page.getByLabel("Время в формате ЧЧ:ММ");
  await times.fill("25:90");
  await page.getByRole("button", { name: "Сохранить расписание" }).click();
  await expect(page.getByRole("alert")).toContainText("ЧЧ:ММ");
  await times.fill("10:10\n09:30");
  await page.getByRole("button", { name: "Сохранить расписание" }).click();
  await expect(page.getByText("Расписание сохранено.")).toBeVisible();
  expect(
    await page.locator("html").evaluate((html) => html.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.goto(`/#/routes/${route.id}?direction=1`);
  await page.getByLabel("Тип дня").selectOption("weekend");
  await expect(page.locator("time")).toHaveText(["09:30", "10:10"]);
  await expect(
    page.getByText(`Плановое отправление: ${changedStop}`),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Тип дня").selectOption("weekend");
  await expect(page.locator("time")).toHaveText(["09:30", "10:10"]);

  await page.goto("/#/admin");
  await setSection("routes");
  await selectRoute(updatedNumber);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Удалить маршрут" }).click();
  expect((await request.get(`/api/routes/${route.id}`)).status()).toBe(200);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить маршрут" }).click();
  await expect(
    page.getByText("Маршрут удалён вместе с расписанием."),
  ).toBeVisible();
  expect(
    (
      await request.get(
        `/api/routes/${route.id}/schedule?direction=1&day=weekend`,
      )
    ).status(),
  ).toBe(404);

  await setSection("stops");
  await page
    .getByLabel("Остановка для редактирования")
    .selectOption({ label: `${changedStop} — Север` });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить остановку" }).click();
  await expect(page.getByText("Остановка удалена.")).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeVisible();
  const afterLogout = await request.delete(`/api/admin/stops/${station.id}`, {
    headers: { Cookie: `sgt_session=${session.value}` },
  });
  expect(afterLogout.status()).toBe(401);
});
