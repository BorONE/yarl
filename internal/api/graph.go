package api

import (
	"context"
	"log"
	"pipegraph/internal/graph"
	"pipegraph/internal/util"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
)

type ImplementedGraphServer struct {
	UnimplementedGraphServer

	graph *GraphHolder
	mutex *sync.Mutex
}

func (s ImplementedGraphServer) New(ctx context.Context, _ *Nothing) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving New()\n")
	return nil, s.graph.New(ctx)
}

func (s ImplementedGraphServer) Load(ctx context.Context, path *Path) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Load(%v)\n", prototext.MarshalOptions{}.Format(path))
	return nil, s.graph.Load(ctx, path)
}

func (s ImplementedGraphServer) Save(ctx context.Context, path *Path) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Save(%v)\n", prototext.MarshalOptions{}.Format(path))
	return nil, s.graph.Save(ctx, path)
}

func (s ImplementedGraphServer) GetConfig(ctx context.Context, _ *Nothing) (*graph.Config, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Println("serving GetConfig()")
	return s.graph.Config, nil
}

func (s ImplementedGraphServer) CollectState(ctx context.Context, _ *Nothing) (*State, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Println("serving CollectState()")
	return &State{NodeStates: s.graph.CollectNodeStates()}, nil
}

func (s ImplementedGraphServer) RunReadyNode(ctx context.Context, _ *Nothing) (*NodeIdentifier, error) {
	log.Println("serving RunReadyNode()")

	for {
		waitAny, isRunning := util.NewWaitAny(), false

		s.mutex.Lock()

		for _, node := range s.graph.Nodes {
			if node.Status == graph.NodeStatus_Running {
				node.EndListeners = append(node.EndListeners, waitAny.Done)
				isRunning = true
			}

			if node.Status == graph.NodeStatus_Idle && node.IsReady() {
				defer s.mutex.Unlock()
				return &NodeIdentifier{Id: node.Config.Id}, node.Run(s.mutex)
			}
		}

		s.mutex.Unlock()

		if !isRunning {
			break
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-waitAny.Select():
			continue
		}
	}

	return nil, nil
}

func (s ImplementedGraphServer) Connect(ctx context.Context, edge *graph.EdgeConfig) (*Updates, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Connect(%v)\n", prototext.MarshalOptions{}.Format(edge))
	err := s.graph.Connect(edge)
	return &Updates{NodeStates: s.graph.PopUpdates()}, err
}

func (s ImplementedGraphServer) Disconnect(ctx context.Context, edge *graph.EdgeConfig) (*Updates, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Disconnect(%v)\n", prototext.MarshalOptions{}.Format(edge))
	err := s.graph.Disconnect(edge)
	return &Updates{NodeStates: s.graph.PopUpdates()}, err
}
