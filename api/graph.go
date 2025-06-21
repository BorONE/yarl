package api

import (
	"context"
	"fmt"
	"log"
	"pipegraph/graph"
	"time"
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

func asPtr[T any](x T) *T {
	p := new(T)
	*p = x
	return p
}

func (s ImplementedGraphServer) GetGlobalState(ctx context.Context, _ *Nothing) (*GlobalState, error) {
	log.Println("serving as updates")
	// TODO global lock
	result := &GlobalState{}
	for _, nodeConfig := range s.graph.Config.Nodes {
		node := s.graph.Nodes[graph.NodeId(*nodeConfig.Id)]
		result.Nodes = append(result.Nodes, &NodeWithState{
			Config: nodeConfig,
			State: &NodeState{
				Id:      asPtr(*nodeConfig.Id),
				Status:  node.GetStatus().Enum(),
				IsReady: asPtr(node.IsReady()),
			},
		})
	}
	result.Edges = s.graph.Config.Edges
	return result, nil
}

func (s ImplementedGraphServer) RunReadyNode(ctx context.Context, _ *Nothing) (*NodeIdentifier, error) {
	for {
		state, err := s.GetGlobalState(ctx, &Nothing{})
		if err != nil {
			return nil, err
		}

		isRunning := false

		for _, node := range state.Nodes {
			switch *node.State.Status {
			case graph.NodeStatus_Stopped, graph.NodeStatus_Finished, graph.NodeStatus_Failed:
				// noop
			case graph.NodeStatus_Running:
				isRunning = true
			case graph.NodeStatus_Waiting:
				if *node.State.IsReady {
					err := s.graph.Nodes[graph.NodeId(*node.Config.Id)].Run()
					if err != nil {
						continue
					}
					return &NodeIdentifier{Id: node.Config.Id}, nil
				}
			default:
				log.Panicln("unexpected state: ", node.State.Status.String())
			}

			time.Sleep(time.Second)
		}

		if !isRunning {
			return nil, nil
		}
	}
}

func (s ImplementedGraphServer) WaitRunEnd(ctx context.Context, identifier *NodeIdentifier) (*Updates, error) {
	node, ok := s.graph.Nodes[graph.NodeId(*identifier.Id)]
	if !ok {
		return nil, fmt.Errorf("node not found")
	}

	for {
		status := node.GetStatus()
		switch status {
		case graph.NodeStatus_Failed, graph.NodeStatus_Finished:
			nodeStates := []*NodeState{
				{
					Id:     node.Config.Id,
					Status: &status,
					// IsReady: asPtr(false),
					IsReady: asPtr(node.IsReady()),
				},
			}
			if status == graph.NodeStatus_Finished {
				for _, outputId := range node.Output {
					output := s.graph.Nodes[graph.NodeId(outputId)]
					nodeStates = append(nodeStates, &NodeState{
						Id:      output.Config.Id,
						Status:  output.GetStatus().Enum(),
						IsReady: asPtr(output.IsReady()),
					})
				}
			}
			return &Updates{NodeStates: nodeStates}, nil
		case graph.NodeStatus_Stopped, graph.NodeStatus_Running:
			// noop
		case graph.NodeStatus_Waiting:
			return nil, fmt.Errorf("unexepected state: %s", status.String())
		default:
			log.Panicln("unexpected state: ", status.String())
		}

		time.Sleep(time.Second)
	}
}
