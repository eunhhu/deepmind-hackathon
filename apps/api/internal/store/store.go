package store

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	BackendFirestore = "firestore"
	BackendMemory    = "memory"

	DefaultFirestoreBaseURL = "https://firestore.googleapis.com/v1"
	GCEMetadataTokenURL     = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
)

// EntityRecord mirrors packages/shared/src/index.ts EntityRecord
type EntityRecord struct {
	ID         string                 `json:"id"`
	Collection string                 `json:"collection"`
	OwnerUID   string                 `json:"ownerUid"`
	Data       map[string]interface{} `json:"data"`
	CreatedAt  string                 `json:"createdAt"`
	UpdatedAt  string                 `json:"updatedAt"`
}

// CreateEntityRequest mirrors packages/shared/src/index.ts CreateEntityRequest
type CreateEntityRequest struct {
	ID   string                 `json:"id,omitempty"`
	Data map[string]interface{} `json:"data"`
}

// UpdateEntityRequest mirrors packages/shared/src/index.ts UpdateEntityRequest
type UpdateEntityRequest struct {
	Data map[string]interface{} `json:"data"`
}

// ListEntitiesResponse mirrors packages/shared/src/index.ts ListEntitiesResponse
type ListEntitiesResponse struct {
	Collection string         `json:"collection"`
	Backend    string         `json:"backend"`
	Items      []EntityRecord `json:"items"`
}

// Store defines the unified persistence contract for Cloud Firestore Native REST and in-memory stores.
type Store interface {
	Backend() string
	Put(ctx context.Context, collection, id, ownerUID string, data map[string]interface{}) (EntityRecord, error)
	Get(ctx context.Context, collection, id string) (EntityRecord, bool, error)
	Update(ctx context.Context, collection, id string, patch map[string]interface{}) (EntityRecord, bool, error)
	Delete(ctx context.Context, collection, id string) (bool, error)
	List(ctx context.Context, collection, ownerUID string) ([]EntityRecord, error)
}

func generateID(prefix string) string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	if prefix == "" {
		prefix = "doc"
	}
	return fmt.Sprintf("%s_%d_%s", prefix, time.Now().UnixMilli(), hex.EncodeToString(b[:]))
}

func cloneMap(src map[string]interface{}) map[string]interface{} {
	if src == nil {
		return map[string]interface{}{}
	}
	raw, err := json.Marshal(src)
	if err != nil {
		dst := make(map[string]interface{}, len(src))
		for k, v := range src {
			dst[k] = v
		}
		return dst
	}
	var dst map[string]interface{}
	if err := json.Unmarshal(raw, &dst); err != nil || dst == nil {
		return map[string]interface{}{}
	}
	return dst
}

func cloneRecord(r EntityRecord) EntityRecord {
	r.Data = cloneMap(r.Data)
	return r
}

// MemoryStore is a thread-safe in-memory implementation of Store.
type MemoryStore struct {
	mu          sync.RWMutex
	collections map[string]map[string]EntityRecord
}

// NewMemoryStore creates an initialized thread-safe MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		collections: make(map[string]map[string]EntityRecord),
	}
}

func (m *MemoryStore) Backend() string {
	return BackendMemory
}

func (m *MemoryStore) Put(_ context.Context, collection, id, ownerUID string, data map[string]interface{}) (EntityRecord, error) {
	collection = strings.TrimSpace(collection)
	if collection == "" {
		return EntityRecord{}, fmt.Errorf("collection name is required")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		id = generateID(collection)
	}
	if strings.TrimSpace(ownerUID) == "" {
		ownerUID = "demo-hacker"
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)

	m.mu.Lock()
	defer m.mu.Unlock()

	col, exists := m.collections[collection]
	if !exists {
		col = make(map[string]EntityRecord)
		m.collections[collection] = col
	}

	createdAt := now
	if prev, ok := col[id]; ok && prev.CreatedAt != "" {
		createdAt = prev.CreatedAt
	}

	rec := EntityRecord{
		ID:         id,
		Collection: collection,
		OwnerUID:   ownerUID,
		Data:       cloneMap(data),
		CreatedAt:  createdAt,
		UpdatedAt:  now,
	}
	col[id] = rec
	return cloneRecord(rec), nil
}

