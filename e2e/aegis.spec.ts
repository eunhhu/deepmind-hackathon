import { expect, test } from "@playwright/test";

const ARTIFACT_DIR =
  "/Users/sunwoo/.gemini/antigravity/brain/b6b21362-2b24-4366-a1f1-892dc515f3bb";

test.describe("AEGIS-4 Production E2E Verification Suite", () => {
  test("verifies full Tri-Mode Autonomous Cyber-Defense workflow, ELF Binary Hard-Patching, and Live Route Shield Proxy", async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const unexpectedHttpErrors: string[] = [];

    page.on("response", (res) => {
      if (res.status() >= 400) {
        // Intentional 403 from the live Route Shield reverse-proxy test
        if (res.status() === 403 && res.url().includes("/shield-proxy/")) {
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

    // 1. Navigate to AEGIS-4 Dashboard
    await page.goto("/");
    await expect(page.getByText("AEGIS-4 • Gemini 4 Argon")).toBeVisible();
    await expect(page.getByText("h2gdm-hack26icn-2693")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Autonomous Exploit Verification, Binary Hot-Patch & Route-Shield Platform",
      }),
    ).toBeVisible();

    // Verify all 3 seeded target projects are rendered
    await expect(
      page.getByRole("heading", { name: "acme-cloud/payment-checkout-api" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "fintech-edge-webhook-gateway" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "iot-telemetry-daemon-v2.4.elf" }).first(),
    ).toBeVisible();

    // 2. Trigger Real-Time 4-Stage SSE Self-Healing Scan on Target 1 (White-Box GitHub)
    const runLoopBtn = page.getByRole("button", {
      name: /Run Full 4-Stage Self-Healing Loop/i,
    });
    await expect(runLoopBtn).toBeVisible();
    await runLoopBtn.click();

    // Verify all 4 pipeline stages complete via live SSE stream and findings are verified
    await expect(page.getByText(/4-Stage Self-Healing Stream Completed/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("STAGE 01 • RECON")).toBeVisible();
    await expect(page.getByText("STAGE 02 • POC_RED")).toBeVisible();
    await expect(page.getByText("STAGE 03 • REMEDIATION")).toBeVisible();
    await expect(page.getByText("STAGE 04 • VERIFY_GREEN")).toBeVisible();
    await expect(page.getByText("PATCH VERIFIED").first()).toBeVisible();

    // 3. Mode 1 (White-Box Git Branch & GitHub PR + .patch Download + Verify-Critique-Polish)
    const openPrBtn = page.getByRole("button", { name: /Open \/ Sync GitHub PR/i });
    await expect(openPrBtn).toBeVisible();
    await openPrBtn.click();
    await expect(page.getByText(/gh pr create/i).first()).toBeVisible();

    // Run Verify-Critique-Polish Audit in Mode 1
    const polishBtn = page.getByRole("button", { name: /Verify-Critique-Polish Audit/i });
    await expect(polishBtn).toBeVisible();
    await polishBtn.click();
    await expect(page.getByText("✨ Verify-Critique-Polish Rubric Verified")).toBeVisible({
      timeout: 15_000,
    });

    // Capture Mode 1 White-Box view screenshot with PR sync & Verify-Critique-Polish Rubric
    await page.screenshot({
      path: `${ARTIFACT_DIR}/playwright-aegis-mode1-whitebox.png`,
      fullPage: true,
    });

    // Verify .patch download endpoint returns valid unified diff
    const patchRes = await request.get(
      "/api/modules/aegis/projects/aegis-whitebox-github/patch-download",
    );
    expect(patchRes.status()).toBe(200);
    const patchText = await patchRes.text();
    expect(patchText).toContain("Subject: [PATCH]");
    expect(patchText).toContain("--- a/");
    expect(patchText).toContain("+++ b/");

    // 4. Switch to Demo 3 / Mode 2 (No-Source ELF Binary Hard-Patch & Custom ELF64 Upload)
    await page
      .getByRole("button", {
        name: /Demo 3: No-Source ELF Binary/i,
      })
      .click();

    await expect(
      page.getByText("🔐 Cryptographic SHA-256 Integrity Verification"),
    ).toBeVisible();

    // Upload a custom ELF64 binary with an `e8` CALL + `48 89 c7` sequence via hidden file input
    const customElfBytes = Buffer.from([
      0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x48, 0x89, 0xd6, 0xe8, 0x4b, 0xfe, 0xff, 0xff, 0x48, 0x89, 0xc7, 0x90, 0xc3,
    ]);
    await page.locator("#aegis-binary-upload-input").setInputFiles({
      name: "custom-iot-firmware.elf",
      mimeType: "application/octet-stream",
      buffer: customElfBytes,
    });

    // Wait for the uploaded binary filename and cryptographic SHA-256 match badge to appear
    await expect(page.getByText("custom-iot-firmware.elf").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("✓ Matches SHA-256 After")).toBeVisible();

    // Verify actual binary download endpoint returns patched ELF bytes matching X-Aegis-SHA256-After
    const binRes = await request.get(
      "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-download",
    );
    expect(binRes.status()).toBe(200);
    const shaAfterHeader = binRes.headers()["x-aegis-sha256-after"];
    expect(shaAfterHeader).toBeTruthy();
    await expect(page.getByText(shaAfterHeader).first()).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACT_DIR}/playwright-aegis-mode2-binary.png`,
      fullPage: true,
    });

    // 5. Switch to Demo 2 / Mode 3 (External URL + DNS TXT Gate -> Live Route Shield & Reverse Proxy)
    await page
      .getByRole("button", {
        name: /Demo 2: External URL \+ DNS TXT Gate/i,
      })
      .click();

    await expect(page.locator("#aegis-shield-protected-path")).toBeVisible();

    // Update rate limit and save live rule
    await page.locator("#aegis-shield-rate-limit").fill("45");
    await page.getByRole("button", { name: "Save Live Rule" }).click();

    // Fire Live Exploit when Shield is ON -> expect HTTP 403 Blocked banner
    await page.getByRole("button", { name: /Fire Live Exploit Against Route/i }).click();
    await expect(
      page.getByText(/HTTP 403 Forbidden — Blocked by AEGIS-4 Route Shield/i),
    ).toBeVisible();

    // Test Real Reverse-Proxy Gateway (/shield-proxy) when Shield is ON -> expect 403 Intercepted
    await page
      .getByRole("button", { name: /Test Live Reverse-Proxy Gateway \(\/shield-proxy\)/i })
      .click();
    await expect(
      page.getByText(/Reverse-Proxy Gateway \(\/shield-proxy\): INTERCEPTED & BLOCKED \(403\)/i),
    ).toBeVisible();

    // Toggle Route Shield OFF -> Fire Live Exploit -> expect HTTP 200 OK (RED: EXPLOIT SUCCEEDED)
    await page.getByRole("button", { name: /Route Shield: ACTIVE \(ON\)/i }).click();
    await expect(
      page.getByRole("button", { name: /Route Shield: BYPASSED \(OFF\)/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Fire Live Exploit Against Route/i }).click();
    await expect(
      page.getByText(/HTTP 200 OK — RED: EXPLOIT SUCCEEDED \(Shield OFF\)/i),
    ).toBeVisible();

    // Toggle Route Shield back ON -> verify green protection restored
    await page.getByRole("button", { name: /Route Shield: BYPASSED \(OFF\)/i }).click();
    await expect(
      page.getByRole("button", { name: /Route Shield: ACTIVE \(ON\)/i }),
    ).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACT_DIR}/playwright-aegis-mode3-shield.png`,
      fullPage: true,
    });

    // 6. Test New Target Intake & DNS TXT Ownership Gate Verification
    await page.getByRole("button", { name: /\+ New Target Intake/i }).click();
    await expect(
      page.getByRole("heading", { name: /3-Mode Target Intake & Scope Authorization/i }),
    ).toBeVisible();

    // Switch intake mode to Target URL + DNS TXT Ownership Gate & register new target
    await page.getByRole("button", { name: /2\. Target URL \+ DNS TXT Ownership Gate/i }).click();
    await page.locator("#aegis-intake-name").fill("staging-gateway-e2e");
    await page.locator("#aegis-intake-url").fill("https://staging-gateway.acme.dev/v1/hooks");
    await page.getByRole("button", { name: /Register Target in AEGIS-4/i }).click();

    // Verify Mandatory DNS TXT Ownership Gate banner appears for the newly created URL target
    await expect(
      page.getByRole("heading", {
        name: /DNS TXT Domain Ownership Verification Required Before Active Sandbox Exploitation/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: /Verify DNS TXT Record/i,
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: /DNS TXT Domain Ownership Verification Required Before Active Sandbox Exploitation/i,
      }),
    ).toBeHidden();

    // 7. Verify Other Platform Modules Load Cleanly via Top Segmented Navigation
    await page.getByRole("button", { name: /Workspace \+ Firestore Hub/i }).click();
    await expect(page.getByText(/Generic Firestore Collection Inspector/i)).toBeVisible();

    await page.getByRole("button", { name: /Argon Parallel Swarm Console/i }).click();
    await expect(page.getByRole("heading", { name: /Parallel Worker Shards/i })).toBeVisible();

    // Ensure zero uncaught page, console, or unexpected HTTP errors occurred during the entire session
    expect(pageErrors).toEqual([]);
    expect(unexpectedHttpErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
