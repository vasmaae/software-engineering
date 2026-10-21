package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vasmaae/software-engineering/internal/catalog"
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
	if err := db.Ping(ctx); err != nil {
		log.Fatal("database is unavailable")
	}
	server := &http.Server{
		Addr: ":8080", Handler: catalog.NewHandler(db),
		ReadHeaderTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second,
		IdleTimeout: 60 * time.Second,
	}
	log.Print("API listening on :8080")
	log.Fatal(server.ListenAndServe())
}
