import { expect, test } from "@playwright/test";

test.describe("Aegis-Omega Autonomous AppSec & Patch Engineering E2E", () => {
  test("verifies strict route separation, Product vs. Ops isolation, Tri-Mode Remediation, Dynamic Target Artifacts, and Clean Reset", async ({
    page,
    request,
  }) => {
    // Ensure clean baseline before starting E2E
    const initReset = await request.post("/api/modules/aegis/reset");
    expect(initReset.ok()).toBeTruthy();

    await page.goto("/");

    // 1. Verify Landing Route (`/`) strict isolation: Landing Hero is visible, Main Dashboard is NOT rendered
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /Aegis-Omega/i }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("aegis-landing-hero")).toBeVisible();
    await expect(
      page.getByTestId("project-card-aegis-whitebox-github"),
    ).toBeHidden();
    await expect(page.getByTestId("ops-infrastructure-strip")).toHaveCount(0);

    // 2. Navigate to Security Console (`/app/projects`) and verify Landing Hero is NOT rendered
    await page.getByTestId("product-nav-projects").click();
    await expect(page).toHaveURL(/\/app\/projects$/);
    await expect(page.getByTestId("aegis-landing-hero")).toBeHidden();

    // 3. Verify all 3 canonical seed targets exist in sidebar
    const whiteboxCard = page.getByTestId("project-card-aegis-whitebox-github");
    const urlShieldCard = page.getByTestId(
      "project-card-aegis-blackbox-url-shield",
    );
    const binaryElfCard = page.getByTestId(
      "project-card-aegis-blackbox-binary-elf",
    );

    await expect(whiteboxCard).toBeVisible();
    await expect(urlShieldCard).toBeVisible();
    await expect(binaryElfCard).toBeVisible();

    // -------------------------------------------------------------------------
    // Target 1: White-Box GitHub Repo -> SSE 4-stage Scan + Mode 1 Git PR & Diff
    // -------------------------------------------------------------------------
    await whiteboxCard.click();

    await page.getByTestId("stream-scan-btn").click();
    await expect(
      page.getByText(/4-stage Red-to-Green autonomous verification completed/i),
    ).toBeVisible({ timeout: 25000 });

    await page.getByTestId("remediation-tab-git-pr").click();
    await expect(page).toHaveURL(/\/app\/remediation$/);
    await expect(page.getByTestId("aegis-landing-hero")).toBeHidden();
    await expect(page.getByTestId("code-diff-viewer")).toBeVisible();
    await expect(page.getByTestId("code-diff-viewer")).toContainText(
      "crypto.timingSafeEqual",
    );

    await page.getByTestId("create-pr-btn").click();
    await expect(page.getByTestId("pr-created-banner")).toBeVisible();
    await expect(page.getByTestId("pr-created-banner")).toContainText(
      "PR Created:",
    );

    const patchDownloadResp = await request.get(
      "/api/modules/aegis/projects/aegis-whitebox-github/patch-download",
    );
    expect(patchDownloadResp.status()).toBe(200);
    const patchBody = await patchDownloadResp.text();
    expect(patchBody).toContain("--- a/");
    expect(patchBody).toContain("+++ b/");

    await page.screenshot({
      path: "playwright-aegis-mode1-whitebox.png",
      fullPage: true,
    });

    // -------------------------------------------------------------------------
    // Target 3: No-Source ELF Binary -> Mode 2 Binary Trampoline & Download
    // -------------------------------------------------------------------------
    await binaryElfCard.click();
    await page.getByTestId("remediation-tab-binary-patch").click();
    await expect(page).toHaveURL(/\/app\/remediation$/);

    await expect(page.getByTestId("binary-patch-table")).toBeVisible();
    await expect(page.getByTestId("binary-patch-table")).toContainText(
      "0x004018b0",
    );
    await expect(page.getByTestId("download-binary-link")).toBeVisible();

    const binDownloadResp = await request.get(
      "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-download",
    );
    expect(binDownloadResp.status()).toBe(200);
    const binBytes = await binDownloadResp.body();
    expect(binBytes.length).toBeGreaterThan(64);
    expect(binBytes[0]).toBe(0x7f);
    expect(binBytes[1]).toBe(0x45);
    expect(binBytes[2]).toBe(0x4c);
    expect(binBytes[3]).toBe(0x46);

    await page.screenshot({
      path: "playwright-aegis-mode2-binary.png",
      fullPage: true,
    });

    // -------------------------------------------------------------------------
    // Target 2: URL + DNS TXT Gate -> Mode 3 Edge Route Shield & Verification Sandbox
    // -------------------------------------------------------------------------
    await urlShieldCard.click();
    await page.getByTestId("remediation-tab-route-shield").click();
    await expect(page).toHaveURL(/\/app\/remediation$/);
    await expect(page.getByTestId("toggle-shield-btn")).toBeVisible();

    await page.getByTestId("remediation-tab-verification-ops").click();
    await expect(page).toHaveURL(/\/app\/verification-sandbox$/);
    await expect(page.getByTestId("aegis-landing-hero")).toBeHidden();

    // Test attack while shield is ON -> BLOCKED_GREEN (HTTP 403)
    await page.getByTestId("test-attack-btn").click();
    await expect(page.getByTestId("attack-result-card")).toBeVisible();
    await expect(page.getByTestId("attack-result-card")).toContainText(
      "BLOCKED_GREEN",
    );
    await expect(page.getByTestId("attack-result-card")).toContainText(
      "HTTP 403",
    );

    // Toggle shield OFF -> test attack -> EXPLOITED_RED (HTTP 500)
    await page.getByTestId("toggle-shield-btn").click();
    await expect(page.getByTestId("toggle-shield-btn")).toContainText(
      "Edge Shield OFF",
    );

    await page.getByTestId("test-attack-btn").click();
    await expect(page.getByTestId("attack-result-card")).toContainText(
      "EXPLOITED_RED",
    );

    // Re-enable shield ON -> verify BLOCKED_GREEN restored
    await page.getByTestId("toggle-shield-btn").click();
    await expect(page.getByTestId("toggle-shield-btn")).toContainText(
      "Edge Shield ON",
    );
    await page.getByTestId("test-attack-btn").click();
    await expect(page.getByTestId("attack-result-card")).toContainText(
      "BLOCKED_GREEN",
    );

    await page.screenshot({
      path: "playwright-aegis-mode3-shield.png",
      fullPage: true,
    });

    // -------------------------------------------------------------------------
    // Custom Target Onboarding on Dedicated `/onboarding` Route
    // -------------------------------------------------------------------------
    await page.getByTestId("toggle-new-project-btn").click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByTestId("project-card-aegis-whitebox-github"),
    ).toBeHidden();
    await expect(page.getByTestId("aegis-landing-hero")).toBeHidden();

    await page.getByTestId("intake-mode-url-dns").click();
    await page
      .getByTestId("new-project-name-input")
      .fill("korea-pay-webhook-edge");
    await page
      .getByTestId("new-project-url-input")
      .fill("https://pay.korea-fintech.kr/v3/settlement/callback");
    await page.getByTestId("create-project-submit-btn").click();

    await expect(page).toHaveURL(/\/app\/projects$/);
    await expect(
      page.getByText(/Created project korea-pay-webhook-edge/i),
    ).toBeVisible();

    // Verify DNS gate blocks scan before verification, then unlocks after verification
    await expect(page.getByTestId("dns-verify-card")).toBeVisible();
    await page.getByTestId("dns-verify-btn").click();
    await expect(page.getByTestId("dns-verify-card")).toBeHidden();

    // Run deterministic scan on custom URL project and verify dynamic target artifacts
    await page.getByTestId("rescan-btn").click();
    await expect(
      page.getByText(
        /Completed deterministic security scan for korea-pay-webhook-edge/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/\/v3\/settlement\/callback/).first(),
    ).toBeVisible();

    // -------------------------------------------------------------------------
    // Dedicated Ops Route (`/ops`) Isolation & Clean Reset
    // -------------------------------------------------------------------------
    await page.getByTestId("toggle-ops-console-btn").click();
    await expect(page).toHaveURL(/\/ops$/);
    await expect(page.getByTestId("aegis-ops-console-view")).toBeVisible();
    await expect(page.getByTestId("ops-infrastructure-strip")).toBeVisible();
    await expect(
      page.getByTestId("project-card-aegis-whitebox-github"),
    ).toBeHidden();

    // Return to Product Workspace (`/app/projects`) and reset demo baseline
    await page.getByTestId("toggle-ops-console-btn").click();
    await expect(page).toHaveURL(/\/app\/projects$/);
    await expect(page.getByTestId("ops-infrastructure-strip")).toHaveCount(0);

    await page.getByTestId("reset-demo-projects-btn").click();
    await expect(
      page.getByText(/Reset canonical 3 demo projects/i),
    ).toBeVisible();
  });

  test("verifies the complete 8-Step User Scenario across isolated routes: / -> /signup -> /onboarding -> /app/projects -> /app/remediation -> /app/automation-sdk -> /app/safe-delivery", async ({
    page,
    request,
  }) => {
    const initReset = await request.post("/api/modules/aegis/reset");
    expect(initReset.ok()).toBeTruthy();

    // Step 1: Visit Landing Hero (`/`) & verify Main Dashboard is NOT rendered
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("aegis-landing-hero")).toBeVisible();
    await expect(
      page.getByTestId("project-card-aegis-whitebox-github"),
    ).toBeHidden();

    await page.screenshot({
      path: "playwright-aegis-hero.png",
      fullPage: true,
    });

    // Step 2: Click Start -> Navigate to `/signup` & complete Enterprise Signup
    await page.getByTestId("hero-start-btn").click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByTestId("signup-modal")).toBeVisible();
    await expect(page.getByTestId("aegis-landing-hero")).toBeHidden();

    await page
      .getByTestId("signup-org-input")
      .fill("Acme Cyber Defense Corp");
    await page
      .getByTestId("signup-email-input")
      .fill("secops@acme-defense.io");
    await page.getByTestId("signup-submit-btn").click();

    // Step 3, 4 & 5: Multi-Select Intake & AI Solution Recommendation on `/onboarding`
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByTestId("aegis-landing-hero")).toBeHidden();
    await expect(
      page.getByTestId("project-card-aegis-whitebox-github"),
    ).toBeHidden();

    await page
      .getByTestId("new-project-name-input")
      .fill("acme-unified-platform");
    await page.getByTestId("channel-toggle-api_server").click();
    await page.getByTestId("channel-toggle-api_server").click();

    await page
      .getByTestId("new-project-repo-input")
      .fill("https://github.com/acme-sec/unified-platform");
    await page
      .getByTestId("new-project-url-input")
      .fill("https://edge.acme-sec.io/v2/checkout");
    await page
      .getByTestId("new-project-api-input")
      .fill("https://api.acme-sec.io/graphql");

    await page.getByTestId("analyze-solutions-btn").click();
    await expect(page.getByTestId("solution-analysis-box")).toBeVisible();
    await expect(page.getByTestId("solution-option-git_pr")).toBeVisible();
    await expect(
      page.getByTestId("solution-option-route_shield"),
    ).toBeVisible();
    await expect(
      page.getByTestId("solution-option-automation_sdk"),
    ).toBeVisible();

    await page.screenshot({
      path: "playwright-aegis-multiselect-onboarding.png",
      fullPage: true,
    });

    await page.getByTestId("create-project-submit-btn").click();
    await expect(page).toHaveURL(/\/app\/projects$/);
    await expect(page.getByTestId("aegis-landing-hero")).toBeHidden();
    await expect(
      page.getByText(/Created project acme-unified-platform/i),
    ).toBeVisible();

    // Verify DNS ownership if required for URL channel
    if (await page.getByTestId("dns-verify-btn").isVisible()) {
      await page.getByTestId("dns-verify-btn").click();
    }

    // Step 6: 1-Click Autonomous Audit & Fix -> navigates to `/app/remediation`
    await page.getByTestId("one-click-audit-fix-btn").click();
    await expect(
      page.getByText(/4-stage Red-to-Green autonomous verification completed/i),
    ).toBeVisible({ timeout: 25000 });
    await expect(page).toHaveURL(/\/app\/remediation$/);

    // Step 7: Webhook & SDK Continuous Automation on `/app/automation-sdk`
    await page.getByTestId("remediation-tab-automation-sdk").click();
    await expect(page).toHaveURL(/\/app\/automation-sdk$/);
    await expect(page.getByTestId("panel-automation-sdk")).toBeVisible();

    await page.getByTestId("trigger-webhook-btn").click();
    await expect(page.getByTestId("webhook-result-banner")).toBeVisible();
    await expect(page.getByTestId("webhook-result-banner")).toContainText(
      "Auto-Remediation",
    );

    await expect(page.getByTestId("download-sdk-btn")).toBeVisible();
    await page.getByTestId("run-sdk-autopatch-btn").click();
    await expect(page.getByTestId("sdk-patch-result-banner")).toBeVisible();

    await page.screenshot({
      path: "playwright-aegis-sdk-and-delivery.png",
      fullPage: true,
    });

    // Step 8: Safe Delivery Pipeline on `/app/safe-delivery`
    await page.getByTestId("remediation-tab-safe-delivery").click();
    await expect(page).toHaveURL(/\/app\/safe-delivery$/);
    await expect(page.getByTestId("panel-safe-delivery")).toBeVisible();

    await page.getByTestId("verify-safe-delivery-btn").click();
    await expect(page.getByTestId("safe-delivery-proof-banner")).toBeVisible();
    await expect(page.getByTestId("safe-delivery-proof-banner")).toContainText(
      "HTTP 200 PASS / HTTP 403 BLOCK",
    );
  });
});
