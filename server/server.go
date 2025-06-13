package server

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"pipegraph/graph"

	"github.com/gorilla/mux"
)

type Server struct {
	*mux.Router
	httpServer *http.Server

	ShutdownAllowedDuration time.Duration

	graph *graph.Graph
}

func NewServer(graph *graph.Graph) *Server {
	v1 := Server{
		Router: mux.NewRouter(),

		ShutdownAllowedDuration: time.Minute,

		graph: graph,
	}
	v1.httpServer = &http.Server{
		Addr: "0.0.0.0:8080",
		// Good practice to set timeouts to avoid Slowloris attacks.
		WriteTimeout: time.Second * 15,
		ReadTimeout:  time.Second * 15,
		IdleTimeout:  time.Second * 60,

		Handler: v1,
	}

	v1.HandleFunc("/admin/status", v1.status)
	v1.HandleFunc("/admin/shutdown", v1.shutdown)

	v1.HandleFunc("/api/v1/graph", v1.handleGraph).Methods("GET")
	v1.HandleFunc("/api/v1/graph/state", v1.handleGraphState).Methods("GET")
	v1.HandleFunc("/api/v1/graph/run", v1.handleGraphState).Methods("")

	return &v1
}

func (s *Server) ListenAndServe() {
	if err := s.httpServer.ListenAndServe(); err != nil {
		log.Println(err)
	}
}

func (s *Server) Shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), s.ShutdownAllowedDuration)
	defer cancel()

	s.httpServer.Shutdown(ctx)

	os.Exit(0)
}
