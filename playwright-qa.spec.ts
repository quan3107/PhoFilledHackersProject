import { expect, test } from "@playwright/test";

const baseURL = "http://localhost:3000";

test.describe("ETEST counselor dashboard QA", () => {
  test("desktop lead queue, detail flow, and invalid route", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Student Lead Queue" })
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Search by name or email...")
    ).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible();

    const desktopFit = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      titleBottom:
        document.querySelector("h1")?.getBoundingClientRect().bottom ?? 0,
      headerBottom:
        document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
      sidebarRight:
        document.querySelector("aside")?.getBoundingClientRect().right ?? 0,
    }));
    expect(desktopFit.titleBottom).toBeLessThan(desktopFit.innerHeight);
    expect(desktopFit.headerBottom).toBeLessThan(desktopFit.innerHeight);
    expect(desktopFit.sidebarRight).toBeGreaterThan(0);

    await page.screenshot({
      path: ".codex-artifacts/playwright/desktop-home.png",
      fullPage: false,
    });

    await page.getByPlaceholder("Search by name or email...").fill("Minh Anh");
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.getByPlaceholder("Search by name or email...").fill("");
    await page.getByRole("combobox").selectOption("Pre-Applicant");
    await expect(
      page.locator("tbody tr td:nth-child(4) span").first()
    ).toHaveText("Pre-Applicant");

    await page
      .getByPlaceholder("Search by name or email...")
      .fill("zzz-no-match");
    await expect(page.getByText("0 students")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);

    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Review Profile" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Nguyen Minh Anh" })
    ).toBeVisible();
    await expect(page.getByText("System Recommendations")).toBeVisible();
    await page.screenshot({
      path: ".codex-artifacts/playwright/desktop-student.png",
      fullPage: false,
    });

    await page.getByRole("link", { name: /Back to Lead Queue/i }).click();
    await expect(
      page.getByRole("heading", { name: "Student Lead Queue" })
    ).toBeVisible();

    await page.goto(`${baseURL}/student/999`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Student profile unavailable" })
    ).toBeVisible();
  });

  test("mobile layout keeps primary controls visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Student Lead Queue" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Lead Queue" })).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible();

    const mobileFit = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      navBottom:
        document.querySelector("nav")?.getBoundingClientRect().bottom ?? 0,
      titleBottom:
        document.querySelector("h1")?.getBoundingClientRect().bottom ?? 0,
      filterBottom:
        document.querySelector("select")?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(mobileFit.scrollWidth).toBeLessThanOrEqual(
      mobileFit.innerWidth + 20
    );
    expect(mobileFit.navBottom).toBeLessThan(mobileFit.innerHeight);
    expect(mobileFit.titleBottom).toBeLessThan(mobileFit.innerHeight);
    expect(mobileFit.filterBottom).toBeLessThan(mobileFit.innerHeight);

    await page.screenshot({
      path: ".codex-artifacts/playwright/mobile-home.png",
      fullPage: false,
    });

    await page.goto(`${baseURL}/student/1`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Nguyen Minh Anh" })
    ).toBeVisible();
    await expect(page.getByText("System Recommendations")).toBeVisible();
    await page.screenshot({
      path: ".codex-artifacts/playwright/mobile-student.png",
      fullPage: true,
    });
  });
});
