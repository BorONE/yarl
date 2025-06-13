package server

import (
	"io"
	"net/http"
)

func (s *Server) status(w http.ResponseWriter, r *http.Request) {
	io.WriteString(w, "ok")
}

func (s *Server) shutdown(w http.ResponseWriter, r *http.Request) {
	go s.Shutdown()
}