func (m *MemoryStore) Get(_ context.Context, collection, id string) (EntityRecord, bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	col, exists := m.collections[collection]
	if !exists {
		return EntityRecord{}, false, nil
	}
	rec, ok := col[id]
	if !ok {
		return EntityRecord{}, false, nil
	}
	return cloneRecord(rec), true, nil
}

func (m *MemoryStore) Update(_ context.Context, collection, id string, patch map[string]interface{}) (EntityRecord, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	col, exists := m.collections[collection]
	if !exists {
		return EntityRecord{}, false, nil
	}
	rec, ok := col[id]
	if !ok {
		return EntityRecord{}, false, nil
	}

	merged := cloneMap(rec.Data)
	for k, v := range patch {
		merged[k] = v
	}
	rec.Data = merged
	rec.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	col[id] = rec
	return cloneRecord(rec), true, nil
}

func (m *MemoryStore) Delete(_ context.Context, collection, id string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	col, exists := m.collections[collection]
	if !exists {
		return false, nil
	}
	if _, ok := col[id]; !ok {
		return false, nil
	}
	delete(col, id)
	return true, nil
}

func (m *MemoryStore) List(_ context.Context, collection, ownerUID string) ([]EntityRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	col, exists := m.collections[collection]
	if !exists {
		return []EntityRecord{}, nil
	}

	items := make([]EntityRecord, 0, len(col))
	for _, rec := range col {
		if ownerUID == "" || ownerUID == "*" || rec.OwnerUID == ownerUID {
			items = append(items, cloneRecord(rec))
		}
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt == items[j].CreatedAt {
			return items[i].ID < items[j].ID
		}
		return items[i].CreatedAt < items[j].CreatedAt
	})

	return items, nil
}

// firestoreDocument models the Cloud Firestore REST v1 document envelope.
type firestoreDocument struct {
	Name   string                         `json:"name,omitempty"`
	Fields map[string]firestoreFieldValue `json:"fields"`
}

type firestoreFieldValue struct {
	StringValue string `json:"stringValue,omitempty"`
}

type firestoreListResponse struct {
	Documents []firestoreDocument `json:"documents"`
}

type metadataTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

// DualStore combines Cloud Firestore Native REST API with a write-through thread-safe MemoryStore.
// When running on Cloud Run (GCE metadata server available) or FIRESTORE_ACCESS_TOKEN is set,
// it persists documents to Firestore while keeping MemoryStore hot as a low-latency cache & fallback.
type DualStore struct {
	projectID        string
	firestoreBaseURL string
	metadataURL      string
	httpClient       *http.Client
	memory           *MemoryStore

	tokenMu     sync.Mutex
	accessToken string
	tokenExpiry time.Time
	useRemote   bool
}

// NewDualStore initializes a DualStore for projectID (default "h2gdm-hack26icn-2693")
// and automatically probes whether Firestore credentials are available.
func NewDualStore(projectID string) *DualStore {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		projectID = strings.TrimSpace(os.Getenv("GCP_PROJECT_ID"))
	}
	if projectID == "" {
		projectID = strings.TrimSpace(os.Getenv("FIREBASE_PROJECT_ID"))
	}
	if projectID == "" {
		projectID = "h2gdm-hack26icn-2693"
	}

	ds := &DualStore{
		projectID:        projectID,
		firestoreBaseURL: DefaultFirestoreBaseURL,
		metadataURL:      GCEMetadataTokenURL,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		memory: NewMemoryStore(),
	}

	if envTok := strings.TrimSpace(os.Getenv("FIRESTORE_ACCESS_TOKEN")); envTok != "" {
		ds.accessToken = envTok
		ds.tokenExpiry = time.Now().Add(1 * time.Hour)
		ds.useRemote = true
	} else if os.Getenv("K_SERVICE") != "" {
		// Running on Cloud Run: probe GCE metadata server with short timeout
		ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
		defer cancel()
		if _, err := ds.getAccessToken(ctx); err == nil {
			ds.useRemote = true
		}
	}

	return ds
}

