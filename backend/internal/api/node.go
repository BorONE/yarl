package api

import (
	"context"
	"fmt"
	"log"
	"pipegraph/internal/graph"
	"pipegraph/internal/util"
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

func (s ImplementedNodeServer) onNode(id uint64, call func(node *graph.Node) error) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	node := s.graph.Nodes[graph.NodeId(id)]
	if node == nil {
		err := fmt.Errorf("node (id=%v) not found", id)
		return util.GrpcError(err)
	}

	err := call(node)
	return util.GrpcError(err)
}

func (s ImplementedNodeServer) Run(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	return nil, s.onNode(id.GetId(), func(node *graph.Node) error {
		log.Printf("running node{%v}.Run()\n", prototext.MarshalOptions{}.Format(id))
		return node.Run()
	})
}

func (s ImplementedNodeServer) Schedule(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	return nil, s.onNode(id.GetId(), func(node *graph.Node) error {
		log.Printf("running node{%v}.Schedule()\n", prototext.MarshalOptions{}.Format(id))
		return node.Schedule()
	})
}

func (s ImplementedNodeServer) Done(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	return nil, s.onNode(id.GetId(), func(node *graph.Node) error {
		log.Printf("running node{%v}.Done()\n", prototext.MarshalOptions{}.Format(id))
		return node.Done()
	})
}

func (s ImplementedNodeServer) Plan(ctx context.Context, nodePlan *NodePlan) (*Nothing, error) {
	return nil, s.onNode(nodePlan.GetId(), func(node *graph.Node) error {
		log.Printf("running node{Id: %v}.Plan(%v)\n", nodePlan.GetId(), nodePlan.GetPlan().String())
		return node.Plan(nodePlan.GetPlan())
	})
}

func (s ImplementedNodeServer) Stop(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	return nil, s.onNode(id.GetId(), func(node *graph.Node) error {
		log.Printf("running node{%v}.Stop()\n", prototext.MarshalOptions{}.Format(id))
		return node.Stop()
	})
}

func (s ImplementedNodeServer) Skip(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	return nil, s.onNode(id.GetId(), func(node *graph.Node) error {
		log.Printf("running node{%v}.Skip()\n", prototext.MarshalOptions{}.Format(id))
		return node.Skip()
	})
}

func (s ImplementedNodeServer) Reset(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	return nil, s.onNode(id.GetId(), func(node *graph.Node) error {
		log.Printf("running node{%v}.Reset()\n", prototext.MarshalOptions{}.Format(id))
		return node.Reset()
	})
}

func (s ImplementedNodeServer) CollectArts(ctx context.Context, id *NodeIdentifier) (*Arts, error) {
	var arts *Arts
	return arts, s.onNode(id.GetId(), func(node *graph.Node) error {
		log.Printf("running node{%v}.CollectArts()\n", prototext.MarshalOptions{}.Format(id))
		if node.Job != nil {
			arts = &Arts{Arts: node.Job.CollectArtifacts()}
		}
		return nil
	})
}

func (s ImplementedNodeServer) Add(ctx context.Context, config *graph.NodeConfig) (*NodeIdentifier, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Printf("adding node{%v}\n", prototext.MarshalOptions{}.Format(config))

	nodeId := s.graph.AddNewNode(config)
	id := uint64(nodeId)

	err := s.graph.SaveCurrent(ctx)
	if err != nil {
		return nil, util.GrpcError(err)
	}

	return &NodeIdentifier{Id: &id}, nil
}

func (s ImplementedNodeServer) Edit(ctx context.Context, config *graph.NodeConfig) (*Nothing, error) {
	return nil, s.onNode(config.GetId(), func(node *graph.Node) error {
		log.Printf("running node{Id:%v}.Edit(%v)\n", *config.Id, prototext.MarshalOptions{}.Format(config))

		node.Config.Reset()
		proto.Merge(node.Config, config)

		err := s.graph.SaveCurrent(ctx)
		if err != nil {
			return err
		}

		return nil
	})
}

func (s ImplementedNodeServer) Delete(ctx context.Context, id *NodeIdentifier) (*Nothing, error) {
	return nil, s.onNode(id.GetId(), func(node *graph.Node) error {
		if len(node.CollectInput()) > 0 || len(node.CollectOutput()) > 0 {
			return fmt.Errorf("node (id=%v) has edges", id.GetId())
		}

		delete(s.graph.Nodes, graph.NodeId(id.GetId()))
		s.graph.Config.Nodes = slices.DeleteFunc(s.graph.Config.Nodes, func(nodeConfig *graph.NodeConfig) bool { return nodeConfig.GetId() == id.GetId() })

		err := s.graph.SaveCurrent(ctx)
		if err != nil {
			return err
		}

		return nil
	})
}
