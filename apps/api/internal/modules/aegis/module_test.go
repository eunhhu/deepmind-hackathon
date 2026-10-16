package aegis

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"deepmind/api/internal/argon"
	"deepmind/api/internal/modules"
	"deepmind/api/internal/store"

	"github.com/gin-gonic/gin"
)

func setupAegisTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	rg := r.Group("/api/modules/aegis")
	deps := &modules.Dependencies{
		Argon: argon.NewClient(""),
		Store: store.NewMemoryStore(),
	}
	mod := NewModule()
	mod.RegisterRoutes(rg, deps)
	return r
}

func decodeAegisProjects(t *testing.T, data []byte) []AegisProject {
	t.Helper()
	var wrapped struct {
		Projects []AegisProject `json:"projects"`
	}
	if err := json.Unmarshal(data, &wrapped); err == nil && wrapped.Projects != nil {
		return wrapped.Projects
	}
	var direct []AegisProject
	if err := json.Unmarshal(data, &direct); err != nil {
		t.Fatalf("failed to decode AegisProject slice: %v (body: %s)", err, string(data))
	}
	return direct
}

func decodeAegisProject(t *testing.T, data []byte) AegisProject {
	t.Helper()
	var wrapped AegisRunPipelineResponse
	if err := json.Unmarshal(data, &wrapped); err == nil && wrapped.Project.Id != "" {
		return wrapped.Project
	}
	var direct AegisProject
	if err := json.Unmarshal(data, &direct); err != nil {
		t.Fatalf("failed to decode AegisProject: %v (body: %s)", err, string(data))
	}
	return direct
}

func TestAegisSeedProjectsAndLifecycle(t *testing.T) {
	r := setupAegisTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list projects, got %d: %s", w.Code, w.Body.String())
	}

	projects := decodeAegisProjects(t, w.Body.Bytes())
	if len(projects) < 3 {
		t.Fatalf("expected at least 3 seed projects, got %d", len(projects))
	}

	// Create a new git project, scan, remediate, and delete
	createBody := `{"name":"test-git-service","intakeMode":"git","repoUrl":"https://github.com/acme/test-git-service"}`
	reqCreate := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects", strings.NewReader(createBody))
	reqCreate.Header.Set("Content-Type", "application/json")
	wCreate := httptest.NewRecorder()
	r.ServeHTTP(wCreate, reqCreate)

	if wCreate.Code != http.StatusCreated && wCreate.Code != http.StatusOK {
		t.Fatalf("expected 201/200 on create project, got %d: %s", wCreate.Code, wCreate.Body.String())
	}

	created := decodeAegisProject(t, wCreate.Body.Bytes())
	projID := created.Id
	if projID == "" {
		t.Fatalf("expected created project Id to be non-empty")
	}

	// Scan with dryRun=true
	reqScan := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/scan?dryRun=true", nil)
	wScan := httptest.NewRecorder()
	r.ServeHTTP(wScan, reqScan)
	if wScan.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on scan, got %d: %s", wScan.Code, wScan.Body.String())
	}

	// Remediate
	reqRem := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/remediate", nil)
	wRem := httptest.NewRecorder()
	r.ServeHTTP(wRem, reqRem)
	if wRem.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on remediate, got %d: %s", wRem.Code, wRem.Body.String())
	}

	// Delete
	reqDel := httptest.NewRequest(http.MethodDelete, "/api/modules/aegis/projects/"+projID, nil)
	wDel := httptest.NewRecorder()
	r.ServeHTTP(wDel, reqDel)
	if wDel.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d: %s", wDel.Code, wDel.Body.String())
	}
}

