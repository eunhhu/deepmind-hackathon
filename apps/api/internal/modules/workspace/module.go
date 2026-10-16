package workspace

import (
	"fmt"
	"net/http"
	"strings"
	"sync"

	"deepmind/api/internal/argon"
	"deepmind/api/internal/auth"
	"deepmind/api/internal/modules"
	"deepmind/api/internal/store"

	"github.com/gin-gonic/gin"
)

const (
	ModuleID       = "workspace"
	CollectionName = "workspace_items"
	AgentUnitID    = "workspace-synthesizer"
)

// WorkspaceAiSynthesizeRequest mirrors packages/shared/src/index.ts WorkspaceAiSynthesizeRequest
type WorkspaceAiSynthesizeRequest struct {
	ItemID        string                   `json:"itemId,omitempty"`
	Title         string                   `json:"title"`
	Description   string                   `json:"description"`
	ThinkingLevel argon.ArgonThinkingLevel `json:"thinkingLevel,omitempty"`
	DryRun        bool                     `json:"dryRun,omitempty"`
}

// WorkspaceAiSynthesizeResponse mirrors packages/shared/src/index.ts WorkspaceAiSynthesizeResponse
type WorkspaceAiSynthesizeResponse struct {
	Item          *store.EntityRecord `json:"item,omitempty"`
	AISummary     string              `json:"aiSummary"`
	SuggestedTags []string            `json:"suggestedTags"`
	InteractionID string              `json:"interactionId"`
	DurationMs    int64               `json:"durationMs"`
}

// Module implements the starter "workspace" plug-and-play backend feature unit.
type Module struct {
	seedMu       sync.Mutex
	seededOwners map[string]bool
}

// New creates a new Workspace feature module instance.
func New() *Module {
	return &Module{
		seededOwners: make(map[string]bool),
	}
}

func (m *Module) Meta() modules.FeatureModuleMeta {
	return modules.FeatureModuleMeta{
		ID:           ModuleID,
		Title:        "Parallel Workspace",
		Subtitle:     "Firestore-backed task & architecture board with Gemini 4 Argon synthesis",
		Badge:        "STARTER UNIT",
		APIPrefix:    "/api/modules/workspace",
		Collections:  []string{CollectionName},
		AgentUnitIDs: []string{AgentUnitID},
	}
}

func (m *Module) RegisterRoutes(rg *gin.RouterGroup, deps *modules.Dependencies) {
	rg.GET("/items", func(c *gin.Context) {
		user := auth.CurrentUser(c)
		ctx := c.Request.Context()

		items, err := deps.Store.List(ctx, CollectionName, user.UID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if len(items) == 0 && m.shouldSeed(user.UID) {
			starters := defaultStarterItems()
			for _, st := range starters {
				id, _ := st["id"].(string)
				delete(st, "id")
				_, _ = deps.Store.Put(ctx, CollectionName, id, user.UID, st)
			}
			items, _ = deps.Store.List(ctx, CollectionName, user.UID)
		}

		c.JSON(http.StatusOK, store.ListEntitiesResponse{
			Collection: CollectionName,
			Backend:    deps.Store.Backend(),
			Items:      items,
		})
	})

	rg.POST("/items", func(c *gin.Context) {
		user := auth.CurrentUser(c)
		var raw map[string]interface{}
		if err := c.ShouldBindJSON(&raw); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		id, _ := raw["id"].(string)
		data := extractDataMap(raw)
		normalizeWorkspaceItemData(data)

		rec, err := deps.Store.Put(c.Request.Context(), CollectionName, id, user.UID, data)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, rec)
	})

	rg.PATCH("/items/:id", func(c *gin.Context) {
		id := strings.TrimSpace(c.Param("id"))
		var raw map[string]interface{}
		if err := c.ShouldBindJSON(&raw); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		patch := extractDataMap(raw)
		rec, ok, err := deps.Store.Update(c.Request.Context(), CollectionName, id, patch)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("workspace item %q not found", id)})
			return
		}
		c.JSON(http.StatusOK, rec)
	})

	rg.DELETE("/items/:id", func(c *gin.Context) {
		id := strings.TrimSpace(c.Param("id"))
		deleted, err := deps.Store.Delete(c.Request.Context(), CollectionName, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !deleted {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("workspace item %q not found", id)})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deleted": true, "id": id})
	})

	rg.POST("/synthesize", func(c *gin.Context) {
		var req WorkspaceAiSynthesizeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		thinking := req.ThinkingLevel
		if thinking == "" {
			thinking = argon.ThinkingLow
		}
		dryRun := req.DryRun || strings.EqualFold(c.Query("dryRun"), "true") || c.Query("dryRun") == "1"

		prompt := fmt.Sprintf(
			"Synthesize a concise, high-signal technical action summary (2-3 sentences) and key architectural focus for this workspace item:\nTitle: %s\nDescription: %s",
			strings.TrimSpace(req.Title),
			strings.TrimSpace(req.Description),
		)
		systemInstruction := "You are a Gemini 4 Argon technical synthesizer. Produce a crisp executive engineering summary with actionable next steps."

		taskRes := deps.Argon.RunTask(
			c.Request.Context(),
			argon.ParallelTaskInput{
				ID:              AgentUnitID,
				Label:           "Workspace Synthesizer",
				Prompt:          prompt,
				ThinkingLevel:   thinking,
				MaxOutputTokens: 4096,
			},
			systemInstruction,
			dryRun,
		)

		aiSummary := strings.TrimSpace(taskRes.OutputText)
		if aiSummary == "" {
			aiSummary = fmt.Sprintf("Argon synthesis for %q: prioritize zero-overhead execution and modular verification.", req.Title)
		}
		tags := inferTags(req.Title, req.Description)

		var updatedItem *store.EntityRecord
		if itemID := strings.TrimSpace(req.ItemID); itemID != "" {
			if rec, ok, err := deps.Store.Update(c.Request.Context(), CollectionName, itemID, map[string]interface{}{
				"aiSummary": aiSummary,
				"tags":      tags,
			}); err == nil && ok {
				updatedItem = &rec
			}
		}

		c.JSON(http.StatusOK, WorkspaceAiSynthesizeResponse{
			Item:          updatedItem,
			AISummary:     aiSummary,
			SuggestedTags: tags,
			InteractionID: taskRes.InteractionID,
			DurationMs:    taskRes.DurationMs,
		})
	})
}

