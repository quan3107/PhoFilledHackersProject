import { expect, test } from "@playwright/test";

test.describe("ETEST student onboarding QA", () => {
  test("desktop smoke keeps the onboarding shell usable", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

    await page.goto("/qa-smoke", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "ETEST Compass Guide" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "EN", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "VI", exact: true })
    ).toBeVisible();

    const desktopFit = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      headerBottom:
        document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
      headingBottom:
        document.querySelector("h2")?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(desktopFit.scrollWidth).toBeLessThanOrEqual(
      desktopFit.innerWidth + 20
    );
    expect(desktopFit.headerBottom).toBeLessThan(desktopFit.innerHeight);
    expect(desktopFit.headingBottom).toBeLessThan(desktopFit.innerHeight);

    await page.screenshot({
      path: ".codex-artifacts/playwright/desktop-qa-smoke.png",
      fullPage: false,
    });
  });

  test("mobile smoke keeps primary controls visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/qa-smoke", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "ETEST Compass Guide" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "EN", exact: true })
    ).toBeVisible();

    const mobileFit = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      headerBottom:
        document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
      headingBottom:
        document.querySelector("h2")?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(mobileFit.scrollWidth).toBeLessThanOrEqual(640);
    expect(mobileFit.headerBottom).toBeLessThan(mobileFit.innerHeight);
    expect(mobileFit.headingBottom).toBeLessThan(mobileFit.innerHeight);

    await page.screenshot({
      path: ".codex-artifacts/playwright/mobile-qa-smoke.png",
      fullPage: false,
    });
  });
});
