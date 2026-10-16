package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"deepmind/api/internal/argon"
	"deepmind/api/internal/auth"
	"deepmind/api/internal/modules"
	"deepmind/api/internal/modules/aegis"
	"deepmind/api/internal/modules/pipeline"
	"deepmind/api/internal/modules/workspace"
	"deepmind/api/internal/store"


	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)

	client := argon.NewClient(os.Getenv("GEMINI_API_KEY"))
	verifier := auth.NewVerifier("")
	storeInstance := store.NewDualStore(verifier.ProjectID())

	r := buildRouter(client, verifier, storeInstance)

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf(
		"[argon-api] listening on %s (engine=gemini-4-argon, liveKey=%v, project=%s, store=%s)",
		addr,
		client.HasAPIKey(),
		verifier.ProjectID(),
		storeInstance.Backend(),
	)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[argon-api] server failed: %v", err)
	}
}

func buildRouter(client *argon.Client, verifier *auth.Verifier, storeInstance store.Store) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"engine":    "gemini-4-argon",
			"runtime":   "go-gin",
			"store":     storeInstance.Backend(),
			"projectId": verifier.ProjectID(),
		})
	})

	r.GET("/api/auth/me", auth.AuthMiddleware(verifier), func(c *gin.Context) {
		user := auth.CurrentUser(c)
		c.JSON(http.StatusOK, auth.AuthVerifyResponse{
			Authenticated: true,
			User:          user,
			ProjectID:     verifier.ProjectID(),
			StoreBackend:  storeInstance.Backend(),
		})
	})

	// Generic Zero-Schema CRUD endpoints backed by DualStore (Firestore Native REST + In-Memory)
	dbGroup := r.Group("/api/db")
	dbGroup.Use(auth.AuthMiddleware(verifier))
	{
		dbGroup.GET("/:collection", func(c *gin.Context) {
			collection := strings.TrimSpace(c.Param("collection"))
			user := auth.CurrentUser(c)
			ownerFilter := user.UID
			if strings.EqualFold(c.Query("scope"), "all") {
				ownerFilter = ""
			}
			items, err := storeInstance.List(c.Request.Context(), collection, ownerFilter)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, store.ListEntitiesResponse{
				Collection: collection,
				Backend:    storeInstance.Backend(),
				Items:      items,
			})
		})

		dbGroup.POST("/:collection", func(c *gin.Context) {
			collection := strings.TrimSpace(c.Param("collection"))
			user := auth.CurrentUser(c)
			var raw map[string]interface{}
			if err := c.ShouldBindJSON(&raw); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			id, _ := raw["id"].(string)
			data := unwrapEntityPayload(raw)

			rec, err := storeInstance.Put(c.Request.Context(), collection, id, user.UID, data)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, rec)
		})

		dbGroup.GET("/:collection/:id", func(c *gin.Context) {
			collection := strings.TrimSpace(c.Param("collection"))
			id := strings.TrimSpace(c.Param("id"))
			rec, ok, err := storeInstance.Get(c.Request.Context(), collection, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if !ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "entity not found"})
				return
			}
			c.JSON(http.StatusOK, rec)
		})

		dbGroup.PATCH("/:collection/:id", func(c *gin.Context) {
			collection := strings.TrimSpace(c.Param("collection"))
			id := strings.TrimSpace(c.Param("id"))
			var raw map[string]interface{}
			if err := c.ShouldBindJSON(&raw); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			patch := unwrapEntityPayload(raw)
			rec, ok, err := storeInstance.Update(c.Request.Context(), collection, id, patch)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if !ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "entity not found"})
				return
			}
			c.JSON(http.StatusOK, rec)
		})

		dbGroup.DELETE("/:collection/:id", func(c *gin.Context) {
			collection := strings.TrimSpace(c.Param("collection"))
			id := strings.TrimSpace(c.Param("id"))
			deleted, err := storeInstance.Delete(c.Request.Context(), collection, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if !deleted {
				c.JSON(http.StatusNotFound, gin.H{"error": "entity not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"deleted": true, "id": id})
		})
	}

	// Plug-and-play backend feature modules registry
	reg := modules.NewRegistry()
	reg.Register(aegis.NewModule())
	reg.Register(workspace.New())
	reg.Register(pipeline.NewModule())
	reg.Mount(r, &modules.Dependencies{
		Argon:    client,
		Store:    storeInstance,
		Verifier: verifier,
	})


	r.POST("/api/swarm/run", func(c *gin.Context) {
		var req argon.ParallelSwarmRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		dryRun := isDryRun(c)
		resp := client.RunSwarm(c.Request.Context(), req, dryRun, nil)
		c.JSON(http.StatusOK, resp)
	})

	r.POST("/api/swarm/stream", func(c *gin.Context) {
		var req argon.ParallelSwarmRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("X-Accel-Buffering", "no")
		c.Writer.WriteHeader(http.StatusOK)
		c.Writer.Flush()

		dryRun := isDryRun(c)

		resp := client.RunSwarm(c.Request.Context(), req, dryRun, func(taskRes argon.ParallelTaskResult) {
			payload, err := json.Marshal(taskRes)
			if err != nil {
				return
			}
			_, _ = fmt.Fprintf(c.Writer, "event: task_result\ndata: %s\n\n", payload)
			c.Writer.Flush()
		})

		completePayload, err := json.Marshal(resp)
		if err == nil {
			_, _ = fmt.Fprintf(c.Writer, "event: swarm_complete\ndata: %s\n\n", completePayload)
			c.Writer.Flush()
		}
	})

	return r
}

func unwrapEntityPayload(raw map[string]interface{}) map[string]interface{} {
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

func isDryRun(c *gin.Context) bool {
	q := strings.ToLower(strings.TrimSpace(c.Query("dryRun")))
	return q == "true" || q == "1"
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Demo-User, X-Demo-Email, X-Requested-With")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
