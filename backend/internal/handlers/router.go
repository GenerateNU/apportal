package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type Router struct {
	database *sql.DB
}

func NewRouter(database *sql.DB) http.Handler {
	router := &Router{database: database}
	mux := http.NewServeMux()
	mux.HandleFunc("/", router.root)
	mux.HandleFunc("/healthz", router.health)
	mux.HandleFunc("/readyz", router.ready)
	return mux
}

func (router *Router) root(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]string{
		"message": "apportal backend is running",
	})
}

func (router *Router) health(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func (router *Router) ready(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), 10*time.Second)
	defer cancel()

	status := http.StatusOK
	response := map[string]string{
		"status":   "ok",
		"database": "up",
	}

	if err := router.database.PingContext(ctx); err != nil {
		status = http.StatusServiceUnavailable
		response["status"] = "unhealthy"
		response["database"] = "down"
		response["error"] = err.Error()
	}

	writeJSON(writer, status, response)
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}
