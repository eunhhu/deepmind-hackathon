package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"deepmind/api/internal/argon"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	client := argon.NewClient(os.Getenv("GEMINI_API_KEY"))

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"engine":  "gemini-4-argon",
			"runtime": "go-gin",
		})
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

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("[argon-api] listening on %s (engine=gemini-4-argon, liveKey=%v)", addr, client.HasAPIKey())
	if err := r.Run(addr); err != nil {
		log.Fatalf("[argon-api] server failed: %v", err)
	}
}

func isDryRun(c *gin.Context) bool {
	q := strings.ToLower(strings.TrimSpace(c.Query("dryRun")))
	return q == "true" || q == "1"
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
