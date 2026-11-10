package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Stop struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Location string `json:"location"`
}

type Direction struct {
	Direction int    `json:"direction"`
	Stops     []Stop `json:"stops"`
}

type RouteDetail struct {
	Route
	Directions []Direction `json:"directions"`
}

type StopRoute struct {
	ID        int    `json:"id"`
	Number    string `json:"number"`
	Transport string `json:"transport"`
	Direction int    `json:"direction"`
	Towards   string `json:"towards"`
}

type StopDetail struct {
	Stop
	Routes []StopRoute `json:"routes"`
}

func requestID(r *http.Request) (int, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	return int(id), err == nil && id > 0
}

func sendJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Print("could not write JSON response")
	}
}

func readError(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	http.Error(w, "Справочник временно недоступен", http.StatusServiceUnavailable)
}

func addNetwork(mux *http.ServeMux, db *pgxpool.Pool) {
	mux.HandleFunc("GET /api/routes/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, ok := requestID(r)
		if !ok {
			http.Error(w, "Некорректный идентификатор", http.StatusBadRequest)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		var route RouteDetail
		err := db.QueryRow(ctx, `
			SELECT r.id, r.number, r.transport, r.start_stop, r.end_stop,
				COALESCE((SELECT jsonb_agg(jsonb_build_object('direction', d.direction, 'stops',
					(SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'location', s.location)
						ORDER BY rs.position) FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
						WHERE (rs.route_id, rs.direction) = (d.route_id, d.direction)))
					ORDER BY d.direction) FROM directions d WHERE d.route_id = r.id), '[]'::jsonb)
			FROM routes r WHERE r.id = $1`, id).Scan(&route.ID, &route.Number, &route.Transport,
			&route.Start, &route.End, &route.Directions)
		if err != nil {
			readError(w, err)
			return
		}
		sendJSON(w, route)
	})
	mux.HandleFunc("GET /api/stops", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		rows, err := db.Query(ctx, `SELECT id, name, location FROM stops ORDER BY name, location`)
		if err != nil {
			readError(w, err)
			return
		}
		stops, err := pgx.CollectRows(rows, pgx.RowToStructByName[Stop])
		if err != nil {
			readError(w, err)
			return
		}
		sendJSON(w, stops)
	})
	mux.HandleFunc("GET /api/stops/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, ok := requestID(r)
		if !ok {
			http.Error(w, "Некорректный идентификатор", http.StatusBadRequest)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		var stop StopDetail
		err := db.QueryRow(ctx, `
			SELECT s.id, s.name, s.location,
				COALESCE((SELECT jsonb_agg(jsonb_build_object(
					'id', r.id, 'number', r.number, 'transport', r.transport,
					'direction', d.direction, 'towards', last_stop.name)
					ORDER BY r.number, r.transport, d.direction)
					FROM directions d JOIN routes r ON r.id = d.route_id
					JOIN LATERAL (SELECT x.name FROM route_stops last_rs JOIN stops x ON x.id = last_rs.stop_id
						WHERE (last_rs.route_id, last_rs.direction) = (d.route_id, d.direction)
						ORDER BY last_rs.position DESC LIMIT 1) last_stop ON true
					WHERE EXISTS (SELECT FROM route_stops rs WHERE rs.stop_id = s.id
						AND (rs.route_id, rs.direction) = (d.route_id, d.direction))), '[]'::jsonb)
			FROM stops s WHERE s.id = $1`, id).Scan(&stop.ID, &stop.Name, &stop.Location, &stop.Routes)
		if err != nil {
			readError(w, err)
			return
		}
		sendJSON(w, stop)
	})
}
