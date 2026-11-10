package catalog

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"sync"
	"time"

	"github.com/vasmaae/software-engineering/internal/password"
)

const sessionCookie = "sgt_session"
const sessionDuration = 2 * time.Hour

type AdminConfig struct {
	Password *password.Hash
	Secure   bool
}

type adminSession struct {
	AdminConfig
	mu      sync.Mutex
	token   string
	expires time.Time
	attempt time.Time
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	contentType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if contentType != "application/json" {
		http.Error(w, "Требуется application/json", http.StatusUnsupportedMediaType)
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10))
	d.DisallowUnknownFields()
	if d.Decode(dst) != nil || !errors.Is(d.Decode(new(any)), io.EOF) {
		http.Error(w, "Некорректные данные", http.StatusBadRequest)
		return false
	}
	return true
}

func (s *adminSession) matchesLocked(r *http.Request) bool {
	cookie, err := r.Cookie(sessionCookie)
	return err == nil && time.Now().Before(s.expires) &&
		subtle.ConstantTimeCompare([]byte(s.token), []byte(cookie.Value)) == 1
}

func (s *adminSession) signedIn(r *http.Request) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.matchesLocked(r)
}

func (s *adminSession) require(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if !s.signedIn(r) {
			http.Error(w, "Войдите как администратор", http.StatusUnauthorized)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		next(w, r.WithContext(ctx))
	}
}

func (s *adminSession) cookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: token, Path: "/api", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: s.Secure, MaxAge: maxAge,
	})
}

func (s *adminSession) register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/session", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		sendJSON(w, map[string]bool{"authenticated": s.signedIn(r)})
	})
	mux.HandleFunc("POST /api/session", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if s.Password == nil {
			http.Error(w, "Вход не настроен", http.StatusServiceUnavailable)
			return
		}
		var input struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if !readJSON(w, r, &input) {
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		now := time.Now()
		if now.Sub(s.attempt) < 500*time.Millisecond {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "Слишком много попыток. Повторите через секунду", http.StatusTooManyRequests)
			return
		}
		s.attempt = now
		if !s.Password.Matches(input.Password) || input.Username != "admin" {
			http.Error(w, "Неверный логин или пароль", http.StatusUnauthorized)
			return
		}
		token := make([]byte, 32)
		if _, err := rand.Read(token); err != nil {
			http.Error(w, "Не удалось открыть сеанс", http.StatusInternalServerError)
			return
		}
		// shortcut: one session for the one local administrator; use a shared store for multiple users or replicas.
		s.token, s.expires = hex.EncodeToString(token), now.Add(sessionDuration)
		s.cookie(w, s.token, int(sessionDuration.Seconds()))
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("DELETE /api/session", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.matchesLocked(r) {
			s.token, s.expires = "", time.Time{}
		}
		s.cookie(w, "", -1)
		w.WriteHeader(http.StatusNoContent)
	})
}
