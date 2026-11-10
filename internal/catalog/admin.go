package catalog

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func validText(value string, limit int) bool {
	return value != "" && utf8.RuneCountInString(value) <= limit && !strings.ContainsRune(value, 0)
}

func validTransport(value string) bool {
	return value == "bus" || value == "tram" || value == "trolleybus"
}

func mutationError(w http.ResponseWriter, err error) {
	var constraint *pgconn.PgError
	if errors.Is(err, pgx.ErrNoRows) {
		readError(w, err)
	} else if errors.As(err, &constraint) && constraint.Code == "23505" {
		http.Error(w, "Такая запись уже есть", http.StatusConflict)
	} else if errors.As(err, &constraint) && (constraint.Code == "23503" || constraint.Code == "23001") {
		http.Error(w, "Запись используется в маршруте или связанный объект не найден", http.StatusConflict)
	} else {
		http.Error(w, "Не удалось сохранить изменения", http.StatusServiceUnavailable)
	}
}

func affected(tag pgconn.CommandTag, err error) error {
	if err == nil && tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return err
}

func addAdmin(mux *http.ServeMux, db *pgxpool.Pool, s *adminSession) {
	stopSave := s.require(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Name     string `json:"name"`
			Location string `json:"location"`
		}
		if !readJSON(w, r, &input) {
			return
		}
		input.Name, input.Location = strings.TrimSpace(input.Name), strings.TrimSpace(input.Location)
		if !validText(input.Name, 100) || !validText(input.Location, 120) {
			http.Error(w, "Укажите название и расположение остановки", http.StatusBadRequest)
			return
		}
		var stop Stop
		var err error
		status := http.StatusCreated
		if r.Method == "POST" {
			err = db.QueryRow(r.Context(), `INSERT INTO stops(name, location) VALUES ($1, $2)
				RETURNING id, name, location`, input.Name, input.Location).Scan(&stop.ID, &stop.Name, &stop.Location)
		} else {
			id, ok := requestID(r)
			if !ok {
				http.Error(w, "Некорректный идентификатор", http.StatusBadRequest)
				return
			}
			status = http.StatusOK
			err = db.QueryRow(r.Context(), `UPDATE stops SET name=$1, location=$2 WHERE id=$3
				RETURNING id, name, location`, input.Name, input.Location, id).Scan(&stop.ID, &stop.Name, &stop.Location)
		}
		if err != nil {
			mutationError(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(status)
		sendJSON(w, stop)
	})
	mux.HandleFunc("POST /api/admin/stops", stopSave)
	mux.HandleFunc("PUT /api/admin/stops/{id}", stopSave)
	mux.HandleFunc("DELETE /api/admin/stops/{id}", s.require(func(w http.ResponseWriter, r *http.Request) {
		id, ok := requestID(r)
		if !ok {
			http.Error(w, "Некорректный идентификатор", http.StatusBadRequest)
			return
		}
		if err := affected(db.Exec(r.Context(), "DELETE FROM stops WHERE id=$1", id)); err != nil {
			mutationError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	routeSave := s.require(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Number     string  `json:"number"`
			Transport  string  `json:"transport"`
			Directions [][]int `json:"directions"`
		}
		if !readJSON(w, r, &input) {
			return
		}
		input.Number = strings.TrimSpace(input.Number)
		if len(input.Number) > 40 || !validText(input.Number, 40) || !validTransport(input.Transport) ||
			len(input.Directions) != 2 || !validSequence(input.Directions[0]) || !validSequence(input.Directions[1]) {
			http.Error(w, "Укажите номер, вид транспорта и от 2 до 100 остановок в каждом направлении", http.StatusBadRequest)
			return
		}
		id, ok := requestID(r)
		if r.Method == "PUT" && !ok {
			http.Error(w, "Некорректный идентификатор", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		err := pgx.BeginFunc(ctx, db, func(tx pgx.Tx) error {
			if r.Method == "POST" {
				if err := tx.QueryRow(ctx, `INSERT INTO routes(number, transport) VALUES($1, $2) RETURNING id`,
					input.Number, input.Transport).Scan(&id); err != nil {
					return err
				}
				if _, err := tx.Exec(ctx, `INSERT INTO directions VALUES ($1, 0), ($1, 1)`, id); err != nil {
					return err
				}
			} else {
				if err := affected(tx.Exec(ctx, `UPDATE routes SET number=$1, transport=$2 WHERE id=$3`,
					input.Number, input.Transport, id)); err != nil {
					return err
				}
				if _, err := tx.Exec(ctx, `DELETE FROM route_stops WHERE route_id=$1`, id); err != nil {
					return err
				}
			}
			for direction, stops := range input.Directions {
				if _, err := tx.Exec(ctx, `INSERT INTO route_stops(route_id, direction, position, stop_id)
					SELECT $1, $2, position, stop_id FROM unnest($3::int[]) WITH ORDINALITY AS selected(stop_id, position)`,
					id, direction, stops); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			mutationError(w, err)
			return
		}
		if r.Method == "POST" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusCreated)
		}
		sendJSON(w, map[string]int{"id": id})
	})
	mux.HandleFunc("POST /api/admin/routes", routeSave)
	mux.HandleFunc("PUT /api/admin/routes/{id}", routeSave)
	mux.HandleFunc("DELETE /api/admin/routes/{id}", s.require(func(w http.ResponseWriter, r *http.Request) {
		id, ok := requestID(r)
		if !ok {
			http.Error(w, "Некорректный идентификатор", http.StatusBadRequest)
			return
		}
		if err := affected(db.Exec(r.Context(), "DELETE FROM routes WHERE id=$1", id)); err != nil {
			mutationError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
}

func validSequence(stops []int) bool {
	if len(stops) < 2 || len(stops) > 100 {
		return false
	}
	for _, id := range stops {
		if id < 1 || id > 2147483647 {
			return false
		}
	}
	return true
}

func timetableParams(r *http.Request) (id, direction int, day string, valid bool) {
	id, valid = requestID(r)
	raw := r.URL.Query().Get("direction")
	day = r.URL.Query().Get("day")
	if raw == "1" {
		direction = 1
	}
	return id, direction, day, valid && (raw == "0" || raw == "1") && (day == "weekday" || day == "weekend")
}

func validDepartures(times []string) bool {
	if times == nil || len(times) > 200 {
		return false
	}
	seen := make(map[string]bool, len(times))
	for _, value := range times {
		parsed, err := time.Parse("15:04", value)
		if err != nil || parsed.Format("15:04") != value || seen[value] {
			return false
		}
		seen[value] = true
	}
	return true
}

func addTimetable(mux *http.ServeMux, db *pgxpool.Pool, s *adminSession) {
	mux.HandleFunc("GET /api/routes/{id}/schedule", func(w http.ResponseWriter, r *http.Request) {
		id, direction, day, ok := timetableParams(r)
		if !ok {
			http.Error(w, "Выберите направление и тип дня", http.StatusBadRequest)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		var times []string
		err := db.QueryRow(ctx, `SELECT ARRAY(
			SELECT to_char(departure, 'HH24:MI') FROM departures dp
			WHERE (dp.route_id, dp.direction, dp.day_kind) = ($1, $2, $3)
			ORDER BY departure
		) FROM directions WHERE (route_id, direction) = ($1, $2)`, id, direction, day).Scan(&times)
		if err != nil {
			readError(w, err)
			return
		}
		sendJSON(w, times)
	})
	mux.HandleFunc("PUT /api/admin/routes/{id}/schedule", s.require(func(w http.ResponseWriter, r *http.Request) {
		id, direction, day, ok := timetableParams(r)
		if !ok {
			http.Error(w, "Выберите направление и тип дня", http.StatusBadRequest)
			return
		}
		var times []string
		if !readJSON(w, r, &times) {
			return
		}
		if !validDepartures(times) {
			http.Error(w, "Укажите неповторяющиеся значения времени в формате ЧЧ:ММ (до 200)", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		err := pgx.BeginFunc(ctx, db, func(tx pgx.Tx) error {
			var existing int
			if err := tx.QueryRow(ctx, `SELECT route_id FROM directions
				WHERE (route_id, direction)=($1, $2) FOR UPDATE`, id, direction).Scan(&existing); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `DELETE FROM departures WHERE (route_id, direction, day_kind)=($1, $2, $3)`,
				id, direction, day); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `INSERT INTO departures (route_id, direction, day_kind, departure)
				SELECT $1, $2, $3, value::time FROM unnest($4::text[]) AS t(value)`, id, direction, day, times)
			return err
		})
		if err != nil {
			mutationError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
}
