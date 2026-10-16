package modules

import (
	"net/http"
	"sync"

	"deepmind/api/internal/argon"
	"deepmind/api/internal/auth"
	"deepmind/api/internal/store"

	"github.com/gin-gonic/gin"
)

// FeatureModuleMeta mirrors packages/shared/src/index.ts FeatureModuleMeta
type FeatureModuleMeta struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Subtitle     string   `json:"subtitle"`
	Badge        string   `json:"badge"`
	APIPrefix    string   `json:"apiPrefix"`
	Collections  []string `json:"collections"`
	AgentUnitIDs []string `json:"agentUnitIds"`
}

// Dependencies bundles shared infrastructure services injected into each plug-and-play backend module.
type Dependencies struct {
	Argon    *argon.Client
	Store    store.Store
	Verifier *auth.Verifier
}

// Module is the plug-and-play interface that any parallel hackathon feature unit can implement.
type Module interface {
	Meta() FeatureModuleMeta
	RegisterRoutes(rg *gin.RouterGroup, deps *Dependencies)
}

// Registry manages registered backend feature modules and mounts their routes on a Gin engine.
type Registry struct {
	mu      sync.RWMutex
	modules []Module
}

// NewRegistry creates an empty feature module registry.
func NewRegistry() *Registry {
	return &Registry{
		modules: make([]Module, 0),
	}
}

// Register adds one or more feature modules to the registry.
func (r *Registry) Register(mods ...Module) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.modules = append(r.modules, mods...)
}

// ListMeta returns metadata for all registered feature modules.
func (r *Registry) ListMeta() []FeatureModuleMeta {
	r.mu.RLock()
	defer r.mu.RUnlock()

	metas := make([]FeatureModuleMeta, 0, len(r.modules))
	for _, m := range r.modules {
		meta := m.Meta()
		if meta.Collections == nil {
			meta.Collections = []string{}
		}
		if meta.AgentUnitIDs == nil {
			meta.AgentUnitIDs = []string{}
		}
		metas = append(metas, meta)
	}
	return metas
}

// Mount registers `GET /api/modules` and mounts each registered module at `/api/modules/<id>`.
func (r *Registry) Mount(engine *gin.Engine, deps *Dependencies) {
	engine.GET("/api/modules", func(c *gin.Context) {
		c.JSON(http.StatusOK, r.ListMeta())
	})

	r.mu.RLock()
	mods := make([]Module, len(r.modules))
	copy(mods, r.modules)
	r.mu.RUnlock()

	baseGroup := engine.Group("/api/modules")
	if deps != nil && deps.Verifier != nil {
		baseGroup.Use(auth.AuthMiddleware(deps.Verifier))
	} else {
		baseGroup.Use(auth.AuthMiddleware(nil))
	}

	for _, mod := range mods {
		meta := mod.Meta()
		subGroup := baseGroup.Group("/" + meta.ID)
		mod.RegisterRoutes(subGroup, deps)
	}
}
