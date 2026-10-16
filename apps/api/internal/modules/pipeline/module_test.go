package pipeline

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"deepmind/api/internal/argon"
	"deepmind/api/internal/modules"
	"deepmind/api/internal/store"
	"github.com/gin-gonic/gin"
)

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	deps := &modules.Dependencies{
		Argon: argon.NewClient(""),
		Store: store.NewMemoryStore(),
	}
	mod := NewModule()
	rg := r.Group(mod.Meta().APIPrefix)
	mod.RegisterRoutes(rg, deps)
	return r
}

func TestRouteEndpoint(t *testing.T) {
	router := setupTestRouter()

	payload := EffortRouteRequest{
		Prompt:             "Build an isolated container migration script and verify schema changes",
		ComplexityHint:     "sandbox",
		RequiresSandbox:    true,
		RequiresLongDecode: false,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/modules/pipeline/route", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var decision EffortRouteDecision
	if err := json.Unmarshal(w.Body.Bytes(), &decision); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if decision.Tier != "autonomous-sandbox" {
		t.Errorf("expected tier 'autonomous-sandbox', got %q", decision.Tier)
	}
	if decision.Model != "gemini-4-argon" {
		t.Errorf("expected model 'gemini-4-argon', got %q", decision.Model)
	}
	if decision.ThinkingLevel != "high" {
		t.Errorf("expected thinkingLevel 'high', got %q", decision.ThinkingLevel)
	}
	if !decision.UseManagedAgent || !decision.Background {
		t.Errorf("expected managed background agent to be enabled, got background=%v managed=%v", decision.Background, decision.UseManagedAgent)
	}
}

func TestPolishEndpointDryRun(t *testing.T) {
	router := setupTestRouter()

	payload := VerifyCritiquePolishRequest{
		ArtifactTitle: "SwarmDispatcherCard.tsx",
		ArtifactType:  "ui-preline",
		DraftContent:  "<button onClick={run}>Launch Swarm</button>",
		Requirements:  "Add explicit type=\"button\" and Preline semantic tokens",
		SharedContext: "SolidJS + Preline UI dashboard",
		DryRun:        true,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/modules/pipeline/polish?dryRun=true", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp VerifyCritiquePolishResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.ArtifactTitle != "SwarmDispatcherCard.tsx" {
		t.Errorf("expected artifactTitle 'SwarmDispatcherCard.tsx', got %q", resp.ArtifactTitle)
	}
	if resp.ParallelDraftsCount != 2 {
		t.Errorf("expected parallelDraftsCount 2, got %d", resp.ParallelDraftsCount)
	}
	if resp.FinalScore <= resp.InitialScore {
		t.Errorf("expected finalScore (%f) > initialScore (%f)", resp.FinalScore, resp.InitialScore)
	}
	if len(resp.CritiqueItems) == 0 || resp.CritiqueItems[0].Score <= 0 {
		t.Errorf("expected non-empty critiqueItems with positive score")
	}
	if resp.PolishedOutput == "" {
		t.Errorf("expected non-empty polishedOutput")
	}
	if len(resp.Steps) < 3 {
		t.Errorf("expected at least 3 steps, got %d", len(resp.Steps))
	}
}
