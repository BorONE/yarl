package api

import (
	"context"
	"log"
	"pipegraph/graph"
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

func (s ImplementedGraphServer) GetConfig(ctx context.Context, _ *Nothing) (*graph.Config, error) {
	log.Println("serving info")
	return s.graph.Config, nil
}

func (s ImplementedGraphServer) GetState(ctx context.Context, _ *Nothing) (*GraphState, error) {
	log.Println("serving state")
	state := &GraphState{NodeStates: make(map[uint64]graph.NodeState)}
	for id, node := range s.graph.Nodes {
		state.NodeStates[uint64(id)] = node.GetState()
	}
	return state, nil
}

func (s ImplementedGraphServer) Run(ctx context.Context, _ *Nothing) (*Nothing, error) {
	log.Println("runnning")
	go s.graph.Run()
	return &Nothing{}, nil
}
