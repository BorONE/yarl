package api

import (
	"context"
	"fmt"
	"log"
	"pipegraph/graph"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
)

type ImplementedNodeServer struct {
	UnimplementedNodeServer

	graph *graph.Graph
	mutex *sync.Mutex
}

func (s ImplementedNodeServer) Run(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	log.Printf("running node{%v}.Run()\n", prototext.MarshalOptions{}.Format(id))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(id.GetId())]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	return nil, node.Run(s.mutex)
}

// in case of simultaneous calls the first call will collect all of the updates, and the rest will be empty
func (s ImplementedNodeServer) WaitRunEnd(ctx context.Context, id *NodeIdentifier) (*Updates, error) {
	log.Printf("serving node{%v}.WaitRunEnd()\n", prototext.MarshalOptions{}.Format(id))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(id.GetId())]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	updatesReady := make(chan any, 1)
	genUpdates := func() {
		defer func() { updatesReady <- struct{}{} }()

		s.graph.Updates = append(s.graph.Updates, node.GetState())
		if node.Status == graph.NodeStatus_Success {
			for _, outputId := range node.Output {
				output := s.graph.Nodes[graph.NodeId(outputId)]
				s.graph.Updates = append(s.graph.Updates, output.GetState())
			}
		}
	}

	switch status := node.Status; status {
	case graph.NodeStatus_Stopped, graph.NodeStatus_Running:
		node.EndListeners = append(node.EndListeners, func() { s.mutex.Lock(); genUpdates() })
		s.mutex.Unlock()
	case graph.NodeStatus_Idle:
		return nil, fmt.Errorf("unexepected state: %s", status.String())
	case graph.NodeStatus_Failed, graph.NodeStatus_Success:
		genUpdates()
	default:
		log.Panicln("unexpected state: ", status.String())
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-updatesReady:
		return &Updates{NodeStates: s.graph.PopUpdates()}, nil
	}
}

func (s ImplementedNodeServer) Reset(ctx context.Context, id *NodeIdentifier) (*Updates, error) {
	log.Printf("running node{%v}.Reset()\n", prototext.MarshalOptions{}.Format(id))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(id.GetId())]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	err := node.Reset()

	return &Updates{NodeStates: s.graph.PopUpdates()}, err
}
