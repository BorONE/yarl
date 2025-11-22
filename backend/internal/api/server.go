package api

import (
	"context"
	"pipegraph/internal/graph"
	"sync"

	grpc "google.golang.org/grpc"
)

func NewServer() *grpc.Server {
	server := grpc.NewServer()
	holder, mutex := &GraphHolder{}, &sync.Mutex{}
	graph.EndGuard = mutex
	RegisterGraphServer(server, ImplementedGraphServer{graph: holder, mutex: mutex})
	RegisterNodeServer(server, ImplementedNodeServer{graph: holder, mutex: mutex})
	holder.New(context.Background())
	return server
}
