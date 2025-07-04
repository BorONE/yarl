package api

import (
	"context"
	"fmt"
	"log"
	"pipegraph/graph"
	"slices"
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
		node.EndListeners = append(node.EndListeners, func() { genUpdates() })
	case graph.NodeStatus_Idle:
		return nil, fmt.Errorf("unexepected state: %s", status.String())
	case graph.NodeStatus_Failed, graph.NodeStatus_Success:
		genUpdates()
	default:
		log.Panicln("unexpected state: ", status.String())
	}

	s.mutex.Unlock()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-updatesReady:
		s.mutex.Lock()
		defer s.mutex.Unlock()
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

func (s ImplementedNodeServer) Add(ctx context.Context, config *graph.NodeConfig) (*NodeIdentifier, error) {
	log.Printf("adding node{%v}\n", prototext.MarshalOptions{}.Format(config))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	nodeId := s.graph.AddNewNode(config)
	id := uint64(nodeId)
	return &NodeIdentifier{Id: &id}, nil
}

func (s ImplementedNodeServer) Edit(ctx context.Context, config *graph.NodeConfig) (*Nothing, error) {
	log.Printf("running node{Id:%v}.Edit(%v)\n", *config.Id, prototext.MarshalOptions{}.Format(config))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(*config.Id)]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", *config.Id)
	}

	node.Config = config

	return nil, nil
}

func (s ImplementedNodeServer) Delete(ctx context.Context, id *NodeIdentifier) (*Updates, error) {
	log.Printf("deleting node{%v}\n", prototext.MarshalOptions{}.Format(id))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(id.GetId())]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	for _, inputId := range node.Input {
		fromNodeId := uint64(inputId)
		err := s.graph.Disconnect(&graph.EdgeConfig{FromNodeId: &fromNodeId, ToNodeId: id.Id})
		if err != nil {
			return &Updates{NodeStates: s.graph.PopUpdates()}, err
		}
	}
	// these updates are updates of the node to be deleted, so we do not need them
	s.graph.PopUpdates()

	for _, outputId := range node.Output {
		toNodeId := uint64(outputId)
		err := s.graph.Disconnect(&graph.EdgeConfig{FromNodeId: id.Id, ToNodeId: &toNodeId})
		if err != nil {
			return &Updates{NodeStates: s.graph.PopUpdates()}, err
		}
	}

	delete(s.graph.Nodes, graph.NodeId(id.GetId()))

	s.graph.Config.Nodes = slices.DeleteFunc(s.graph.Config.Nodes, func(nodeConfig *graph.NodeConfig) bool { return nodeConfig.GetId() == id.GetId() })

	return &Updates{NodeStates: s.graph.PopUpdates()}, nil
}
