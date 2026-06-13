package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/config"
	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/handlers"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	database, err := appdb.Open(context.Background(), cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := database.Close(); err != nil {
			slog.Error("error closing database", "error", err)
		}
	}()

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handlers.NewRouter(database),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("backend listening", "addr", "http://localhost:"+cfg.Port)
		serverErrors <- server.ListenAndServe()
	}()

	shutdownSignals := make(chan os.Signal, 1)
	signal.Notify(shutdownSignals, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		if err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	case sig := <-shutdownSignals:
		slog.Info("shutting down", "signal", sig.String())
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
}
