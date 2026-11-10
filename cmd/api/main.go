package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vasmaae/software-engineering/internal/catalog"
	"github.com/vasmaae/software-engineering/internal/password"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatal("invalid database configuration")
	}
	defer db.Close()
	// Compose can restart the API while PostgreSQL is still opening its socket.
	for db.Ping(ctx) != nil {
		select {
		case <-ctx.Done():
			log.Fatal("database is unavailable")
		case <-time.After(200 * time.Millisecond):
		}
	}
	admin := catalog.AdminConfig{Secure: os.Getenv("SECURE_COOKIE") == "true"}
	if value := os.Getenv("ADMIN_PASSWORD_HASH"); value != "" {
		hash, err := password.Parse(value)
		if err != nil {
			log.Fatal("ADMIN_PASSWORD_HASH has an invalid format")
		}
		admin.Password = &hash
	}
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	mux := http.NewServeMux()
	mux.Handle("/api/", catalog.NewHandler(db, admin))
	if web := os.Getenv("WEB_ROOT"); web != "" {
		mux.Handle("/", http.FileServer(http.Dir(web)))
	}
	server := &http.Server{
		Addr: addr, Handler: mux,
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second,
	}
	log.Printf("API listening on %s", addr)
	log.Fatal(server.ListenAndServe())
}
