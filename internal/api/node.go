package api

import (
	"context"
	"fmt"
	"log"
	"pipegraph/internal/graph"
	"slices"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
	"google.golang.org/protobuf/proto"
)

type ImplementedNodeServer struct {
	UnimplementedNodeServer

	graph *GraphHolder
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

func (s ImplementedNodeServer) Stop(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	log.Printf("running node{%v}.Stop()\n", prototext.MarshalOptions{}.Format(id))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(id.GetId())]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	return nil, node.Stop()
}

// in case of simultaneous calls the first call will collect all of the updates, and the rest will be empty
func (s ImplementedNodeServer) WaitDone(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	log.Printf("serving node{%v}.WaitDone()\n", prototext.MarshalOptions{}.Format(id))

	s.mutex.Lock()

	node := s.graph.Nodes[graph.NodeId(id.GetId())]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	updatesReady := make(chan any, 1)
	genUpdates := func() {
		defer func() { updatesReady <- struct{}{} }()

		if state := node.GetState().State.(*graph.NodeState_Done); state.Done.Error == nil {
			for _, outputId := range node.Output {
				output := s.graph.Nodes[graph.NodeId(outputId)]
				output.ReportUpdate()
			}
		}
	}

	switch node.GetState().State.(type) {
	case *graph.NodeState_Idle:
		return nil, fmt.Errorf("unexepected state: %s", node.GetStateString())
	case *graph.NodeState_InProgress:
		node.DoneEvent.OnTrigger(genUpdates)
	case *graph.NodeState_Done:
		genUpdates()
	default:
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	s.mutex.Unlock()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-updatesReady:
		s.mutex.Lock()
		defer s.mutex.Unlock()
		return nil, nil
	}
}

func (s ImplementedNodeServer) Reset(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	log.Printf("running node{%v}.Reset()\n", prototext.MarshalOptions{}.Format(id))

	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(id.GetId())]
	if node == nil {
		return nil, fmt.Errorf("node (id=%v) not found", id.GetId())
	}

	return nil, node.Reset()
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

	node.Config.Reset()
	proto.Merge(node.Config, config)

	return nil, nil
}

func (s ImplementedNodeServer) Delete(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
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
			return nil, err
		}
	}

	for _, outputId := range node.Output {
		toNodeId := uint64(outputId)
		err := s.graph.Disconnect(&graph.EdgeConfig{FromNodeId: id.Id, ToNodeId: &toNodeId})
		if err != nil {
			return nil, err
		}
	}

	delete(s.graph.Nodes, graph.NodeId(id.GetId()))

	s.graph.Config.Nodes = slices.DeleteFunc(s.graph.Config.Nodes, func(nodeConfig *graph.NodeConfig) bool { return nodeConfig.GetId() == id.GetId() })

	return nil, nil
}
