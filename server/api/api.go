package api

import (
	"context"
	"flag"
	config "pipegraph/config"
	"pipegraph/graph"
)

var (
	port = flag.Int("port", 50051, "The server port")
)

type ImplementedGraphServer struct {
	UnimplementedGraphServer

	graph *graph.Graph
}

func NewImplementedGraphServer(graph *graph.Graph) *ImplementedGraphServer {
	return &ImplementedGraphServer{
		graph: graph,
	}
}

func (s ImplementedGraphServer) GetInfo(ctx context.Context, _ *Nothing) (*config.Graph, error) {
	return &config.Graph{}, nil
}

func (s ImplementedGraphServer) GetState(ctx context.Context, _ *Nothing) (*GraphState, error) {
	state := &GraphState{NodeStates: make(map[uint64]graph.NodeState)}
	for id, node := range s.graph.Nodes {
		state.NodeStates[uint64(id)] = node.GetState()
	}
	return state, nil
}

func (s ImplementedGraphServer) Run(ctx context.Context, _ *Nothing) (*Nothing, error) {
	s.graph.Run()
	return &Nothing{}, nil
}
