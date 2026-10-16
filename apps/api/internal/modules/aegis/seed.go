package aegis

// DefaultSeedProjects returns the 3 flagship pre-populated Aegis projects covering:
// 1. Whitebox GitHub Repo + CD YAML -> Code Patch + PR Report
// 2. Blackbox URL + DNS TXT Verification -> Live Edge Route Shield (WAF / Middleware)
// 3. Blackbox ELF64 Binary Upload -> Disassembly + Hard Binary Byte Patch
func DefaultSeedProjects() []AegisProject {
	return []AegisProject{
		{
			Id:                 "aegis-whitebox-github",
			Name:               "acme-cloud/payment-checkout-api",
			Subtitle:           "Whitebox GitHub Repo + Cloud Run CD Pipeline — Automated Code Patch & PR",
			IntakeMode:         IntakeModeGitHub,
			TargetType:         TargetTypeAPI,
			RemediationMode:    RemediationModeGitPR,
			DefenseStatus:      DefenseStatusPatchedViaPR,
			RepoUrl:            "https://github.com/acme-cloud/payment-checkout-api",
			CdWorkflowPath:     ".github/workflows/deploy-cloudrun.yml",
			TargetUrl:          "https://checkout-api-staging.acme-cloud.dev",
			DnsDomain:          "acme-cloud.dev",
			DnsTxtRecordName:   "_aegis-verify.acme-cloud.dev",
			DnsTxtToken:        "aegis-verify=ag4-77c1b802e1",
			DnsVerified:        true,
			LastScanDurationMs: 4820,
			UpdatedAt:          "2026-05-16T02:45:00Z",
			Vulnerabilities: []AegisVulnerabilityFinding{
				{
					Id:                         "VULN-CWE89-INVOICE",
					CveOrCwe:                   "CWE-89",
					Title:                      "Unescaped SQL Concatenation & Cross-Tenant Invoice Auth Bypass",
					Severity:                   "critical",
					CvssScore:                  9.8,
					Location:                   "internal/billing/invoice_repo.go:142 (GET /api/v1/invoices/lookup)",
					RootCause:                  "Raw string formatting via fmt.Sprintf injects untrusted query parameter invoice_id directly into PostgreSQL WHERE clause before tenant_id scoping is evaluated.",
					AttackVector:               "GET /api/v1/invoices/lookup?invoice_id=INV-100'%20OR%20'1'='1",
					PocPayload:                 "curl -i -s \"http://127.0.0.1:18081/api/v1/invoices/lookup?invoice_id=INV-100'%20OR%20'1'='1\" -H \"X-Tenant-ID: tenant-sandbox-01\"",
					PocRedLog:                  "[SANDBOX-RED] Executing PoC against isolated build (commit 94a1f0c)...\n> GET /api/v1/invoices/lookup?invoice_id=INV-100'%20OR%20'1'='1 HTTP/1.1\n< HTTP/1.1 200 OK\n< Content-Type: application/json\n{\"count\":48,\"leakedTenants\":[\"tenant-enterprise-99\",\"tenant-gov-04\"],\"status\":\"EXPLOIT_SUCCEEDED\"}\n[EXIT 1] RED: VULNERABILITY CONFIRMED (Cross-tenant rows leaked: 48)",
					VerifyGreenLog:             "[SANDBOX-GREEN] Re-running identical PoC against patched build (branch aegis/fix-cwe89-invoice-lookup)...\n> GET /api/v1/invoices/lookup?invoice_id=INV-100'%20OR%20'1'='1 HTTP/1.1\n< HTTP/1.1 404 Not Found\n< Content-Type: application/json\n{\"error\":\"invoice not found for tenant\",\"leakedTenants\":[],\"status\":\"PARAMETERIZED_SAFE\"}\n[EXIT 0] GREEN: PATCH VERIFIED (0 rows leaked; unit & regression tests 42/42 PASS)",
					ZeroFalsePositiveConfirmed: true,
				},
			},
			Timeline: []AegisTimelineStep{
				{
					Stage:        "recon",
					Title:        "Stage 1: Whitebox AST & CD Pipeline Reconnaissance",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1120,
					Summary:      "Parsed .github/workflows/deploy-cloudrun.yml and traced HTTP route GET /api/v1/invoices/lookup to unparameterized fmt.Sprintf query in internal/billing/invoice_repo.go:142.",
					CommandOrLog: "[RECON] AstGraph: Router(/api/v1/invoices/lookup) -> Handler.LookupInvoice -> InvoiceRepo.FindByExternalID(ctx, tenantID, rawInvoiceID)\n[SINK] internal/billing/invoice_repo.go:142 uses fmt.Sprintf(\"SELECT ... WHERE invoice_id = '%s' AND tenant_id = '%s'\", invoiceID, tenantID)",
					Timestamp:    "2026-05-16T02:44:51Z",
				},
				{
					Stage:        "poc_red",
					Title:        "Stage 2: Sandbox PoC Synthesis & Red Verification",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1460,
					Summary:      "Synthesized boolean-tautology payload breaking out of single-quote literal and bypassing trailing AND tenant_id filter; reproduced leak of 48 cross-tenant invoices in ephemeral container.",
					CommandOrLog: "$ aegis-sandbox exec --target checkout-api:94a1f0c --poc poc_cwe89.sh\n[RED] HTTP 200 OK | Leaked 48 cross-tenant records across 2 external tenants -> CONFIRMED TRUE POSITIVE",
					Timestamp:    "2026-05-16T02:44:54Z",
				},
				{
					Stage:        "remediation",
					Title:        "Stage 3: Parameterized Query Patch Synthesis",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1290,
					Summary:      "Replaced fmt.Sprintf SQL construction with positional PostgreSQL placeholders ($1, $2) and strict format validation on invoice_id.",
					CommandOrLog: "[PATCH] Updated internal/billing/invoice_repo.go (lines 139-151)\n+ const query = `SELECT id, invoice_id, tenant_id, amount_cents, status FROM invoices WHERE tenant_id = $1 AND invoice_id = $2 LIMIT 1`",
					Timestamp:    "2026-05-16T02:44:57Z",
				},
				{
					Stage:        "verify_green",
					Title:        "Stage 4: Green Verification & GitHub PR Generation",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   950,
					Summary:      "Re-executed PoC payload against patched container (HTTP 404, 0 leaked records), passed go test ./..., and opened PR #412.",
					CommandOrLog: "$ aegis-sandbox verify --branch aegis/fix-cwe89-invoice-lookup\n[GREEN] PoC blocked (0 leaked rows) | go test ./internal/billing/... PASS (0.41s) -> PR #412 OPENED",
					Timestamp:    "2026-05-16T02:45:00Z",
				},
			},
			GitPrReport: &AegisGitHubPrReport{
				BranchName:     "aegis/fix-cwe89-invoice-lookup",
				PrNumber:       412,
				PrTitle:        "fix(security): parameterize invoice lookup SQL query to prevent CWE-89 tenant bypass",
				PrUrl:          "https://github.com/eunhhu/deepmind-hackathon/pulls",
				CommitSha:      "e7c4190b3a2d88f14c9e0a1b5d7f3e2c1a9b8d4e",
				Status:         "open",
				CiChecksPassed: true,
				MarkdownComment: `### 🛡️ Aegis Autonomous Security Report — Zero-False-Positive Verified

| Field | Details |
| :--- | :--- |
| **Vulnerability** | **CWE-89**: SQL Injection & Cross-Tenant Authorization Bypass |
| **Severity / CVSS** | **CRITICAL (9.8)** |
| **Location** | ` + "`internal/billing/invoice_repo.go:142`" + ` (` + "`GET /api/v1/invoices/lookup`" + `) |
| **Verification Loop** | 🔴 **Red (Before)**: ` + "`HTTP 200`" + ` (48 cross-tenant rows leaked) → 🟢 **Green (After)**: ` + "`HTTP 404`" + ` (0 rows leaked) |

#### Root Cause Analysis
` + "`FindByExternalID`" + ` constructed its SQL statement using ` + "`fmt.Sprintf`" + ` with unescaped user input from the ` + "`invoice_id`" + ` query parameter. Supplying ` + "`INV-100' OR '1'='1`" + ` short-circuited the ` + "`WHERE`" + ` predicate and bypassed the trailing ` + "`AND tenant_id = '...'`" + ` clause.

#### Remediation Summary
1. Enforced strict parameterized binding (` + "`$1`" + `, ` + "`$2`" + `) with ` + "`tenant_id`" + ` evaluated as the leading predicate.
2. Added input format guard rejecting non-alphanumeric invoice identifiers prior to database query execution.`,
				CodeDiff: AegisCodePatchDiff{
					FilePath: "internal/billing/invoice_repo.go",
					Language: "go",
					BeforeCode: `func (r *InvoiceRepo) FindByExternalID(ctx context.Context, tenantID, invoiceID string) (*Invoice, error) {
	query := fmt.Sprintf(
		"SELECT id, invoice_id, tenant_id, amount_cents, status FROM invoices WHERE invoice_id = '%s' AND tenant_id = '%s'",
		invoiceID, tenantID,
	)
	row := r.db.QueryRowContext(ctx, query)
	return scanInvoice(row)
}`,
					AfterCode: `func (r *InvoiceRepo) FindByExternalID(ctx context.Context, tenantID, invoiceID string) (*Invoice, error) {
	if !validInvoiceIDPattern.MatchString(invoiceID) {
		return nil, ErrInvalidInvoiceID
	}
	const query = ` + "`" + `
		SELECT id, invoice_id, tenant_id, amount_cents, status
		FROM invoices
		WHERE tenant_id = $1 AND invoice_id = $2
		LIMIT 1
	` + "`" + `
	row := r.db.QueryRowContext(ctx, query, tenantID, invoiceID)
	return scanInvoice(row)
}`,
					UnifiedDiff: `@@ -139,8 +139,15 @@
 func (r *InvoiceRepo) FindByExternalID(ctx context.Context, tenantID, invoiceID string) (*Invoice, error) {
-	query := fmt.Sprintf(
-		"SELECT id, invoice_id, tenant_id, amount_cents, status FROM invoices WHERE invoice_id = '%s' AND tenant_id = '%s'",
-		invoiceID, tenantID,
-	)
-	row := r.db.QueryRowContext(ctx, query)
+	if !validInvoiceIDPattern.MatchString(invoiceID) {
+		return nil, ErrInvalidInvoiceID
+	}
+	const query = ` + "`" + `
+		SELECT id, invoice_id, tenant_id, amount_cents, status
+		FROM invoices
+		WHERE tenant_id = $1 AND invoice_id = $2
+		LIMIT 1
+	` + "`" + `
+	row := r.db.QueryRowContext(ctx, query, tenantID, invoiceID)
 	return scanInvoice(row)
 }`,
					Explanation: "Replaces string interpolation in SQL with PostgreSQL positional parameters ($1, $2) and validates invoice_id against a strict allowlist regex.",
				},
			},
			RouteShield: &AegisRouteShieldRule{
				RuleId:               "AEGIS-SHIELD-089",
				Enabled:              true,
				ProtectedPath:        "/api/v1/invoices/lookup",
				Methods:              []string{"GET"},
				BlockPatternRegex:    `(?i)(\bunion\b|\bselect\b|\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+|'--|;--|/\*)`,
				RateLimitRps:         120,
				BlockedRequestsCount: 6,
				LastBlockedAt:        "2026-05-16T02:44:58Z",
				SampleAttackPayload:  "GET /api/v1/invoices/lookup?invoice_id=INV-100'%20OR%20'1'='1",
				Snippets: AegisShieldSnippets{
					CloudRunGin: `// Aegis Route Shield Middleware (Gin / Cloud Run)
func AegisShieldCWE89() gin.HandlerFunc {
	sqliPattern := regexp.MustCompile(` + "`" + `(?i)(\bunion\b|\bselect\b|\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+|'--|;--|/\*)` + "`" + `)
	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/v1/invoices/lookup") {
			if sqliPattern.MatchString(c.Request.URL.RawQuery) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"blockedBy": "AEGIS-SHIELD-089",
					"reason":    "SQL injection tautology or comment token blocked at edge",
				})
				return
			}
		}
		c.Next()
	}
}`,
					CloudArmor: `# Google Cloud Armor Security Policy Rule (AEGIS-SHIELD-089)
gcloud compute security-policies rules create 1089 \
  --security-policy="acme-checkout-edge-policy" \
  --expression="request.path.startsWith('/api/v1/invoices/lookup') && evaluatePreconfiguredWaf('sqli-v33-stable')" \
  --action="deny-403" \
  --description="Aegis virtual patch for CWE-89 on invoice lookup"`,
					CloudflareWorker: `// Cloudflare Worker Edge Virtual Patch (AEGIS-SHIELD-089)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const sqliRegex = /(\bunion\b|\bselect\b|\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+|'--|;--|\/\*)/i;
    if (url.pathname.startsWith("/api/v1/invoices/lookup") && sqliRegex.test(decodeURIComponent(url.search))) {
      return new Response(JSON.stringify({ blockedBy: "AEGIS-SHIELD-089", status: 403 }), {
        status: 403,
        headers: { "content-type": "application/json", "x-aegis-shield": "AEGIS-SHIELD-089" },
      });
    }
    return fetch(request);
  }
};`,
					Nginx: `# NGINX Edge Location Shield (AEGIS-SHIELD-089)
location = /api/v1/invoices/lookup {
    if ($args ~* "(\bunion\b|\bselect\b|\bor\b.+%3D|--|%27)") {
        add_header X-Aegis-Shield "AEGIS-SHIELD-089" always;
        return 403 '{"blockedBy":"AEGIS-SHIELD-089","reason":"SQLi payload blocked"}';
    }
    proxy_pass http://checkout_api_upstream;
}`,
					Envoy: `# Envoy HTTP Lua Filter (AEGIS-SHIELD-089)
name: envoy.filters.http.lua
typed_config:
  "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
  inline_code: |
    function envoy_on_request(handle)
      local path = handle:headers():get(":path") or ""
      if string.find(path, "^/api/v1/invoices/lookup") and string.find(string.lower(path), "('|--|%%27|or%%20)") then
        handle:respond({[":status"] = "403", ["x-aegis-shield"] = "AEGIS-SHIELD-089"}, '{"blockedBy":"AEGIS-SHIELD-089"}')
      end
    end`,
				},
			},
		},
		{
			Id:                 "aegis-blackbox-url-shield",
			Name:               "fintech-edge-webhook-gateway",
			Subtitle:           "Blackbox URL + DNS TXT Ownership Verification — Instant Edge Route Shield",
			IntakeMode:         IntakeModeURLDNS,
			TargetType:         TargetTypeWeb,
			RemediationMode:    RemediationModeRouteShield,
			DefenseStatus:      DefenseStatusProtectedViaShield,
			TargetUrl:          "https://api.staging-fintech.io/v2/webhooks/dispatch",
			DnsDomain:          "staging-fintech.io",
			DnsTxtRecordName:   "_aegis-verify.staging-fintech.io",
			DnsTxtToken:        "aegis-verify=ag4-9f82c1d4e7",
			DnsVerified:        true,
			LastScanDurationMs: 3910,
			UpdatedAt:          "2026-05-16T02:46:30Z",
			Vulnerabilities: []AegisVulnerabilityFinding{
				{
					Id:                         "VULN-CWE918-SSRF",
					CveOrCwe:                   "CWE-918",
					Title:                      "Unauthenticated Server-Side Request Forgery (SSRF) to Cloud Metadata Service",
					Severity:                   "critical",
					CvssScore:                  9.6,
					Location:                   "POST /v2/webhooks/dispatch (JSON field: callback_url)",
					RootCause:                  "Webhook test dispatcher fetches arbitrary user-supplied callback_url values without filtering link-local (169.254.169.254), loopback, or internal RFC1918 CIDR ranges and echoes the upstream HTTP response body in diagnostic mode.",
					AttackVector:               "POST /v2/webhooks/dispatch with {\"callback_url\":\"http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token\"}",
					PocPayload:                 "curl -i -s -X POST \"https://api.staging-fintech.io/v2/webhooks/dispatch\" -H \"Content-Type: application/json\" -d '{\"callback_url\":\"http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token\",\"forward_headers\":{\"Metadata-Flavor\":\"Google\"}}'",
					PocRedLog:                  "[BLACKBOX-RED] DNS TXT _aegis-verify.staging-fintech.io verified (aegis-verify=ag4-9f82c1d4e7)\n> POST /v2/webhooks/dispatch HTTP/2\n> {\"callback_url\":\"http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token\"}\n< HTTP/2 200 OK\n< {\"upstream_status\":200,\"body_preview\":\"{\\\"access_token\\\":\\\"ya29.c.b0Aaekm1K...\\\",\\\"token_type\\\":\\\"Bearer\\\"}\"}\n[EXIT 1] RED: VULNERABILITY CONFIRMED (Cloud IAM metadata token exfiltrated)",
					VerifyGreenLog:             "[SHIELD-GREEN] Deployed Route Shield Rule AEGIS-SHIELD-918 in front of /v2/webhooks/dispatch...\n> POST /v2/webhooks/dispatch HTTP/2\n> {\"callback_url\":\"http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token\"}\n< HTTP/2 403 Forbidden\n< X-Aegis-Shield: AEGIS-SHIELD-918\n< {\"blocked\":true,\"ruleId\":\"AEGIS-SHIELD-918\",\"reason\":\"SSRF internal/link-local target blocked\"}\n[EXIT 0] GREEN: ROUTE SHIELD VERIFIED (0 metadata requests reached origin)",
					ZeroFalsePositiveConfirmed: true,
				},
			},
			Timeline: []AegisTimelineStep{
				{
					Stage:        "recon",
					Title:        "Stage 1: DNS TXT Ownership Check & Blackbox Endpoint Fingerprinting",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   840,
					Summary:      "Verified _aegis-verify.staging-fintech.io TXT record and discovered JSON schema on POST /v2/webhooks/dispatch accepting arbitrary URL schemes and forward_headers.",
					CommandOrLog: "$ dig +short TXT _aegis-verify.staging-fintech.io -> \"aegis-verify=ag4-9f82c1d4e7\" [AUTHORIZED]\n[RECON] Discovered outbound URL sink in POST /v2/webhooks/dispatch (callback_url, forward_headers)",
					Timestamp:    "2026-05-16T02:46:22Z",
				},
				{
					Stage:        "poc_red",
					Title:        "Stage 2: Controlled Metadata SSRF PoC (Red State)",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1310,
					Summary:      "Confirmed unauthenticated SSRF traversal to 169.254.169.254 computeMetadata endpoint with reflected token preview in diagnostic response.",
					CommandOrLog: "[RED] POST /v2/webhooks/dispatch -> 200 OK | upstream_status=200 | Metadata-Flavor header forwarded -> CONFIRMED CWE-918",
					Timestamp:    "2026-05-16T02:46:25Z",
				},
				{
					Stage:        "remediation",
					Title:        "Stage 3: Instant Edge Route Shield Synthesis (No Source Repo Needed)",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1020,
					Summary:      "Synthesized virtual patch rule AEGIS-SHIELD-918 blocking link-local metadata IPs, loopback ranges, non-HTTPS schemes, and Metadata-Flavor header smuggling.",
					CommandOrLog: "[SHIELD] Compiled AEGIS-SHIELD-918 for Cloud Run Gin, Cloud Armor, Cloudflare Worker, NGINX, and Envoy",
					Timestamp:    "2026-05-16T02:46:28Z",
				},
				{
					Stage:        "verify_green",
					Title:        "Stage 4: Live Route Shield Verification (Green State)",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   740,
					Summary:      "Replayed SSRF PoC and DNS-rebinding variants through Aegis Route Shield; all exploit payloads intercepted with HTTP 403 in 0.8ms while valid HTTPS webhooks succeeded.",
					CommandOrLog: "[GREEN] Exploit replay -> HTTP 403 Forbidden (X-Aegis-Shield: AEGIS-SHIELD-918) | Benign webhook -> HTTP 202 Accepted",
					Timestamp:    "2026-05-16T02:46:30Z",
				},
			},
			RouteShield: &AegisRouteShieldRule{
				RuleId:               "AEGIS-SHIELD-918",
				Enabled:              true,
				ProtectedPath:        "/v2/webhooks/dispatch",
				Methods:              []string{"POST", "PUT"},
				BlockPatternRegex:    `(?i)(169\.254\.169\.254|metadata\.google\.internal|127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|file://|gopher://|dict://|metadata-flavor)`,
				RateLimitRps:         50,
				BlockedRequestsCount: 14,
				LastBlockedAt:        "2026-05-16T02:46:30Z",
				SampleAttackPayload:  `{"callback_url":"http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token","forward_headers":{"Metadata-Flavor":"Google"}}`,
				Snippets: AegisShieldSnippets{
					CloudRunGin: `// Aegis Route Shield Middleware (Gin / Cloud Run) — Rule AEGIS-SHIELD-918
func AegisShieldCWE918() gin.HandlerFunc {
	ssrfPattern := regexp.MustCompile(` + "`" + `(?i)(169\.254\.169\.254|metadata\.google\.internal|127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|file://|gopher://|dict://|metadata-flavor)` + "`" + `)
	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/v2/webhooks/dispatch") {
			bodyBytes, _ := io.ReadAll(io.LimitReader(c.Request.Body, 65536))
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			if ssrfPattern.Match(bodyBytes) || ssrfPattern.MatchString(c.Request.URL.RawQuery) {
				c.Header("X-Aegis-Shield", "AEGIS-SHIELD-918")
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"blocked": true,
					"ruleId":  "AEGIS-SHIELD-918",
					"reason":  "Aegis Route Shield blocked SSRF / cloud metadata target",
				})
				return
			}
		}
		c.Next()
	}
}`,
					CloudArmor: `# Google Cloud Armor Edge Policy Rule (AEGIS-SHIELD-918)
gcloud compute security-policies rules create 1918 \
  --security-policy="fintech-webhook-edge-armor" \
  --expression="request.path.startsWith('/v2/webhooks/dispatch') && (request.body.matches('(?i)(169\\\\.254\\\\.169\\\\.254|metadata\\\\.google\\\\.internal|127\\\\.0\\\\.0\\\\.1|localhost|file://|gopher://)') || has(request.headers['metadata-flavor']))" \
  --action="deny-403" \
  --description="Aegis virtual patch blocking CWE-918 SSRF metadata token extraction"`,
					CloudflareWorker: `// Cloudflare Worker Edge Route Shield (AEGIS-SHIELD-918)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/v2/webhooks/dispatch") && ["POST", "PUT"].includes(request.method)) {
      const bodyText = await request.clone().text();
      const ssrfRegex = /(169\.254\.169\.254|metadata\.google\.internal|127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|file:\/\/|gopher:\/\/|dict:\/\/|metadata-flavor)/i;
      if (ssrfRegex.test(bodyText) || request.headers.has("metadata-flavor")) {
        return new Response(JSON.stringify({
          blocked: true,
          ruleId: "AEGIS-SHIELD-918",
          reason: "Aegis Route Shield intercepted SSRF metadata probe"
        }), {
          status: 403,
          headers: { "content-type": "application/json", "x-aegis-shield": "AEGIS-SHIELD-918" }
        });
      }
    }
    return fetch(request);
  }
};`,
					Nginx: `# NGINX + NJS / Lua Virtual Patch (AEGIS-SHIELD-918)
location = /v2/webhooks/dispatch {
    client_max_body_size 64k;
    if ($http_metadata_flavor != "") {
        add_header X-Aegis-Shield "AEGIS-SHIELD-918" always;
        return 403 '{"blocked":true,"ruleId":"AEGIS-SHIELD-918","reason":"Metadata-Flavor header forbidden"}';
    }
    if ($request_body ~* "(169\.254\.169\.254|metadata\.google\.internal|127\.0\.0\.1|localhost|file://|gopher://)") {
        add_header X-Aegis-Shield "AEGIS-SHIELD-918" always;
        return 403 '{"blocked":true,"ruleId":"AEGIS-SHIELD-918","reason":"SSRF internal target blocked"}';
    }
    proxy_pass https://fintech_webhook_origin;
}`,
					Envoy: `# Envoy HTTP Lua Filter (AEGIS-SHIELD-918)
name: envoy.filters.http.lua
typed_config:
  "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
  inline_code: |
    function envoy_on_request(handle)
      local path = handle:headers():get(":path") or ""
      if string.find(path, "^/v2/webhooks/dispatch") then
        local body = handle:body()
        local payload = body and string.lower(body:getBytes(0, body:length())) or ""
        if string.find(payload, "169%.254%.169%.254") or string.find(payload, "metadata%.google%.internal") or string.find(payload, "gopher://") then
          handle:respond({[":status"] = "403", ["x-aegis-shield"] = "AEGIS-SHIELD-918"}, '{"blocked":true,"ruleId":"AEGIS-SHIELD-918"}')
        end
      end
    end`,
				},
			},
		},
		{
			Id:                 "aegis-blackbox-binary-elf",
			Name:               "iot-telemetry-daemon-v2.4.elf",
			Subtitle:           "Blackbox ELF64 Binary Upload — Disassembly, Hard Byte Patch & Sandbox Verification",
			IntakeMode:         IntakeModeBinary,
			TargetType:         TargetTypeBinary,
			RemediationMode:    RemediationModeBinaryPatch,
			DefenseStatus:      DefenseStatusBinaryHardPatched,
			BinaryFileName:     "iot-telemetry-daemon-v2.4.elf",
			DnsVerified:        true,
			LastScanDurationMs: 5340,
			UpdatedAt:          "2026-05-16T02:47:15Z",
			Vulnerabilities: []AegisVulnerabilityFinding{
				{
					Id:                         "VULN-CWE121-ELF",
					CveOrCwe:                   "CWE-121",
					Title:                      "Stack-Based Buffer Overflow in MQTT Topic Parser (parse_mqtt_topic)",
					Severity:                   "critical",
					CvssScore:                  9.8,
					Location:                   ".text:0x004012a4 <parse_mqtt_topic+0x44> (call strcpy@plt)",
					RootCause:                  "Function parse_mqtt_topic allocates a fixed 128-byte buffer on the stack (rbp-0x80) and invokes unbounded strcpy@plt from network packet buffer rdi/rsi without length validation or stack canary protection.",
					AttackVector:               "256-byte MQTT SUBSCRIBE topic frame overflowing rbp-0x80 and overwriting saved RIP at rbp+0x08 with 0x4141414141414141",
					PocPayload:                 "python3 -c 'import sys; sys.stdout.buffer.write(b\"MQTT\\x03\\x02\\x01\\x00\" + b\"A\"*216)' | ./iot-telemetry-daemon-v2.4.elf --stdin-packet",
					PocRedLog:                  "[SANDBOX-RED] Launching ./iot-telemetry-daemon-v2.4.elf (SHA256: 8f3c9d1a...) under QEMU/ptrace sandbox\n[INPUT] Feeding 224-byte MQTT SUBSCRIBE frame (216-byte topic payload)...\nProgram received signal SIGSEGV, Segmentation fault.\n0x00000000004012d9 in parse_mqtt_topic ()\nRegisters: RBP=0x4141414141414141 RIP=0x4141414141414141 RSP=0x7fffffffe310\n[EXIT 139] SIGSEGV (Fault address 0x4141414141414141) -> RED: VULNERABILITY CONFIRMED",
					VerifyGreenLog:             "[SANDBOX-GREEN] Launching ./iot-telemetry-daemon-v2.4-patched.elf (SHA256: 2a9e7f4b...) under QEMU/ptrace sandbox\n[INPUT] Feeding identical 224-byte MQTT SUBSCRIBE frame (216-byte topic payload)...\n[AEGIS-HARDPATCH] Bounds clamped to 127 bytes (RDX=0x7f) via strncpy@plt + null-terminator guard at [rbp-0x01]\n[DAEMON] MQTT topic normalized (len=127), packet handled cleanly.\n[EXIT 0] [AEGIS-HARDPATCH] Bounds clamped to 127 bytes -> Exit Code 0 -> GREEN: PATCH VERIFIED",
					ZeroFalsePositiveConfirmed: true,
				},
			},
			Timeline: []AegisTimelineStep{
				{
					Stage:        "recon",
					Title:        "Stage 1: ELF64 Header Inspection, Import Table & Disassembly",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1180,
					Summary:      "Analyzed ELF64 x86_64 binary (No PIE, No Stack Canary), enumerated PLT dangerous sinks, and disassembled parse_mqtt_topic at 0x00401260..0x004012dc.",
					CommandOrLog: "$ checksec --file=iot-telemetry-daemon-v2.4.elf -> NX: enabled | PIE: disabled (0x400000) | Canary: disabled | RELRO: partial\n[SINK] 0x004012a4: call 0x401030 <strcpy@plt> writing into [rbp-0x80] (128-byte buffer)",
					Timestamp:    "2026-05-16T02:47:05Z",
				},
				{
					Stage:        "poc_red",
					Title:        "Stage 2: Crash Input Synthesis & Register Control Proof (Red State)",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1420,
					Summary:      "Generated 224-byte MQTT frame overwriting saved RBP and RIP at offset 136, triggering deterministic SIGSEGV with RIP=0x4141414141414141.",
					CommandOrLog: "[RED] Child terminated with signal SIGSEGV (11) at 0x004012d9 | Saved RIP overwritten (0x4141414141414141) -> CONFIRMED CWE-121",
					Timestamp:    "2026-05-16T02:47:09Z",
				},
				{
					Stage:        "remediation",
					Title:        "Stage 3: Surgical x86_64 Machine-Code Hard Patch Synthesis",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1690,
					Summary:      "Rewrote instruction window at 0x0040129d..0x004012ad to load RDX=0x7f (127 bytes), redirect call to strncpy@plt (0x00401040), and force null byte at [rbp-0x01].",
					CommandOrLog: "[PATCH] 0x0040129d: ba 7f 00 00 00 (mov edx, 0x7f) | 0x004012a4: e8 97 fd ff ff (call strncpy@plt) | 0x004012a9: c6 45 ff 00 (mov byte ptr [rbp-1], 0)",
					Timestamp:    "2026-05-16T02:47:13Z",
				},
				{
					Stage:        "verify_green",
					Title:        "Stage 4: Patched Binary Re-Execution & Hash Attestation (Green State)",
					ModelUsed:    "gemini-4-argon (thinking_level: high)",
					Status:       "completed",
					DurationMs:   1050,
					Summary:      "Executed patched ELF64 binary against 224-byte crash input and 500 fuzzed MQTT frames; all exited cleanly with code 0 and zero memory corruption.",
					CommandOrLog: "[GREEN] SHA256(after)=2a9e7f4b1c8d3e6a... | Crash PoC -> Exit Code 0 | 500/500 MQTT regression frames PASS",
					Timestamp:    "2026-05-16T02:47:15Z",
				},
			},
			BinaryAnalysis: &AegisBinaryAnalysis{
				FileName:      "iot-telemetry-daemon-v2.4.elf",
				Format:        "ELF64-x86_64",
				FileSizeBytes: 184320,
				Sha256Before:  "8f3c9d1a0b7e4f2c6a91d8e3f5b2019c7a4d6e8f1b3c5a7d9e0f1a2b3c4d5e6f",
				Sha256After:   "2a9e7f4b1c8d3e6a5f0b9c2d4e6f8a1b3c5d7e9f0a2b4c6d8e1f3a5b7c9d0e2a",
				Protections: AegisBinaryProtections{
					NxEnabled:   true,
					PieEnabled:  false,
					StackCanary: false,
					Relro:       "partial",
				},
				DangerousSinks: []string{
					"strcpy@plt (0x004012a4)",
					"system@plt (0x00401410)",
					"sprintf@plt (0x00401588)",
				},
				PatchInstructions: []AegisBinaryPatchInstruction{
					{
						OffsetHex:      "0x0040129d",
						Section:        ".text",
						FunctionName:   "parse_mqtt_topic",
						BeforeBytesHex: "48 8d 45 80 48 89 c7 e8 87 fd ff ff",
						AfterBytesHex:  "ba 7f 00 00 00 48 89 c7 e8 97 fd ff ff",
						BeforeAsm:      "0x0040129d: lea rax, [rbp-0x80]\n0x004012a1: mov rdi, rax\n0x004012a4: call 0x401030 <strcpy@plt>",
						AfterAsm:       "0x0040129d: mov edx, 0x7f\n0x004012a2: mov rdi, rax\n0x004012a4: call 0x401040 <strncpy@plt>",
						Rationale:      "Clamps copy length in RDX to 127 bytes (0x7f) and redirects PLT call target from unbounded strcpy@plt (0x401030) to bounded strncpy@plt (0x401040).",
					},
					{
						OffsetHex:      "0x004012a9",
						Section:        ".text",
						FunctionName:   "parse_mqtt_topic",
						BeforeBytesHex: "90 90 90 90",
						AfterBytesHex:  "c6 45 ff 00",
						BeforeAsm:      "0x004012a9: nop\n0x004012aa: nop\n0x004012ab: nop\n0x004012ac: nop",
						AfterAsm:       "0x004012a9: mov byte ptr [rbp-0x01], 0x00",
						Rationale:      "Replaces compiler alignment NOP sled immediately following the copy call with an explicit null-terminator write at the 128th byte ([rbp-0x01]) so overlong topics remain valid C strings.",
					},
				},
				SandboxBeforeLog: "[SANDBOX-RED] ./iot-telemetry-daemon-v2.4.elf --stdin-packet < poc_224bytes.bin\nSIGSEGV (Fault address 0x4141414141414141) at 0x004012d9 in parse_mqtt_topic() -> RED: VULNERABILITY CONFIRMED",
				SandboxAfterLog:  "[SANDBOX-GREEN] ./iot-telemetry-daemon-v2.4-patched.elf --stdin-packet < poc_224bytes.bin\n[AEGIS-HARDPATCH] Bounds clamped to 127 bytes -> Exit Code 0 -> GREEN: PATCH VERIFIED",
				DownloadUrl:      "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-download",
			},
		},
	}
}
