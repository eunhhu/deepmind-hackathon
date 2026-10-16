import { expect, test } from "@playwright/test";

const ARTIFACT_DIR =
  "/Users/sunwoo/.gemini/antigravity/brain/b6b21362-2b24-4366-a1f1-892dc515f3bb";

test.describe("AEGIS-4 Production E2E Verification Suite", () => {
  test("verifies Product vs. Ops separation, Tri-Mode Remediation, Dynamic Target Artifacts, and Clean Reset", async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const unexpectedHttpErrors: string[] = [];

    page.on("response", (res) => {
      if (res.status() >= 400) {
        if (
          res.status() === 403 &&
          (res.url().includes("/shield-proxy") || res.url().includes("/scan"))
        ) {
          return;
        }
        unexpectedHttpErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (text.includes("status of 403 (Forbidden)")) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    // Ensure clean 3-seed baseline before running E2E
    const preReset = await request.post("/api/modules/aegis/reset");
    expect(preReset.status()).toBe(200);

    try {
      // 1. Navigate to AEGIS-4 Security Console (Pure Product Level View by default)
      await page.goto("/");
      await expect(page.getByTestId("aegis-product-view")).toBeVisible();
      await expect(page.getByText("AEGIS-4").first()).toBeVisible();
      await expect(page.getByText("Security Console").first()).toBeVisible();

      // Verify internal Ops & Engine Console elements are NOT mixed into the default Product view
      await expect(page.getByTestId("aegis-ops-console-view")).toBeHidden();
      await expect(page.getByTestId("ops-infrastructure-strip")).toBeHidden();

      // Verify Product top navigation tabs are visible
      await expect(page.getByTestId("product-nav-projects")).toBeVisible();
      await expect(page.getByTestId("product-nav-vulnerabilities")).toBeVisible();
      await expect(page.getByTestId("product-nav-remediation")).toBeVisible();

      // Verify all 3 canonical seed targets are rendered cleanly with no leftover dummy projects
      await expect(page.getByTestId("project-card-aegis-whitebox-github")).toBeVisible();
      await expect(page.getByTestId("project-card-aegis-blackbox-url-shield")).toBeVisible();
      await expect(page.getByTestId("project-card-aegis-blackbox-binary-elf")).toBeVisible();

      // 2. Target 1 (White-Box GitHub Repo): Run SSE Security Scan & Verify Git PR Remediation
      await page.getByTestId("project-card-aegis-whitebox-github").click();
      await page.getByTestId("stream-scan-btn").click();
      await expect(
        page.getByText(/4-stage Red-to-Green autonomous verification completed/i),
      ).toBeVisible({ timeout: 15_000 });

      // Inspect Git PR tab and trigger GitHub PR creation
      await page.getByTestId("remediation-tab-git-pr").click();
      await expect(page.getByTestId("code-diff-viewer")).toBeVisible();
      await page.getByTestId("create-pr-btn").click();
      await expect(page.getByTestId("pr-created-banner")).toBeVisible();

      // Verify .patch download endpoint returns valid unified diff
      const patchRes = await request.get(
        "/api/modules/aegis/projects/aegis-whitebox-github/patch-download",
      );
      expect(patchRes.status()).toBe(200);
      const patchText = await patchRes.text();
      expect(patchText).toContain("Subject: [PATCH]");
      expect(patchText).toContain("@@ ");

      await page.screenshot({
        path: `${ARTIFACT_DIR}/playwright-aegis-mode1-whitebox.png`,
        fullPage: true,
      });

      // 3. Target 3 (No-Source ELF Binary): Verify Binary Disassembly & Hard-Patch Download
      await page.getByTestId("project-card-aegis-blackbox-binary-elf").click();
      await page.getByTestId("remediation-tab-binary-patch").click();
      await expect(page.getByTestId("binary-patch-table")).toBeVisible();
      await expect(page.getByTestId("download-binary-link")).toBeVisible();

      const binRes = await request.get(
        "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-download",
      );
      expect(binRes.status()).toBe(200);
      const shaAfterHeader = binRes.headers()["x-aegis-sha256-after"];
      expect(shaAfterHeader).toBeTruthy();

      await page.screenshot({
        path: `${ARTIFACT_DIR}/playwright-aegis-mode2-binary.png`,
        fullPage: true,
      });

      // 4. Target 2 (URL + DNS TXT Gate -> Route Shield & Verification Sandbox)
      await page.getByTestId("project-card-aegis-blackbox-url-shield").click();
      await page.getByTestId("remediation-tab-route-shield").click();
      await expect(page.getByTestId("toggle-shield-btn")).toBeVisible();

      // Open the dedicated Verification & Sandbox Exploit Lab drawer to test Live Exploit Payload Tester
      await page.getByTestId("remediation-tab-verification-ops").click();
      await page.getByTestId("test-attack-btn").click();
      await expect(page.getByTestId("attack-verdict-banner")).toContainText("BLOCKED_GREEN");
      await expect(page.getByTestId("attack-verdict-banner")).toContainText("HTTP 403");

      // Toggle Shield OFF -> verify exploit succeeds (200 RED) -> toggle back ON
      await page.getByTestId("toggle-shield-btn").click();
      await page.getByTestId("test-attack-btn").click();
      await expect(page.getByTestId("attack-verdict-banner")).toContainText("EXPLOITED_RED");

      await page.getByTestId("toggle-shield-btn").click();

      await page.screenshot({
        path: `${ARTIFACT_DIR}/playwright-aegis-mode3-shield.png`,
        fullPage: true,
      });

      // 5. Onboard Custom URL Target -> Verify DNS Ownership Gate & Target-Tailored Scan Artifacts
      await page.getByTestId("toggle-new-project-btn").click();
      await page.getByTestId("intake-mode-url-dns").click();
      await page.getByTestId("new-project-name-input").fill("korea-pay-webhook-edge");
      await page
        .getByTestId("new-project-url-input")
        .fill("https://pay.korea-fintech.kr/v3/settlement/callback");
      await page.getByTestId("create-project-submit-btn").click();

      // Verify DNS TXT Ownership Gate card appears and authorizes after verification
      await expect(page.getByTestId("dns-verify-card")).toBeVisible();
      await page.getByTestId("dns-verify-btn").click();
      await expect(page.getByTestId("dns-verify-card")).toBeHidden();

      // Run Quick Re-Scan and verify target-tailored route & project name appear in artifacts
      await page.getByTestId("rescan-btn").click();
      await expect(
        page.getByText(/Completed deterministic security scan for korea-pay-webhook-edge/i),
      ).toBeVisible();
      await expect(page.getByText("/v3/settlement/callback").first()).toBeVisible();

      // 6. Toggle Ops & Engine Console Mode and verify internal orchestration tools are isolated there
      await page.getByTestId("toggle-ops-console-btn").click();
      await expect(page.getByTestId("aegis-ops-console-view")).toBeVisible();
      await expect(page.getByTestId("ops-infrastructure-strip")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Gemini 4 Argon Swarm & Infrastructure Console/i }),
      ).toBeVisible();

      // Switch back to Product Console and click Reset Demo Targets button
      await page.getByTestId("toggle-ops-console-btn").click();
      await expect(page.getByTestId("aegis-product-view")).toBeVisible();
      await page.getByTestId("reset-demo-projects-btn").click();
      await expect(
        page.getByText(/Demo targets restored to clean baseline \(3 flagship targets\)/i),
      ).toBeVisible();

      expect(pageErrors).toEqual([]);
      expect(unexpectedHttpErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    } finally {
      // Always leave the server with only the 3 clean canonical seed targets
      await request.post("/api/modules/aegis/reset");
    }
  });
});