func TestAegisUrlDnsOwnershipGateAndScan(t *testing.T) {
	r := setupAegisTestRouter()

	createBody := `{"name":"unverified-edge","intakeMode":"url-dns","targetUrl":"https://edge.example.com/api/v1/login"}`
	reqCreate := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects", strings.NewReader(createBody))
	reqCreate.Header.Set("Content-Type", "application/json")
	wCreate := httptest.NewRecorder()
	r.ServeHTTP(wCreate, reqCreate)

	created := decodeAegisProject(t, wCreate.Body.Bytes())
	projID := created.Id

	// Attempting to scan before DNS verification must fail with 403 Forbidden
	reqScan := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/scan?dryRun=true", nil)
	wScan := httptest.NewRecorder()
	r.ServeHTTP(wScan, reqScan)
	if wScan.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when scanning unverified url-dns project, got %d", wScan.Code)
	}

	// Verify DNS with simulate=true
	reqVerify := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/verify-dns?simulate=true", nil)
	wVerify := httptest.NewRecorder()
	r.ServeHTTP(wVerify, reqVerify)
	if wVerify.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on simulated DNS verify, got %d: %s", wVerify.Code, wVerify.Body.String())
	}

	// Now scan must succeed
	reqScanAfter := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/scan?dryRun=true", nil)
	wScanAfter := httptest.NewRecorder()
	r.ServeHTTP(wScanAfter, reqScanAfter)
	if wScanAfter.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on scan after DNS verification, got %d: %s", wScanAfter.Code, wScanAfter.Body.String())
	}
}

func TestAegisRouteShieldRedToGreenLoop(t *testing.T) {
	r := setupAegisTestRouter()
	projID := "aegis-blackbox-url-shield"

	// Ensure shield is disabled first
	reqDisable := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/shield-toggle", strings.NewReader(`{"enabled":false}`))
	reqDisable.Header.Set("Content-Type", "application/json")
	wDisable := httptest.NewRecorder()
	r.ServeHTTP(wDisable, reqDisable)
	if wDisable.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on disable shield, got %d", wDisable.Code)
	}

	// Test attack while shield is disabled -> should not be blocked (Red state)
	reqAttackRed := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/test-attack", strings.NewReader(`{"attackPayload":"' OR 1=1 --"}`))
	reqAttackRed.Header.Set("Content-Type", "application/json")
	wAttackRed := httptest.NewRecorder()
	r.ServeHTTP(wAttackRed, reqAttackRed)
	if wAttackRed.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on test-attack, got %d", wAttackRed.Code)
	}

	// Enable shield
	reqEnable := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/shield-toggle", strings.NewReader(`{"enabled":true}`))
	reqEnable.Header.Set("Content-Type", "application/json")
	wEnable := httptest.NewRecorder()
	r.ServeHTTP(wEnable, reqEnable)
	if wEnable.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on enable shield, got %d", wEnable.Code)
	}

	// Test attack while shield is enabled -> blocked (Green state)
	reqAttackGreen := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/test-attack", strings.NewReader(`{"attackPayload":"' OR 1=1 --"}`))
	reqAttackGreen.Header.Set("Content-Type", "application/json")
	wAttackGreen := httptest.NewRecorder()
	r.ServeHTTP(wAttackGreen, reqAttackGreen)
	if wAttackGreen.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on test-attack with shield enabled, got %d", wAttackGreen.Code)
	}

	var attackResp AegisShieldTestAttackResponse
	if err := json.Unmarshal(wAttackGreen.Body.Bytes(), &attackResp); err != nil {
		t.Fatalf("failed to decode test-attack response: %v", err)
	}
	if !strings.Contains(wAttackGreen.Body.String(), `"blocked":true`) {
		t.Fatalf("expected attack to be blocked when shield is enabled, got: %s", wAttackGreen.Body.String())
	}

	// Also test reverse proxy middleware blocking malicious payload with 403
	reqProxyMalicious := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/shield-proxy", strings.NewReader(`{"query":"UNION SELECT username, password FROM users"}`))
	wProxyMalicious := httptest.NewRecorder()
	r.ServeHTTP(wProxyMalicious, reqProxyMalicious)
	if wProxyMalicious.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden from shield-proxy on SQLi payload, got %d", wProxyMalicious.Code)
	}
}

func TestAegisPatchedBinaryDownload(t *testing.T) {
	r := setupAegisTestRouter()
	projID := "aegis-blackbox-binary-elf"

	req := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects/"+projID+"/binary-download", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on binary-download, got %d: %s", w.Code, w.Body.String())
	}

	data := w.Body.Bytes()
	if len(data) < 64 {
		t.Fatalf("expected patched ELF binary of at least 64 bytes, got %d", len(data))
	}
	if !bytes.Equal(data[:4], []byte{0x7f, 'E', 'L', 'F'}) {
		t.Fatalf("expected ELF magic header \\x7fELF, got %v", data[:4])
	}
}