func (m *Module) shouldSeed(ownerUID string) bool {
	m.seedMu.Lock()
	defer m.seedMu.Unlock()
	if m.seededOwners[ownerUID] {
		return false
	}
	m.seededOwners[ownerUID] = true
	return true
}

func extractDataMap(raw map[string]interface{}) map[string]interface{} {
	if raw == nil {
		return map[string]interface{}{}
	}
	if nested, ok := raw["data"].(map[string]interface{}); ok {
		return nested
	}
	out := make(map[string]interface{}, len(raw))
	for k, v := range raw {
		if k == "id" {
			continue
		}
		out[k] = v
	}
	return out
}

func normalizeWorkspaceItemData(data map[string]interface{}) {
	if _, ok := data["title"]; !ok {
		data["title"] = "Untitled Workspace Item"
	}
	if _, ok := data["description"]; !ok {
		data["description"] = ""
	}
	if status, ok := data["status"].(string); !ok || strings.TrimSpace(status) == "" {
		data["status"] = "todo"
	}
	if cat, ok := data["category"].(string); !ok || strings.TrimSpace(cat) == "" {
		data["category"] = "architecture"
	}
	if _, ok := data["tags"]; !ok {
		data["tags"] = []string{"gemini-4-argon", "parallel"}
	}
}

func inferTags(title, description string) []string {
	combined := strings.ToLower(title + " " + description)
	tags := []string{"gemini-4-argon"}
	candidates := []struct {
		keyword string
		tag     string
	}{
		{"firestore", "firestore"},
		{"auth", "firebase-auth"},
		{"firebase", "firebase-auth"},
		{"parallel", "parallel-swarm"},
		{"swarm", "parallel-swarm"},
		{"cache", "implicit-cache"},
		{"solid", "solidjs"},
		{"gin", "go-gin"},
		{"agent", "antigravity-agent"},
	}
	for _, c := range candidates {
		if strings.Contains(combined, c.keyword) {
			tags = append(tags, c.tag)
		}
	}
	if len(tags) == 1 {
		tags = append(tags, "architecture", "hackathon")
	}
	return tags
}

func defaultStarterItems() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          "starter-argon-fork",
			"title":       "Verify 95% Implicit Cache Root Forking",
			"description": "Share a >4,096 token baseline across parallel worker goroutines via previous_interaction_id on Gemini 4 Argon.",
			"status":      "in_progress",
			"category":    "argon-engine",
			"aiSummary":   "Root context interaction anchors shared system invariants once; parallel worker goroutines fork with previous_interaction_id for 95% implicit cache savings.",
			"tags":        []string{"gemini-4-argon", "implicit-cache", "go-gin"},
		},
		{
			"id":          "starter-firestore-dual",
			"title":       "Ship Plug-and-Play Feature Module on DualStore",
			"description": "Persist domain entities through Cloud Firestore Native REST with zero-latency in-memory write-through fallback.",
			"status":      "todo",
			"category":    "storage",
			"aiSummary":   "DualStore automatically binds to Cloud Run GCE metadata credentials for Firestore REST v1 while maintaining thread-safe in-memory responsiveness.",
			"tags":        []string{"firestore", "firebase-auth", "modular"},
		},
	}
}
