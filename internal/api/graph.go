package api

import (
	"context"
	"log"
	"pipegraph/internal/graph"
	"pipegraph/internal/util"
	"sync"

	grpc "google.golang.org/grpc"
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

func (s ImplementedGraphServer) Sync(_ *Nothing, stream grpc.ServerStreamingServer[SyncResponse]) error {
	s.mutex.Lock()

	log.Println("streaming Watch() init")
	for _, node := range s.graph.Nodes {
		stream.Send(&SyncResponse{
			Type:       SyncType_InitNode.Enum(),
			NodeConfig: node.Config,
			NodeState:  node.GetState(),
		})
	}
	for _, edge := range s.graph.Config.Edges {
		stream.Send(&SyncResponse{
			Type:       SyncType_InitEdge.Enum(),
			EdgeConfig: edge,
		})
	}
	stream.Send(&SyncResponse{
		Type: SyncType_InitDone.Enum(),
	})

	syncListener, syncListenerDone := s.graph.NewSyncListener()
	defer syncListenerDone()

	s.mutex.Unlock()

	log.Println("streaming Watch() update")
	for {
		select {
		case <-stream.Context().Done():
			log.Println("streaming Watch() ", stream.Context().Err())
			return stream.Context().Err()
		case state := <-syncListener:
			stream.Send(&SyncResponse{
				Type:      SyncType_UpdateState.Enum(),
				NodeState: state,
			})
		}
	}
}

func (s ImplementedGraphServer) RunReadyNode(ctx context.Context, _ *Nothing) (*NodeIdentifier, error) {
	log.Println("serving RunReadyNode()")

	for {
		waitAny, isRunning := util.NewWaitAny(), false

		s.mutex.Lock()

		for _, node := range s.graph.Nodes {
			switch state := node.GetState().State.(type) {
			case *graph.NodeState_InProgress:
				node.DoneEvent.OnTrigger(waitAny.Done)
				isRunning = true
			case *graph.NodeState_Idle:
				if state.Idle.GetIsReady() {
					defer s.mutex.Unlock()
					return &NodeIdentifier{Id: node.Config.Id}, node.Run(s.mutex)
				}
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

func (s ImplementedGraphServer) Connect(ctx context.Context, edge *graph.EdgeConfig) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Connect(%v)\n", prototext.MarshalOptions{}.Format(edge))
	return nil, s.graph.Connect(edge)
}

func (s ImplementedGraphServer) Disconnect(ctx context.Context, edge *graph.EdgeConfig) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Disconnect(%v)\n", prototext.MarshalOptions{}.Format(edge))
	return nil, s.graph.Disconnect(edge)
}
