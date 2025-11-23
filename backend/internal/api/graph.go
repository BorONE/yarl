package api

import (
	"context"
	"log"
	"sync"
	"yarl/internal/graph"
	"yarl/internal/util"

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
	return nil, util.GrpcError(s.graph.New(ctx))
}

func (s ImplementedGraphServer) Load(ctx context.Context, path *Path) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Load(%v)\n", prototext.MarshalOptions{}.Format(path))
	return nil, util.GrpcError(s.graph.Load(ctx, path.GetPath()))
}

func (s ImplementedGraphServer) Save(ctx context.Context, path *Path) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Save(%v)\n", prototext.MarshalOptions{}.Format(path))
	return nil, util.GrpcError(s.graph.Save(ctx, path.GetPath()))
}

func generateInit(g *graph.Graph, gen func(*graph.SyncResponse)) {
	for _, node := range g.Nodes {
		gen(&graph.SyncResponse{
			Type:       graph.SyncType_InitNode.Enum(),
			NodeConfig: node.Config,
			NodeState:  node.GetState(),
		})
	}
	for _, edge := range g.Config.Edges {
		gen(&graph.SyncResponse{
			Type:       graph.SyncType_InitEdge.Enum(),
			EdgeConfig: edge,
		})
	}
	gen(&graph.SyncResponse{
		Type: graph.SyncType_InitDone.Enum(),
	})
}

func (s ImplementedGraphServer) Sync(_ *Nothing, stream grpc.ServerStreamingServer[graph.SyncResponse]) error {
	s.mutex.Lock()

	log.Println("streaming Sync() init")
	generateInit(s.graph.Graph, func(sync *graph.SyncResponse) { stream.Send(sync) })

	syncListener, syncListenerDone := s.graph.NewSyncListener()
	defer syncListenerDone()

	s.mutex.Unlock()

	log.Println("streaming Sync() update")
	for {
		select {
		case <-stream.Context().Done():
			log.Println("streaming Sync() stream context done:", stream.Context().Err())
			return stream.Context().Err()
		case sync := <-syncListener:
			stream.Send(sync)
		case <-s.graph.ctx.Done():
			log.Println("streaming Sync() graph context done:", s.graph.ctx.Err())
			return util.GrpcError(s.graph.ctx.Err())
		}
	}
}

func (s ImplementedGraphServer) ScheduleAll(ctx context.Context, _ *Nothing) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	for _, node := range s.graph.Nodes {
		state, isIdle := node.GetState().State.(*graph.NodeState_Idle)
		if !isIdle {
			continue
		}

		var err error
		if state.Idle.GetIsReady() {
			err = node.Run()
		} else if state.Idle.GetPlan() == graph.NodeState_IdleState_None {
			err = node.Plan(graph.NodeState_IdleState_Scheduled)
		}
		if err != nil {
			util.GrpcError(err)
		}
	}

	return nil, nil
}

func (s ImplementedGraphServer) Connect(ctx context.Context, edge *graph.EdgeConfig) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Connect(%v)\n", prototext.MarshalOptions{}.Format(edge))
	err := s.graph.Connect(edge)
	if err != nil {
		return nil, util.GrpcError(err)
	}

	err = s.graph.SaveCurrent(ctx)
	if err != nil {
		return nil, util.GrpcError(err)
	}

	return nil, nil
}

func (s ImplementedGraphServer) Disconnect(ctx context.Context, edge *graph.EdgeConfig) (*Nothing, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("serving Disconnect(%v)\n", prototext.MarshalOptions{}.Format(edge))
	err := s.graph.Disconnect(edge)
	if err != nil {
		return nil, util.GrpcError(err)
	}

	err = s.graph.SaveCurrent(ctx)
	if err != nil {
		return nil, util.GrpcError(err)
	}

	return nil, nil
}
