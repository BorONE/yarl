package api

import (
	graph "pipegraph/graph"
	"sync"
)

func NewImplementedServers(graph *graph.Graph) (*ImplementedGraphServer, *ImplementedNodeServer) {
	mutex := &sync.Mutex{}
	graphServer := &ImplementedGraphServer{graph: graph, mutex: mutex}
	nodeServer := &ImplementedNodeServer{graph: graph, mutex: mutex}
	return graphServer, nodeServer
}
