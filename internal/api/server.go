package api

import (
	"context"
	"sync"

	grpc "google.golang.org/grpc"
)

func NewServer() *grpc.Server {
	server := grpc.NewServer()
	graph, mutex := &GraphHolder{}, &sync.Mutex{}
	RegisterGraphServer(server, ImplementedGraphServer{graph: graph, mutex: mutex})
	RegisterNodeServer(server, ImplementedNodeServer{graph: graph, mutex: mutex})
	graph.New(context.Background())
	return server
}
