import { test, expect } from "@playwright/test";
import { fixture } from "./fixture";
test("empty real bank, responsive layout and offline shell", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "下一站，从容应考。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "下一站，从容应考。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "历年真题", exact: true }).click();
  await expect(page.getByText("这一段旅程，等待真题加入")).toBeVisible();
});
test("import, resume, no answer leakage, scoring, mistakes, backup and erratum", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "题库与设置", exact: true }).click();
  await page.getByLabel("导入题库").setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.getByText("导入成功，原有记录已保留。")).toBeVisible();
  await page.getByRole("button", { name: "历年真题", exact: true }).click();
  await page.getByRole("button", { name: "模拟考试", exact: true }).click();
  await page.getByRole("button", { name: "A TEST A" }).click();
  await page.reload();
  await page.getByRole("button", { name: "继续答题", exact: true }).click();
  await expect(page.getByRole("button", { name: "A TEST A" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("正确答案：", { exact: false })).toHaveCount(0);
  await expect(
    page.getByText("仅用于验证软件流程，不是真实考题解析。"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "结束并交卷", exact: true }).click();
  await page.getByRole("button", { name: "确认交卷", exact: true }).click();
  await expect(page.getByText("正确率 3%")).toBeVisible();
  await page.getByRole("button", { name: "错题本", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "29 道待复习错题" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "题库与设置", exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出学习备份" }).click();
  expect((await dl).suggestedFilename()).toBe("taxi-backup.json");
  const corrected = {
    ...fixture,
    errata: [
      {
        id: "correction",
        questionId: "test-1",
        answer: "B",
        reasonZh: "测试勘误",
        source: "test fixture",
        recordedAt: "2026-01-01T00:00:00Z",
      },
    ],
  };
  await page.getByLabel("导入题库").setInputFiles({
    name: "correction.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(corrected)),
  });
  await page.getByRole("button", { name: "考试记录", exact: true }).click();
  await page.getByRole("button", { name: /自动化测试专用/ }).click();
  await expect(page.getByText("你的答案：A · 正确答案：A")).toBeVisible();
});

test("restore backup, apply correction to new exam, review mistakes and random practice", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "题库与设置", exact: true }).click();
  const bank = {
    ...fixture,
    errata: [
      {
        id: "e",
        questionId: "test-1",
        answer: "B",
        reasonZh: "测试修正",
        source: "test fixture",
        recordedAt: "2026-01-01T00:00:00Z",
      },
    ],
  };
  await page.getByLabel("恢复备份").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ version: 1, bank, active: null, history: [] }),
    ),
  });
  await expect(page.getByText("备份已恢复。")).toBeVisible();
  await page.getByRole("button", { name: "历年真题", exact: true }).click();
  await page.getByRole("button", { name: "模拟考试", exact: true }).click();
  await page.getByRole("button", { name: "B TEST B" }).click();
  await page.getByRole("button", { name: "结束并交卷", exact: true }).click();
  await page.getByRole("button", { name: "确认交卷", exact: true }).click();
  await expect(page.getByText("你的答案：B · 正确答案：B")).toBeVisible();
  await expect(page.getByText(/已应用勘误：测试修正/)).toBeVisible();
  await page.getByRole("button", { name: "错题本", exact: false }).click();
  await page.getByRole("combobox").selectOption("5");
  await page.getByRole("button", { name: "开始复习", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "A TEST A" }).click();
    if (i < 4)
      await page.getByRole("button", { name: "下一题", exact: true }).click();
  }
  await page.getByRole("button", { name: "交卷评分", exact: true }).click();
  await page.getByRole("button", { name: "确认交卷", exact: true }).click();
  await page.getByRole("button", { name: "错题本", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "24 道待复习错题" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "随机练习", exact: true }).click();
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await expect(page.getByText("DOMANDA 1 / 5")).toBeVisible();
});

test("reject invalid import without losing existing data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "题库与设置", exact: true }).click();
  await page.getByLabel("导入题库").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("alert")).toContainText("导入失败");
  await expect(page.getByText("0 套 / 0 题 / 0 条勘误")).toBeVisible();
});
