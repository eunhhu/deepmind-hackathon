package store

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestMemoryStoreCRUDAndConcurrency(t *testing.T) {
	ctx := context.Background()
	ms := NewMemoryStore()
	if ms.Backend() != BackendMemory {
		t.Fatalf("expected backend %q, got %q", BackendMemory, ms.Backend())
	}

	const workers = 16
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			id := fmt.Sprintf("item-%d", idx)
			rec, err := ms.Put(ctx, "workspace_items", id, "user-1", map[string]interface{}{
				"title": fmt.Sprintf("Task %d", idx),
				"index": idx,
			})
			if err != nil {
				t.Errorf("Put %s failed: %v", id, err)
				return
			}
			// Mutate returned map to ensure deep clone prevents data races
			rec.Data["mutated"] = true

			got, ok, err := ms.Get(ctx, "workspace_items", id)
			if err != nil || !ok {
				t.Errorf("Get %s failed: ok=%v err=%v", id, ok, err)
				return
			}
			if _, exists := got.Data["mutated"]; exists {
				t.Errorf("expected deep-copied Data map on Put/Get")
			}

			updated, ok, err := ms.Update(ctx, "workspace_items", id, map[string]interface{}{
				"status": "done",
			})
			if err != nil || !ok || updated.Data["status"] != "done" {
				t.Errorf("Update %s failed: ok=%v err=%v data=%v", id, ok, err, updated.Data)
			}
		}(i)
	}
	wg.Wait()

	list, err := ms.List(ctx, "workspace_items", "user-1")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(list) != workers {
		t.Fatalf("expected %d items, got %d", workers, len(list))
	}

	deleted, err := ms.Delete(ctx, "workspace_items", "item-0")
	if err != nil || !deleted {
		t.Fatalf("expected Delete item-0 to succeed, deleted=%v err=%v", deleted, err)
	}
	if _, ok, _ := ms.Get(ctx, "workspace_items", "item-0"); ok {
		t.Fatalf("expected item-0 to be absent after Delete")
	}
}

func TestDualStoreFirestoreRESTRoundTrip(t *testing.T) {
	ctx := context.Background()
	var remoteMu sync.Mutex
	remoteDocs := make(map[string]firestoreDocument)

	firestoreServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-firestore-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		remoteMu.Lock()
		defer remoteMu.Unlock()

		path := r.URL.Path
		switch r.Method {
		case http.MethodPatch:
			var doc firestoreDocument
			if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			doc.Name = path
			remoteDocs[path] = doc
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(doc)
		case http.MethodGet:
			if strings.Count(path, "/") == 6 {
				// Collection list: /projects/{p}/databases/(default)/documents/{col}
				docs := make([]firestoreDocument, 0, len(remoteDocs))
				for k, v := range remoteDocs {
					if strings.HasPrefix(k, path+"/") {
						docs = append(docs, v)
					}
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(firestoreListResponse{Documents: docs})
				return
			}
			doc, ok := remoteDocs[path]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(doc)
		case http.MethodDelete:
			delete(remoteDocs, path)
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	defer firestoreServer.Close()

	ds := NewDualStore("h2gdm-hack26icn-2693")
	ds.ConfigureRemoteForTest(firestoreServer.URL, "test-firestore-token")

	if ds.Backend() != BackendFirestore {
		t.Fatalf("expected backend %q, got %q", BackendFirestore, ds.Backend())
	}

	rec, err := ds.Put(ctx, "experiments", "exp-1", "founder-1", map[string]interface{}{
		"title": "Argon 1M Context Benchmark",
		"tags":  []string{"argon", "firestore"},
	})
	if err != nil {
		t.Fatalf("DualStore.Put failed: %v", err)
	}
	if rec.ID != "exp-1" {
		t.Fatalf("expected ID exp-1, got %q", rec.ID)
	}

	// Clear memory cache to verify remote Firestore GET hydration
	_, _ = ds.memory.Delete(ctx, "experiments", "exp-1")
	hydrated, ok, err := ds.Get(ctx, "experiments", "exp-1")
	if err != nil || !ok {
		t.Fatalf("expected remote Firestore hydration to succeed, ok=%v err=%v", ok, err)
	}
	if hydrated.Data["title"] != "Argon 1M Context Benchmark" {
		t.Fatalf("unexpected hydrated data: %+v", hydrated.Data)
	}

	if ok, err := ds.Delete(ctx, "experiments", "exp-1"); err != nil || !ok {
		t.Fatalf("expected DualStore.Delete to succeed, ok=%v err=%v", ok, err)
	}
}
