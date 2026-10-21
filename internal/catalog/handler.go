package catalog

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Route struct {
	ID        int    `json:"id"`
	Number    string `json:"number"`
	Transport string `json:"transport"`
	Start     string `json:"start"`
	End       string `json:"end"`
}

func NewHandler(db *pgxpool.Pool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			http.Error(w, "database is unavailable", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/routes", func(w http.ResponseWriter, r *http.Request) {
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		transport := r.URL.Query().Get("transport")
		if len(query) > 40 || (transport != "" && transport != "bus" && transport != "tram" && transport != "trolleybus") {
			http.Error(w, "invalid route filter", http.StatusBadRequest)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		rows, err := db.Query(ctx, `
			SELECT id, number, transport, start_stop, end_stop FROM routes
			WHERE strpos(lower(number), lower($1)) > 0
			AND ($2 = '' OR transport = $2)
			ORDER BY number, transport`, query, transport)
		if err != nil {
			http.Error(w, "routes are unavailable", http.StatusServiceUnavailable)
			return
		}
		defer rows.Close()
		routes := make([]Route, 0)
		for rows.Next() {
			var route Route
			if err := rows.Scan(&route.ID, &route.Number, &route.Transport, &route.Start, &route.End); err != nil {
				http.Error(w, "routes are unavailable", http.StatusInternalServerError)
				return
			}
			routes = append(routes, route)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "routes are unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if err := json.NewEncoder(w).Encode(routes); err != nil {
			log.Print("could not write routes response")
		}
	})
	return mux
}
