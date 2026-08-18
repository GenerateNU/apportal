package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port                   string
	DatabaseURL            string
	CORSOrigins            []string
	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string
	// ChallengeServerURL/ChallengeAdminToken call the separate
	// f26-technical-challenge server's own GET /admin/lookup?email= endpoint
	// for an applicant's scheduler-challenge score. Optional — the feature
	// just no-ops if the token is unset, rather than failing startup.
	ChallengeServerURL  string
	ChallengeAdminToken string
}

func Load() (Config, error) {
	cfg := Config{
		Port:                   getEnv("PORT", "8080"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		CORSOrigins:            getEnvList("APP_CORS_ORIGINS", "http://localhost:3001"),
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseAnonKey:        os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		ChallengeServerURL:     getEnv("CHALLENGE_SERVER_URL", "https://fall26-challenge.generatenu.com"),
		ChallengeAdminToken:    os.Getenv("CHALLENGE_ADMIN_TOKEN"),
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
	if cfg.SupabaseServiceRoleKey == "" {
		return Config{}, fmt.Errorf("SUPABASE_SERVICE_ROLE_KEY is required")
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
