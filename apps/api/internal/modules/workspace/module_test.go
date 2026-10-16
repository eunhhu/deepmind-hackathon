package workspace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"deepmind/api/internal/argon"
	"deepmind/api/internal/auth"
	"deepmind/api/internal/modules"
	"deepmind/api/internal/store"

	"github.com/gin-gonic/gin"
)

func TestWorkspaceModuleFullLifecycle(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	deps := &modules.Dependencies{
		Argon:    argon.NewClient(""),
		Store:    store.NewMemoryStore(),
		Verifier: auth.NewVerifier("h2gdm-hack26icn-2693"),
	}

	reg := modules.NewRegistry()
	reg.Register(New())
	reg.Mount(r, deps)

	// 0. GET /api/modules
	wMeta := httptest.NewRecorder()
	reqMeta, _ := http.NewRequest(http.MethodGet, "/api/modules", nil)
	r.ServeHTTP(wMeta, reqMeta)
	if wMeta.Code != http.StatusOK {
		t.Fatalf("GET /api/modules expected 200, got %d", wMeta.Code)
	}
	var metas []modules.FeatureModuleMeta
	if err := json.Unmarshal(wMeta.Body.Bytes(), &metas); err != nil {
		t.Fatalf("unmarshal modules meta: %v", err)
	}
	if len(metas) != 1 || metas[0].ID != "workspace" {
		t.Fatalf("expected workspace module meta, got %+v", metas)
	}

	// 1. GET /api/modules/workspace/items -> seeds 2 starter items
	wList := httptest.NewRecorder()
	reqList, _ := http.NewRequest(http.MethodGet, "/api/modules/workspace/items", nil)
	reqList.Header.Set("X-Demo-User", "tester-1")
	r.ServeHTTP(wList, reqList)
	if wList.Code != http.StatusOK {
		t.Fatalf("GET /items expected 200, got %d: %s", wList.Code, wList.Body.String())
	}
	var listResp store.ListEntitiesResponse
	if err := json.Unmarshal(wList.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("unmarshal list response: %v", err)
	}
	if len(listResp.Items) != 2 {
		t.Fatalf("expected 2 seeded starter items, got %d", len(listResp.Items))
	}

	// 2. POST /api/modules/workspace/items -> create new item
	createBody, _ := json.Marshal(map[string]interface{}{
		"id": "custom-item-1",
		"data": map[string]interface{}{
			"title":       "Build Multi-Agent Pipeline",
			"description": "Coordinate parallel Firestore and Gemini 4 Argon tasks",
			"status":      "todo",
			"category":    "agents",
			"tags":        []string{"argon"},
		},
	})
	wCreate := httptest.NewRecorder()
	reqCreate, _ := http.NewRequest(http.MethodPost, "/api/modules/workspace/items", bytes.NewReader(createBody))
	reqCreate.Header.Set("Content-Type", "application/json")
	reqCreate.Header.Set("X-Demo-User", "tester-1")
	r.ServeHTTP(wCreate, reqCreate)
	if wCreate.Code != http.StatusCreated {
		t.Fatalf("POST /items expected 201, got %d: %s", wCreate.Code, wCreate.Body.String())
	}
	var created store.EntityRecord
	if err := json.Unmarshal(wCreate.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created item: %v", err)
	}
	if created.ID != "custom-item-1" || created.Data["title"] != "Build Multi-Agent Pipeline" {
		t.Fatalf("unexpected created item: %+v", created)
	}

	// 3. PATCH /api/modules/workspace/items/:id -> update status
	patchBody, _ := json.Marshal(map[string]interface{}{
		"status": "in_progress",
	})
	wPatch := httptest.NewRecorder()
	reqPatch, _ := http.NewRequest(http.MethodPatch, "/api/modules/workspace/items/custom-item-1", bytes.NewReader(patchBody))
	reqPatch.Header.Set("Content-Type", "application/json")
	reqPatch.Header.Set("X-Demo-User", "tester-1")
	r.ServeHTTP(wPatch, reqPatch)
	if wPatch.Code != http.StatusOK {
		t.Fatalf("PATCH /items/:id expected 200, got %d: %s", wPatch.Code, wPatch.Body.String())
	}
	var patched store.EntityRecord
	if err := json.Unmarshal(wPatch.Body.Bytes(), &patched); err != nil {
		t.Fatalf("unmarshal patched item: %v", err)
	}
	if patched.Data["status"] != "in_progress" {
		t.Fatalf("expected status in_progress, got %v", patched.Data["status"])
	}

	// 4. POST /api/modules/workspace/synthesize?dryRun=true -> synthesize & attach to custom-item-1
	synthBody, _ := json.Marshal(WorkspaceAiSynthesizeRequest{
		ItemID:      "custom-item-1",
		Title:       "Build Multi-Agent Pipeline",
		Description: "Coordinate parallel Firestore and Gemini 4 Argon tasks",
	})
	wSynth := httptest.NewRecorder()
	reqSynth, _ := http.NewRequest(http.MethodPost, "/api/modules/workspace/synthesize?dryRun=true", bytes.NewReader(synthBody))
	reqSynth.Header.Set("Content-Type", "application/json")
	reqSynth.Header.Set("X-Demo-User", "tester-1")
	r.ServeHTTP(wSynth, reqSynth)
	if wSynth.Code != http.StatusOK {
		t.Fatalf("POST /synthesize expected 200, got %d: %s", wSynth.Code, wSynth.Body.String())
	}
	var synthResp WorkspaceAiSynthesizeResponse
	if err := json.Unmarshal(wSynth.Body.Bytes(), &synthResp); err != nil {
		t.Fatalf("unmarshal synthesize response: %v", err)
	}
	if synthResp.AISummary == "" || synthResp.InteractionID == "" || synthResp.Item == nil {
		t.Fatalf("expected non-empty synthesis and updated item, got %+v", synthResp)
	}

	// 5. DELETE /api/modules/workspace/items/:id
	wDel := httptest.NewRecorder()
	reqDel, _ := http.NewRequest(http.MethodDelete, "/api/modules/workspace/items/custom-item-1", nil)
	reqDel.Header.Set("X-Demo-User", "tester-1")
	r.ServeHTTP(wDel, reqDel)
	if wDel.Code != http.StatusOK {
		t.Fatalf("DELETE /items/:id expected 200, got %d: %s", wDel.Code, wDel.Body.String())
	}
}
