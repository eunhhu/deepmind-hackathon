package aegis

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func setupAegisTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	mod := NewModule()
	rg := r.Group(mod.Meta().APIPrefix)
	mod.RegisterRoutes(rg, nil)
	return r
}

func extractMap(t *testing.T, body []byte, wrapperKey string) map[string]any {
	t.Helper()
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatalf("failed to unmarshal JSON response: %v (body: %s)", err, string(body))
	}
	if wrapperKey != "" {
		if nested, ok := raw[wrapperKey].(map[string]any); ok {
			return nested
		}
	}
	return raw
}

func TestAegisSeedProjectsAndLifecycle(t *testing.T) {
	router := setupAegisTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from GET /projects, got %d: %s", w.Code, w.Body.String())
	}

	var projectsList []map[string]any
	var wrapped struct {
		Projects []map[string]any `json:"projects"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &wrapped); err == nil && len(wrapped.Projects) > 0 {
		projectsList = wrapped.Projects
	} else if err := json.Unmarshal(w.Body.Bytes(), &projectsList); err != nil {
		t.Fatalf("failed to parse projects list: %v (body: %s)", err, w.Body.String())
	}

	if len(projectsList) < 3 {
		t.Fatalf("expected at least 3 seeded flagship projects, got %d", len(projectsList))
	}

	found := map[string]bool{}
	for _, p := range projectsList {
		if id, ok := p["id"].(string); ok {
			found[id] = true
		}
	}

	expectedIDs := []string{
		"aegis-whitebox-github",
		"aegis-blackbox-url-shield",
		"aegis-blackbox-binary-elf",
	}
	for _, id := range expectedIDs {
		if !found[id] {
			t.Errorf("expected seeded flagship project %q to be present, got %v", id, found)
		}
	}
}

func TestAegisUrlDnsOwnershipGateAndScan(t *testing.T) {
	router := setupAegisTestRouter()

	// 1. Create URL-DNS project
	createPayload := `{"name":"external-api","intakeMode":"url-dns","targetUrl":"https://api.example-target.io/v1/charge"}`
	reqCreate := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects", bytes.NewBufferString(createPayload))
	reqCreate.Header.Set("Content-Type", "application/json")
	wCreate := httptest.NewRecorder()
	router.ServeHTTP(wCreate, reqCreate)

	if wCreate.Code != http.StatusOK && wCreate.Code != http.StatusCreated {
		t.Fatalf("expected 200 or 201 on project creation, got %d: %s", wCreate.Code, wCreate.Body.String())
	}

	proj := extractMap(t, wCreate.Body.Bytes(), "project")
	projID, _ := proj["id"].(string)
	if projID == "" {
		t.Fatalf("expected non-empty project id, got: %v", proj)
	}

	dnsVerified, _ := proj["dnsVerified"].(bool)
	if dnsVerified {
		t.Fatalf("expected dnsVerified == false before DNS verification")
	}

	dnsTxtName, _ := proj["dnsTxtRecordName"].(string)
	if !strings.Contains(dnsTxtName, "_aegis-verify.") || !strings.Contains(dnsTxtName, "example-target.io") {
		t.Fatalf("expected dnsTxtRecordName to contain _aegis-verify and example-target.io, got %q", dnsTxtName)
	}

	// 2. Attempt scan BEFORE DNS verification -> must return 403 Forbidden
	reqScanBlocked := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/scan?dryRun=true", bytes.NewBufferString(`{}`))
	reqScanBlocked.Header.Set("Content-Type", "application/json")
	wScanBlocked := httptest.NewRecorder()
	router.ServeHTTP(wScanBlocked, reqScanBlocked)

	if wScanBlocked.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when scanning unverified URL-DNS target, got %d: %s", wScanBlocked.Code, wScanBlocked.Body.String())
	}

	// 3. Verify DNS with simulated TXT propagation
	verifyPayload := `{"simulateTxtPropagation":true}`
	reqVerify := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/verify-dns?simulate=true", bytes.NewBufferString(verifyPayload))
	reqVerify.Header.Set("Content-Type", "application/json")
	wVerify := httptest.NewRecorder()
	router.ServeHTTP(wVerify, reqVerify)

	if wVerify.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on verify-dns, got %d: %s", wVerify.Code, wVerify.Body.String())
	}

	verifiedProj := extractMap(t, wVerify.Body.Bytes(), "project")
	verifiedFlag, _ := verifiedProj["dnsVerified"].(bool)
	if !verifiedFlag {
		// Also check top-level dnsVerified if response wraps both
		topLevel := extractMap(t, wVerify.Body.Bytes(), "")
		if topFlag, ok := topLevel["dnsVerified"].(bool); !ok || !topFlag {
			t.Fatalf("expected dnsVerified == true after verify-dns, got %v", wVerify.Body.String())
		}
	}

	// 4. Scan AFTER DNS verification -> must return 200 OK with updated timeline
	reqScanOK := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/"+projID+"/scan?dryRun=true", bytes.NewBufferString(`{}`))
	reqScanOK.Header.Set("Content-Type", "application/json")
	wScanOK := httptest.NewRecorder()
	router.ServeHTTP(wScanOK, reqScanOK)

	if wScanOK.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on scan after DNS verification, got %d: %s", wScanOK.Code, wScanOK.Body.String())
	}

	scannedProj := extractMap(t, wScanOK.Body.Bytes(), "project")
	timeline, ok := scannedProj["timeline"].([]any)
	if !ok {
		topLevel := extractMap(t, wScanOK.Body.Bytes(), "")
		timeline, _ = topLevel["timeline"].([]any)
	}
	if len(timeline) == 0 {
		t.Fatalf("expected non-empty timeline after scan, got %s", wScanOK.Body.String())
	}
}

func TestAegisRouteShieldRedToGreenLoop(t *testing.T) {
	router := setupAegisTestRouter()

	// 1. Toggle shield OFF
	reqDisable := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-blackbox-url-shield/shield-toggle", bytes.NewBufferString(`{"enabled":false}`))
	reqDisable.Header.Set("Content-Type", "application/json")
	wDisable := httptest.NewRecorder()
	router.ServeHTTP(wDisable, reqDisable)

	if wDisable.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on shield-toggle (disable), got %d: %s", wDisable.Code, wDisable.Body.String())
	}

	// 2. Test attack with shield OFF -> EXPLOITED_RED (httpStatus 200)
	reqAttackRed := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-blackbox-url-shield/test-attack", bytes.NewBufferString(`{}`))
	reqAttackRed.Header.Set("Content-Type", "application/json")
	wAttackRed := httptest.NewRecorder()
	router.ServeHTTP(wAttackRed, reqAttackRed)

	if wAttackRed.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from test-attack endpoint, got %d: %s", wAttackRed.Code, wAttackRed.Body.String())
	}

	redResult := extractMap(t, wAttackRed.Body.Bytes(), "result")
	if _, ok := redResult["verdict"]; !ok {
		redResult = extractMap(t, wAttackRed.Body.Bytes(), "attackResult")
	}
	if ver, _ := redResult["verdict"].(string); ver != "EXPLOITED_RED" {
		t.Fatalf("expected verdict == EXPLOITED_RED when shield is disabled, got %q (body: %s)", ver, wAttackRed.Body.String())
	}
	if status, _ := redResult["httpStatus"].(float64); int(status) != http.StatusOK {
		t.Fatalf("expected httpStatus == 200 when shield is disabled, got %v", redResult["httpStatus"])
	}

	// 3. Toggle shield ON
	reqEnable := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-blackbox-url-shield/shield-toggle", bytes.NewBufferString(`{"enabled":true}`))
	reqEnable.Header.Set("Content-Type", "application/json")
	wEnable := httptest.NewRecorder()
	router.ServeHTTP(wEnable, reqEnable)

	if wEnable.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on shield-toggle (enable), got %d: %s", wEnable.Code, wEnable.Body.String())
	}

	// 4. Test attack with shield ON -> BLOCKED_GREEN (httpStatus 403)
	reqAttackGreen := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-blackbox-url-shield/test-attack", bytes.NewBufferString(`{}`))
	reqAttackGreen.Header.Set("Content-Type", "application/json")
	wAttackGreen := httptest.NewRecorder()
	router.ServeHTTP(wAttackGreen, reqAttackGreen)

	if wAttackGreen.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from test-attack endpoint, got %d: %s", wAttackGreen.Code, wAttackGreen.Body.String())
	}

	greenResult := extractMap(t, wAttackGreen.Body.Bytes(), "result")
	if _, ok := greenResult["verdict"]; !ok {
		greenResult = extractMap(t, wAttackGreen.Body.Bytes(), "attackResult")
	}
	if ver, _ := greenResult["verdict"].(string); ver != "BLOCKED_GREEN" {
		t.Fatalf("expected verdict == BLOCKED_GREEN when shield is enabled, got %q (body: %s)", ver, wAttackGreen.Body.String())
	}
	if status, _ := greenResult["httpStatus"].(float64); int(status) != http.StatusForbidden {
		t.Fatalf("expected httpStatus == 403 when shield is enabled, got %v", greenResult["httpStatus"])
	}
}

func TestAegisPatchedBinaryDownload(t *testing.T) {
	router := setupAegisTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-download", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from binary-download, got %d: %s", w.Code, w.Body.String())
	}

	payload := w.Body.Bytes()
	if len(payload) < 4 {
		t.Fatalf("expected non-empty ELF binary payload, got %d bytes", len(payload))
	}

	elfMagic := []byte{0x7f, 'E', 'L', 'F'}
	if !bytes.HasPrefix(payload, elfMagic) {
		t.Fatalf("expected payload to start with \\x7fELF, got %x", payload[:4])
	}
}
