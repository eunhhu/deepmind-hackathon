package aegis

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
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

	sum := sha256.Sum256(payload)
	actualSha := hex.EncodeToString(sum[:])
	headerShaAfter := w.Header().Get("X-Aegis-SHA256-After")
	if headerShaAfter == "" || headerShaAfter != actualSha {
		t.Fatalf("expected downloaded binary sha256 (%s) to match X-Aegis-SHA256-After (%s)", actualSha, headerShaAfter)
	}
}

func TestAegisBinaryUploadAndCryptographicPatchMatch(t *testing.T) {
	router := setupAegisTestRouter()

	unpatched := BuildDefaultUnpatchedELF64("custom-edge-router.elf")
	b64 := base64.StdEncoding.EncodeToString(unpatched)
	uploadBody := `{"fileName":"custom-edge-router.elf","format":"ELF64","base64Data":"` + b64 + `"}`

	reqUp := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-upload", bytes.NewBufferString(uploadBody))
	reqUp.Header.Set("Content-Type", "application/json")
	wUp := httptest.NewRecorder()
	router.ServeHTTP(wUp, reqUp)

	if wUp.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from binary-upload, got %d: %s", wUp.Code, wUp.Body.String())
	}

	analysis := extractMap(t, wUp.Body.Bytes(), "binaryAnalysis")
	shaBefore, _ := analysis["sha256Before"].(string)
	shaAfter, _ := analysis["sha256After"].(string)
	if shaBefore == "" || shaAfter == "" || shaBefore == shaAfter {
		t.Fatalf("expected distinct non-empty sha256Before (%s) and sha256After (%s)", shaBefore, shaAfter)
	}

	reqDown := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects/aegis-blackbox-binary-elf/binary-download", nil)
	wDown := httptest.NewRecorder()
	router.ServeHTTP(wDown, reqDown)

	if wDown.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from binary-download after upload, got %d", wDown.Code)
	}
	dlSum := sha256.Sum256(wDown.Body.Bytes())
	dlHex := hex.EncodeToString(dlSum[:])
	if dlHex != shaAfter {
		t.Fatalf("expected downloaded binary sha256 (%s) to match binaryAnalysis.sha256After (%s)", dlHex, shaAfter)
	}
}

func TestAegisScanStreamSSEAndRemediationEndpoints(t *testing.T) {
	router := setupAegisTestRouter()

	// 1. Test SSE /scan/stream
	reqStream := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-whitebox-github/scan/stream?dryRun=true", bytes.NewBufferString(`{"remediationMode":"git-pr","dryRun":true}`))
	reqStream.Header.Set("Content-Type", "application/json")
	wStream := httptest.NewRecorder()
	router.ServeHTTP(wStream, reqStream)

	if wStream.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from scan/stream, got %d: %s", wStream.Code, wStream.Body.String())
	}
	sseOut := wStream.Body.String()
	if !strings.Contains(sseOut, "event: stage_update") || !strings.Contains(sseOut, "event: scan_complete") {
		t.Fatalf("expected SSE output to contain stage_update and scan_complete events, got: %s", sseOut)
	}

	// 2. Test GET /patch-download
	reqPatch := httptest.NewRequest(http.MethodGet, "/api/modules/aegis/projects/aegis-whitebox-github/patch-download", nil)
	wPatch := httptest.NewRecorder()
	router.ServeHTTP(wPatch, reqPatch)
	if wPatch.Code != http.StatusOK || !strings.Contains(wPatch.Body.String(), "diff --git") {
		t.Fatalf("expected valid git format-patch from /patch-download, got %d: %s", wPatch.Code, wPatch.Body.String())
	}

	// 3. Test POST /create-pr
	reqPR := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-whitebox-github/create-pr", bytes.NewBufferString(`{}`))
	wPR := httptest.NewRecorder()
	router.ServeHTTP(wPR, reqPR)
	if wPR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /create-pr, got %d: %s", wPR.Code, wPR.Body.String())
	}
	prMap := extractMap(t, wPR.Body.Bytes(), "")
	if status, _ := prMap["status"].(string); status != "opened" {
		t.Fatalf("expected status == opened from /create-pr, got %q", status)
	}

	// 4. Test POST /polish
	reqPolish := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/projects/aegis-whitebox-github/polish", bytes.NewBufferString(`{}`))
	wPolish := httptest.NewRecorder()
	router.ServeHTTP(wPolish, reqPolish)
	if wPolish.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /polish, got %d: %s", wPolish.Code, wPolish.Body.String())
	}

	// 5. Test PATCH /shield-rule and live /shield-proxy gateway
	reqRule := httptest.NewRequest(http.MethodPatch, "/api/modules/aegis/projects/aegis-blackbox-url-shield/shield-rule", bytes.NewBufferString(`{"protectedPath":"/api/v1/webhooks/*","mitigationPattern":"(?i)(169\\.254\\.169\\.254|metadata\\.google\\.internal)","rateLimitPerMinute":90}`))
	reqRule.Header.Set("Content-Type", "application/json")
	wRule := httptest.NewRecorder()
	router.ServeHTTP(wRule, reqRule)
	if wRule.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from PATCH /shield-rule, got %d: %s", wRule.Code, wRule.Body.String())
	}

	reqProxyAttack := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/shield-proxy/aegis-blackbox-url-shield/api/v1/webhooks/preview", bytes.NewBufferString(`{"url":"http://169.254.169.254/computeMetadata/v1/"}`))
	reqProxyAttack.Header.Set("Content-Type", "application/json")
	wProxyAttack := httptest.NewRecorder()
	router.ServeHTTP(wProxyAttack, reqProxyAttack)
	if wProxyAttack.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden from live /shield-proxy on SSRF payload, got %d: %s", wProxyAttack.Code, wProxyAttack.Body.String())
	}

	reqProxyClean := httptest.NewRequest(http.MethodPost, "/api/modules/aegis/shield-proxy/aegis-blackbox-url-shield/api/v1/webhooks/preview", bytes.NewBufferString(`{"url":"https://hooks.stripe.com/events/evt_123"}`))
	reqProxyClean.Header.Set("Content-Type", "application/json")
	wProxyClean := httptest.NewRecorder()
	router.ServeHTTP(wProxyClean, reqProxyClean)
	if wProxyClean.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from live /shield-proxy on clean payload, got %d: %s", wProxyClean.Code, wProxyClean.Body.String())
	}
}

