package api

import (
	"context"
	"fmt"
	"log"
	"pipegraph/graph"
	"time"

	"google.golang.org/protobuf/encoding/prototext"
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

func (s ImplementedGraphServer) GetGlobalState(ctx context.Context, _ *Nothing) (*GlobalState, error) {
	log.Println("serving GetGlobalState()")
	s.graph.GlobalLock()
	defer s.graph.GlobalUnlock()
	result := &GlobalState{}
	for _, nodeConfig := range s.graph.Config.Nodes {
		node := s.graph.Nodes[graph.NodeId(*nodeConfig.Id)]
		result.Nodes = append(result.Nodes, &NodeWithState{
			Config: nodeConfig,
			State:  node.GetStateWithoutLock(),
		})
	}
	result.Edges = s.graph.Config.Edges
	return result, nil
}

func (s ImplementedGraphServer) RunReadyNode(ctx context.Context, _ *Nothing) (*NodeIdentifier, error) {
	log.Println("serving RunReadyNode()")
	for {
		node, isRunning, err := s.graph.TryRunAnyNode()
		if err != nil {
			return nil, err
		} else if node != nil {
			return &NodeIdentifier{Id: node.Config.Id}, nil
		} else if !isRunning {
			return nil, nil
		} else {
			time.Sleep(time.Second)
		}
	}
}

func (s ImplementedGraphServer) WaitRunEnd(ctx context.Context, identifier *NodeIdentifier) (*Updates, error) {
	log.Printf("serving WaitRunEnd(%v)\n", prototext.Format(identifier))
	node, ok := s.graph.Nodes[graph.NodeId(*identifier.Id)]
	if !ok {
		return nil, fmt.Errorf("node not found")
	}

	status, err := node.WaitRunEnd()
	if err != nil {
		return nil, err
	}

	nodeStates := []*graph.NodeState{node.GetState()}
	if status == graph.NodeStatus_Success {
		for _, outputId := range node.Output {
			output := s.graph.Nodes[graph.NodeId(outputId)]
			nodeStates = append(nodeStates, output.GetState())
		}
	}
	return &Updates{NodeStates: nodeStates}, nil
}