func TestAegisSseScanStreamAndTriModeEndpoints(t *testing.T) {
	r := setupAegisTestRouter()

	// 1. SSE Scan Stream
	reqStream := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects/aegis-whitebox-github/scan/stream?dryRun=true", nil)
	wStream := httptest.NewRecorder()
	r.ServeHTTP(wStream, reqStream)
	if wStream.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on SSE scan stream, got %d", wStream.Code)
	}
	bodyStr := wStream.Body.String()
	if !strings.Contains(bodyStr, "event: stage_update") || !strings.Contains(bodyStr, "event: scan_complete") {
		t.Fatalf("expected SSE stream to contain stage_update and scan_complete events, got: %s", bodyStr)
	}

	// 2. Create PR & Patch download for Mode A
	reqPR := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-whitebox-github/create-pr", nil)
	wPR := httptest.NewRecorder()
	r.ServeHTTP(wPR, reqPR)
	if wPR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on create-pr, got %d: %s", wPR.Code, wPR.Body.String())
	}

	reqPatch := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects/aegis-whitebox-github/patch-download", nil)
	wPatch := httptest.NewRecorder()
	r.ServeHTTP(wPatch, reqPatch)
	if wPatch.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on patch-download, got %d", wPatch.Code)
	}

	// 3. Shield Rule Patch for Mode B
	reqRule := httptest.NewRequest(http.MethodPatch, "/api/modules/aegis/projects/aegis-blackbox-url-shield/shield-rule", strings.NewReader(`{"wafPattern":"(?i)(union\\s+select|sleep\\()","rateLimitRps":30}`))
	reqRule.Header.Set("Content-Type", "application/json")
	wRule := httptest.NewRecorder()
	r.ServeHTTP(wRule, reqRule)
	if wRule.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on shield-rule update, got %d: %s", wRule.Code, wRule.Body.String())
	}

	// 4. Binary upload & Argon Polish for Mode C
	reqBin := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-upload", strings.NewReader(`{"fileName":"custom-gateway.elf","sizeBytes":65536}`))
	reqBin.Header.Set("Content-Type", "application/json")
	wBin := httptest.NewRecorder()
	r.ServeHTTP(wBin, reqBin)
	if wBin.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on binary-upload, got %d: %s", wBin.Code, wBin.Body.String())
	}

	reqPolish := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-blackbox-binary-elf/polish?dryRun=true", nil)
	wPolish := httptest.NewRecorder()
	r.ServeHTTP(wPolish, reqPolish)
	if wPolish.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on polish, got %d: %s", wPolish.Code, wPolish.Body.String())
	}
}