// ConfigureRemoteForTest overrides the Firestore REST base URL and access token (for unit testing).
func (d *DualStore) ConfigureRemoteForTest(firestoreBaseURL, accessToken string) {
	d.tokenMu.Lock()
	defer d.tokenMu.Unlock()
	d.firestoreBaseURL = strings.TrimRight(firestoreBaseURL, "/")
	d.accessToken = accessToken
	d.tokenExpiry = time.Now().Add(1 * time.Hour)
	d.useRemote = true
}

func (d *DualStore) Backend() string {
	d.tokenMu.Lock()
	defer d.tokenMu.Unlock()
	if d.useRemote {
		return BackendFirestore
	}
	return BackendMemory
}

func (d *DualStore) getAccessToken(ctx context.Context) (string, error) {
	d.tokenMu.Lock()
	defer d.tokenMu.Unlock()

	if d.accessToken != "" && time.Now().Before(d.tokenExpiry) {
		return d.accessToken, nil
	}

	if envTok := strings.TrimSpace(os.Getenv("FIRESTORE_ACCESS_TOKEN")); envTok != "" {
		d.accessToken = envTok
		d.tokenExpiry = time.Now().Add(1 * time.Hour)
		return d.accessToken, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.metadataURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Metadata-Flavor", "Google")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("metadata server HTTP %d", resp.StatusCode)
	}

	var tokResp metadataTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokResp); err != nil {
		return "", err
	}
	if tokResp.AccessToken == "" {
		return "", fmt.Errorf("empty access_token from metadata server")
	}

	ttl := time.Duration(tokResp.ExpiresIn-60) * time.Second
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	d.accessToken = tokResp.AccessToken
	d.tokenExpiry = time.Now().Add(ttl)
	return d.accessToken, nil
}

func (d *DualStore) docURL(collection, id string) string {
	return fmt.Sprintf(
		"%s/projects/%s/databases/(default)/documents/%s/%s",
		d.firestoreBaseURL,
		url.PathEscape(d.projectID),
		url.PathEscape(collection),
		url.PathEscape(id),
	)
}

func (d *DualStore) collectionURL(collection string) string {
	return fmt.Sprintf(
		"%s/projects/%s/databases/(default)/documents/%s",
		d.firestoreBaseURL,
		url.PathEscape(d.projectID),
		url.PathEscape(collection),
	)
}

func encodeFirestoreDoc(rec EntityRecord) (firestoreDocument, error) {
	raw, err := json.Marshal(rec)
	if err != nil {
		return firestoreDocument{}, err
	}
	return firestoreDocument{
		Fields: map[string]firestoreFieldValue{
			"payload":   {StringValue: string(raw)},
			"ownerUid":  {StringValue: rec.OwnerUID},
			"updatedAt": {StringValue: rec.UpdatedAt},
		},
	}, nil
}

func decodeFirestoreDoc(doc firestoreDocument) (EntityRecord, bool) {
	payloadField, ok := doc.Fields["payload"]
	if !ok || payloadField.StringValue == "" {
		return EntityRecord{}, false
	}
	var rec EntityRecord
	if err := json.Unmarshal([]byte(payloadField.StringValue), &rec); err != nil {
		return EntityRecord{}, false
	}
	if rec.Data == nil {
		rec.Data = map[string]interface{}{}
	}
	return rec, true
}

func (d *DualStore) writeRemote(ctx context.Context, rec EntityRecord) error {
	tok, err := d.getAccessToken(ctx)
	if err != nil {
		return err
	}
	doc, err := encodeFirestoreDoc(rec)
	if err != nil {
		return err
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, d.docURL(rec.Collection, rec.ID), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tok)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("firestore PATCH HTTP %d", resp.StatusCode)
	}
	return nil
}

