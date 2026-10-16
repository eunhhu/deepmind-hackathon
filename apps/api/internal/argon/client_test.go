package argon

import (
	"context"
	"encoding/json"
	"strings"
	"sync/atomic"
	"testing"
)

func TestGemini4ArgonPayloadHygiene(t *testing.T) {
	payload := interactionCreatePayload{
		Model: ModelGemini4Argon,
		Input: "Design zero-overhead goroutine scheduler",
		GenerationConfig: &generationConfig{
			ThinkingLevel:   ThinkingHigh,
			MaxOutputTokens: DefaultMaxOutputTokens,
		},
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}
	jsonStr := string(raw)

	for _, forbidden := range []string{"temperature", "top_p", "top_k", "cached_content", "cachedContents"} {
		if strings.Contains(jsonStr, forbidden) {
			t.Fatalf("forbidden parameter %q found in payload: %s", forbidden, jsonStr)
		}
	}
	if !strings.Contains(jsonStr, `"thinking_level":"high"`) {
		t.Fatalf("expected thinking_level:high in payload: %s", jsonStr)
	}
	if !strings.Contains(jsonStr, `"max_output_tokens":65536`) {
		t.Fatalf("expected max_output_tokens:65536 in payload: %s", jsonStr)
	}
}

func TestRunSwarmParallelGoroutines(t *testing.T) {
	client := NewClient("")
	req := ParallelSwarmRequest{
		SharedContext:        "Monorepo shared context with >= 4096 tokens implicit cache support",
		DefaultThinkingLevel: ThinkingHigh,
		MaxConcurrency:       4,
		Tasks: []ParallelTaskInput{
			{ID: "t1", Label: "Architecture", Prompt: "Analyze architecture", ThinkingLevel: ThinkingHigh},
			{ID: "t2", Label: "LongDecode", Prompt: "Generate full spec", MaxOutputTokens: 131072},
			{ID: "t3", Label: "ManagedAgent", Prompt: "Verify sandbox build", UseManagedAgent: true},
		},
	}

	var streamedCount int32
	resp := client.RunSwarm(context.Background(), req, true, func(res ParallelTaskResult) {
		atomic.AddInt32(&streamedCount, 1)
	})

	if int(streamedCount) != len(req.Tasks) {
		t.Fatalf("expected %d streamed callbacks, got %d", len(req.Tasks), streamedCount)
	}
	if len(resp.Results) != len(req.Tasks) {
		t.Fatalf("expected %d results, got %d", len(req.Tasks), len(resp.Results))
	}
	if resp.RootInteractionID == "" {
		t.Fatalf("expected non-empty RootInteractionID when SharedContext is provided")
	}
	for i, r := range resp.Results {
		if r.Status != StatusCompleted {
			t.Fatalf("task %d expected status completed, got %s", i, r.Status)
		}
		if r.OutputText == "" {
			t.Fatalf("task %d expected non-empty OutputText", i)
		}
		if len(r.Steps) == 0 {
			t.Fatalf("task %d expected non-empty Steps", i)
		}
	}
}
