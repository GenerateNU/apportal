package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port            string
	DatabaseURL     string
	CORSOrigins     []string
	SupabaseURL     string
	SupabaseAnonKey string
}

func Load() (Config, error) {
	cfg := Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		CORSOrigins:     getEnvList("APP_CORS_ORIGINS", "http://localhost:3000"),
		SupabaseURL:     os.Getenv("SUPABASE_URL"),
		SupabaseAnonKey: os.Getenv("SUPABASE_ANON_KEY"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.SupabaseURL == "" {
		return Config{}, fmt.Errorf("SUPABASE_URL is required")
	}
	if cfg.SupabaseAnonKey == "" {
		return Config{}, fmt.Errorf("SUPABASE_ANON_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

// getEnvList reads a comma-separated env var into a trimmed slice.
func getEnvList(key, fallback string) []string {
	raw := getEnv(key, fallback)
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