func (d *DualStore) Put(ctx context.Context, collection, id, ownerUID string, data map[string]interface{}) (EntityRecord, error) {
	rec, err := d.memory.Put(ctx, collection, id, ownerUID, data)
	if err != nil {
		return EntityRecord{}, err
	}
	if d.Backend() == BackendFirestore {
		_ = d.writeRemote(ctx, rec)
	}
	return rec, nil
}

func (d *DualStore) Get(ctx context.Context, collection, id string) (EntityRecord, bool, error) {
	if rec, ok, err := d.memory.Get(ctx, collection, id); err == nil && ok {
		return rec, true, nil
	}
	if d.Backend() != BackendFirestore {
		return EntityRecord{}, false, nil
	}

	tok, err := d.getAccessToken(ctx)
	if err != nil {
		return EntityRecord{}, false, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.docURL(collection, id), nil)
	if err != nil {
		return EntityRecord{}, false, nil
	}
	req.Header.Set("Authorization", "Bearer "+tok)

	resp, err := d.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return EntityRecord{}, false, nil
	}
	defer resp.Body.Close()

	var doc firestoreDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return EntityRecord{}, false, nil
	}
	rec, ok := decodeFirestoreDoc(doc)
	if !ok {
		return EntityRecord{}, false, nil
	}
	_, _ = d.memory.Put(ctx, rec.Collection, rec.ID, rec.OwnerUID, rec.Data)
	return rec, true, nil
}

func (d *DualStore) Update(ctx context.Context, collection, id string, patch map[string]interface{}) (EntityRecord, bool, error) {
	if _, ok, _ := d.memory.Get(ctx, collection, id); !ok && d.Backend() == BackendFirestore {
		_, _, _ = d.Get(ctx, collection, id)
	}

	rec, ok, err := d.memory.Update(ctx, collection, id, patch)
	if err != nil || !ok {
		return EntityRecord{}, ok, err
	}
	if d.Backend() == BackendFirestore {
		_ = d.writeRemote(ctx, rec)
	}
	return rec, true, nil
}

func (d *DualStore) Delete(ctx context.Context, collection, id string) (bool, error) {
	existed, err := d.memory.Delete(ctx, collection, id)
	if err != nil {
		return false, err
	}
	if d.Backend() == BackendFirestore {
		if tok, tokErr := d.getAccessToken(ctx); tokErr == nil {
			req, reqErr := http.NewRequestWithContext(ctx, http.MethodDelete, d.docURL(collection, id), nil)
			if reqErr == nil {
				req.Header.Set("Authorization", "Bearer "+tok)
				if resp, doErr := d.httpClient.Do(req); doErr == nil {
					resp.Body.Close()
					if resp.StatusCode >= 200 && resp.StatusCode < 300 {
						existed = true
					}
				}
			}
		}
	}
	return existed, nil
}

func (d *DualStore) List(ctx context.Context, collection, ownerUID string) ([]EntityRecord, error) {
	if d.Backend() == BackendFirestore {
		if tok, err := d.getAccessToken(ctx); err == nil {
			req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, d.collectionURL(collection), nil)
			if reqErr == nil {
				req.Header.Set("Authorization", "Bearer "+tok)
				if resp, doErr := d.httpClient.Do(req); doErr == nil {
					var listResp firestoreListResponse
					decodeErr := json.NewDecoder(resp.Body).Decode(&listResp)
					resp.Body.Close()
					if resp.StatusCode == http.StatusOK && decodeErr == nil {
						for _, doc := range listResp.Documents {
							if rec, ok := decodeFirestoreDoc(doc); ok {
								_, _ = d.memory.Put(ctx, rec.Collection, rec.ID, rec.OwnerUID, rec.Data)
							}
						}
					}
				}
			}
		}
	}
	return d.memory.List(ctx, collection, ownerUID)
}
