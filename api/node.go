package api

import (
	"context"
	"fmt"
	"log"
	"pipegraph/graph"
)

type ImplementedNodeServer struct {
	UnimplementedNodeServer

	graph *graph.Graph
}

func NewImplementedNodeServer(graph *graph.Graph) *ImplementedNodeServer {
	return &ImplementedNodeServer{
		graph: graph,
	}
}

func (s ImplementedNodeServer) Run(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	log.Println("running node")
	node, ok := s.graph.Nodes[graph.NodeId(id.GetId())]
	if !ok {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	err := node.Run()
	if err != nil {
		return nil, err
	}

	return &Nothing{}, nil
}

func (s ImplementedNodeServer) Reset(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	log.Println("resetting node")
	node, ok := s.graph.Nodes[graph.NodeId(id.GetId())]
	if !ok {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}
	err := node.Reset()
	if err != nil {
		return nil, err
	}
	return &Nothing{}, nil
}
