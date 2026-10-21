package catalog

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestInvalidRequests(t *testing.T) {
	handler := NewHandler(nil)
	for _, test := range []struct {
		name, method, path string
		status             int
	}{
		{"transport", "GET", "/api/routes?transport=plane", 400},
		{"long query", "GET", "/api/routes?q=" + strings.Repeat("x", 41), 400},
		{"write rejected", "POST", "/api/routes", 405},
		{"unknown endpoint", "GET", "/api/missing", 404},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d", response.Code, test.status)
			}
		})
	}
}

func TestPostgresIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		if os.Getenv("CI") != "" {
			t.Fatal("TEST_DATABASE_URL is required in CI")
		}
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatal("invalid test database configuration")
	}
	t.Cleanup(db.Close)
	handler := NewHandler(db)
	for _, test := range []struct {
		name, query string
		count       int
	}{
		{"catalog", "", 3},
		{"combined filters", "?q=1&transport=tram", 1},
		{"trim query", "?q=%201%20&transport=bus", 1},
		{"trolleybus", "?transport=trolleybus", 1},
		{"empty", "?q=999", 0},
		{"literal wildcard", "?q=%25", 0},
		{"SQL injection", "?q=%27%20OR%201=1--", 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest("GET", "/api/routes"+test.query, nil))
			if response.Code != http.StatusOK {
				t.Fatalf("status = %d: %s", response.Code, response.Body.String())
			}
			var routes []Route
			if err := json.Unmarshal(response.Body.Bytes(), &routes); err != nil {
				t.Fatal(err)
			}
			if routes == nil || len(routes) != test.count {
				t.Fatalf("routes = %v, want non-nil slice of length %d", routes, test.count)
			}
			if test.query == "?q=1&transport=tram" && routes[0].Transport != "tram" {
				t.Fatal("transport filter was ignored")
			}
		})
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("GET", "/api/health", nil))
	if response.Code != http.StatusNoContent {
		t.Fatalf("health = %d", response.Code)
	}
	db.Close()
	for _, path := range []string{"/api/routes", "/api/health"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		if response.Code != http.StatusServiceUnavailable {
			t.Fatalf("closed database status = %d", response.Code)
		}
		if strings.Contains(response.Body.String(), dsn) {
			t.Fatal("database credentials leaked into response")
		}
	}
}
