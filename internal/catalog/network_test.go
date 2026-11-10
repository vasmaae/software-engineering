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
	"github.com/vasmaae/software-engineering/internal/password"
)

func TestNetworkTransactions(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		if os.Getenv("CI") != "" {
			t.Fatal("TEST_DATABASE_URL is required in CI")
		}
		t.Skip("set TEST_DATABASE_URL for PostgreSQL transactions")
	}
	db, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatal("invalid test database configuration")
	}
	defer db.Close()
	secret := "local-only-db-test"
	encoded, err := password.New(secret)
	if err != nil {
		t.Fatal(err)
	}
	hash, err := password.Parse(encoded)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(db, AdminConfig{Password: &hash})
	var cookie *http.Cookie
	req := func(method, path, body string, want int) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			request.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, request)
		if w.Code != want {
			t.Fatalf("%s %s: %d, want %d: %s", method, path, w.Code, want, w.Body)
		}
		return w
	}
	req("GET", "/api/stops/no-id", "", 400)
	req("GET", "/api/routes/2147483647", "", 404)
	req("GET", "/api/routes/1/schedule?direction=0&day=holiday", "", 400)
	w := req("GET", "/api/routes/1", "", 200)
	var route RouteDetail
	if err := json.Unmarshal(w.Body.Bytes(), &route); err != nil || len(route.Directions) != 2 ||
		len(route.Directions[0].Stops) != 3 || len(route.Directions[1].Stops) != 3 ||
		route.Directions[0].Stops[1].ID == route.Directions[1].Stops[1].ID {
		t.Fatalf("direction model is incomplete: %v, %v", route, err)
	}
	w = req("POST", "/api/session", `{"username":"admin","password":"`+secret+`"}`, 204)
	cookie = w.Result().Cookies()[0]
	t.Run("rollback preserves route when a stop does not exist", func(t *testing.T) {
		req("PUT", "/api/admin/routes/1", `{"number":"bad","transport":"tram","directions":[[1,2],[2,2147483647]]}`, 409)
		w := req("GET", "/api/routes/1", "", 200)
		var after RouteDetail
		if err := json.Unmarshal(w.Body.Bytes(), &after); err != nil || after.Number != route.Number ||
			after.Transport != route.Transport || len(after.Directions) != 2 || len(after.Directions[0].Stops) != 3 {
			t.Fatalf("failed change was committed: %+v, %v", after, err)
		}
	})
	t.Run("missing route or stop cannot be changed", func(t *testing.T) {
		req("DELETE", "/api/admin/stops/2147483647", "", 404)
		req("DELETE", "/api/admin/routes/2147483647", "", 404)
		req("PUT", "/api/admin/routes/2147483647/schedule?direction=1&day=weekend", "[]", 404)
	})
	t.Run("duplicate stop is rejected", func(t *testing.T) {
		req("POST", "/api/admin/stops", `{"name":"Площадь Мира","location":"Южная сторона"}`, 409)
	})
}