func TestAegisResetPurgesDummyProjects(t *testing.T) {
	r := setupAegisTestRouter()

	for _, name := range []string{"e2e-dummy-1", "e2e-dummy-2"} {
		body := `{"name":"` + name + `","intakeMode":"git","repoUrl":"https://github.com/acme/` + name + `"}`
		reqCreate := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects", strings.NewReader(body))
		reqCreate.Header.Set("Content-Type", "application/json")
		wCreate := httptest.NewRecorder()
		r.ServeHTTP(wCreate, reqCreate)
		if wCreate.Code != http.StatusCreated && wCreate.Code != http.StatusOK {
			t.Fatalf("expected 201/200 creating %s, got %d: %s", name, wCreate.Code, wCreate.Body.String())
		}
	}

	reqListBefore := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects", nil)
	wListBefore := httptest.NewRecorder()
	r.ServeHTTP(wListBefore, reqListBefore)
	if wListBefore.Code != http.StatusOK {
		t.Fatalf("expected 200 OK listing projects before reset, got %d", wListBefore.Code)
	}
	beforeProjects := decodeAegisProjects(t, wListBefore.Body.Bytes())
	if len(beforeProjects) != 5 {
		t.Fatalf("expected 5 projects before reset, got %d", len(beforeProjects))
	}

	reqReset := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/reset", nil)
	wReset := httptest.NewRecorder()
	r.ServeHTTP(wReset, reqReset)
	if wReset.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on POST /api/modules/aegis/reset, got %d: %s", wReset.Code, wReset.Body.String())
	}

	reqListAfter := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects", nil)
	wListAfter := httptest.NewRecorder()
	r.ServeHTTP(wListAfter, reqListAfter)
	if wListAfter.Code != http.StatusOK {
		t.Fatalf("expected 200 OK listing projects after reset, got %d", wListAfter.Code)
	}
	afterProjects := decodeAegisProjects(t, wListAfter.Body.Bytes())
	if len(afterProjects) != 3 {
		t.Fatalf("expected exactly 3 canonical seed projects after reset, got %d", len(afterProjects))
	}

	expectedIDs := map[string]bool{
		"aegis-whitebox-github":     false,
		"aegis-blackbox-url-shield": false,
		"aegis-blackbox-binary-elf": false,
	}
	for _, p := range afterProjects {
		if strings.HasPrefix(p.Id, "aegis-proj-") {
			t.Fatalf("found leftover dummy project %s after reset", p.Id)
		}
		if _, ok := expectedIDs[p.Id]; !ok {
			t.Fatalf("unexpected project ID %s after reset", p.Id)
		}
		expectedIDs[p.Id] = true
	}
	for id, seen := range expectedIDs {
		if !seen {
			t.Fatalf("missing canonical seed project %s after reset", id)
		}
	}
}

func TestAegisDynamicTargetArtifactsOnNewProjectScan(t *testing.T) {
	r := setupAegisTestRouter()

	createBody := `{"name":"korea-pay-webhook-edge","intakeMode":"url-dns","targetUrl":"https://pay.korea-fintech.kr/v3/settlement/callback"}`
	reqCreate := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects", strings.NewReader(createBody))
	reqCreate.Header.Set("Content-Type", "application/json")
	wCreate := httptest.NewRecorder()
	r.ServeHTTP(wCreate, reqCreate)
	if wCreate.Code != http.StatusCreated && wCreate.Code != http.StatusOK {
		t.Fatalf("expected 201/200 on create custom URL project, got %d: %s", wCreate.Code, wCreate.Body.String())
	}

	created := decodeAegisProject(t, wCreate.Body.Bytes())
	projID := created.Id

	// Verify DNS with simulate=true
	reqVerify := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/verify-dns?simulate=true", nil)
	wVerify := httptest.NewRecorder()
	r.ServeHTTP(wVerify, reqVerify)
	if wVerify.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on DNS verify, got %d: %s", wVerify.Code, wVerify.Body.String())
	}

	// Scan project with dryRun=true
	reqScan := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/scan?dryRun=true", nil)
	wScan := httptest.NewRecorder()
	r.ServeHTTP(wScan, reqScan)
	if wScan.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on scan, got %d: %s", wScan.Code, wScan.Body.String())
	}

	scanned := decodeAegisProject(t, wScan.Body.Bytes())
	if scanned.RouteShield.ProtectedPath != "/v3/settlement/callback" {
		t.Fatalf("expected routeShield.protectedPath to be '/v3/settlement/callback', got %q", scanned.RouteShield.ProtectedPath)
	}
	if len(scanned.Vulnerabilities) == 0 {
		t.Fatalf("expected scanned project to have vulnerabilities")
	}
	if !strings.Contains(scanned.Vulnerabilities[0].Location, "/v3/settlement/callback") {
		t.Fatalf("expected vulnerabilities[0].location to contain '/v3/settlement/callback', got %q", scanned.Vulnerabilities[0].Location)
	}
	if !strings.Contains(scanned.GitPrReport.PrTitle, "korea-pay-webhook-edge") {
		t.Fatalf("expected gitPrReport.prTitle to contain 'korea-pay-webhook-edge', got %+v", scanned.GitPrReport)
	}
	if !strings.Contains(scanned.GitPrReport.CodeDiff.Explanation, "korea-pay-webhook-edge") {
		t.Fatalf("expected gitPrReport.codeDiff.explanation to contain 'korea-pay-webhook-edge', got %+v", scanned.GitPrReport.CodeDiff)
	}
}
