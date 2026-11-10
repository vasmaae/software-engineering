package catalog

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/vasmaae/software-engineering/internal/password"
)

func TestDepartureValidation(t *testing.T) {
	for _, tc := range []struct {
		name  string
		times []string
		valid bool
	}{
		{"empty clears schedule", []string{}, true},
		{"boundary times", []string{"00:00", "23:59"}, true},
		{"null is not an array", nil, false},
		{"invalid clock", []string{"24:00"}, false},
		{"noncanonical", []string{"7:30"}, false},
		{"duplicate", []string{"07:30", "07:30"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if validDepartures(tc.times) != tc.valid {
				t.Fatalf("wrong validation result for %q", tc.times)
			}
		})
	}
}

func TestSessionSecurity(t *testing.T) {
	secret := "local-only-test-123"
	encoded, err := password.New(secret)
	if err != nil {
		t.Fatal(err)
	}
	hash, err := password.Parse(encoded)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(nil, AdminConfig{Password: &hash, Secure: true})
	req := func(method, path, body string, cookie *http.Cookie, cross bool) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, "https://sgt.test"+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		if cross {
			r.Header.Set("Origin", "https://outside.test")
			r.Header.Set("Sec-Fetch-Site", "cross-site")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if w := req("POST", "/api/session", "{}", nil, true); w.Code != 403 {
		t.Fatalf("cross-site sign-in: %d", w.Code)
	}
	if w := req("POST", "/api/session", "{}", nil, false); w.Code != 401 {
		t.Fatalf("wrong credentials: %d", w.Code)
	}
	if w := req("POST", "/api/session", "{}", nil, false); w.Code != 429 {
		t.Fatalf("login cooldown: %d", w.Code)
	}
	time.Sleep(510 * time.Millisecond)
	w := req("POST", "/api/session", `{"username":"admin","password":"`+secret+`"}`, nil, false)
	cookies := w.Result().Cookies()
	if w.Code != 204 || len(cookies) != 1 {
		t.Fatalf("sign-in: %d, cookies: %d", w.Code, len(cookies))
	}
	cookie := cookies[0]
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || len(cookie.Value) != 64 {
		t.Fatal("invalid secure cookie attributes")
	}
	if w := req("DELETE", "/api/admin/routes/1", "", cookie, true); w.Code != 403 {
		t.Fatalf("cross-site delete: %d", w.Code)
	}
	var session map[string]bool
	w = req("GET", "/api/session", "", cookie, false)
	if err := json.Unmarshal(w.Body.Bytes(), &session); err != nil || !session["authenticated"] {
		t.Fatal("valid session not recognized")
	}
	if w := req("DELETE", "/api/session", "", cookie, false); w.Code != 204 || w.Result().Cookies()[0].MaxAge != -1 {
		t.Fatal("logout failed")
	}
	for _, tc := range []struct{ method, path string }{
		{"POST", "/api/admin/stops"}, {"PUT", "/api/admin/stops/1"}, {"DELETE", "/api/admin/stops/1"},
		{"POST", "/api/admin/routes"}, {"PUT", "/api/admin/routes/1"}, {"DELETE", "/api/admin/routes/1"},
		{"PUT", "/api/admin/routes/1/schedule?direction=0&day=weekday"},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			if w := req(tc.method, tc.path, "{}", cookie, false); w.Code != 401 {
				t.Fatalf("logged-out session still allowed write: %d", w.Code)
			}
		})
	}
}
