package graph

import (
	"context"
	"fmt"
	"slices"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
)

type NodeId uint64

type SyncListenerId uint64

type Graph struct {
	Config *Config
	Nodes  map[NodeId]*Node

	syncListeners map[SyncListenerId]chan<- *SyncResponse
	syncMutex     sync.Mutex

	nextNodeId NodeId

	ctx context.Context
}

func NewGraph(config *Config, ctx context.Context) *Graph {
	g := &Graph{
		Config:        config,
		Nodes:         make(map[NodeId]*Node),
		syncListeners: make(map[SyncListenerId]chan<- *SyncResponse),
		ctx:           ctx,
	}
	for _, nodeConfig := range config.Nodes {
		g.Nodes[NodeId(*nodeConfig.Id)] = NewNode(g, nodeConfig)
	}
	for _, edgeConfig := range config.Edges {
		from, to := g.Nodes[NodeId(*edgeConfig.FromNodeId)], g.Nodes[NodeId(*edgeConfig.ToNodeId)]
		from.Output = append(from.Output, NodeId(edgeConfig.GetToNodeId()))
		to.Input = append(to.Input, NodeId(edgeConfig.GetFromNodeId()))
	}
	return g
}

func (graph *Graph) CollectNodeStates() []*NodeState {
	result := []*NodeState{}
	for _, nodeConfig := range graph.Config.Nodes { // iterating over config for determined order
		node := graph.Nodes[NodeId(*nodeConfig.Id)]
		result = append(result, node.GetState())
	}
	return result
}

func isEdgeEqualsFunc(edge *EdgeConfig) func(e *EdgeConfig) bool {
	return func(e *EdgeConfig) bool {
		return *e.FromNodeId == *edge.FromNodeId && *e.ToNodeId == *edge.ToNodeId
	}
}

func (graph *Graph) getEdgeNodes(edge *EdgeConfig, existing bool) (*Node, *Node, error) {
	from, ok := graph.Nodes[NodeId(*edge.FromNodeId)]
	if !ok {
		return nil, nil, fmt.Errorf("from node (id=%v) does not exist", *edge.FromNodeId)
	}

	to, ok := graph.Nodes[NodeId(*edge.ToNodeId)]
	if !ok {
		return nil, nil, fmt.Errorf("to node (id=%v) does not exist", *edge.ToNodeId)
	}

	if slices.ContainsFunc(graph.Config.Edges, isEdgeEqualsFunc(edge)) != existing {
		var errorFormat string
		if existing {
			errorFormat = "edge {%v} does not exist"
		} else {
			errorFormat = "edge {%v} already exists"
		}
		return nil, nil, fmt.Errorf(errorFormat, prototext.MarshalOptions{}.Format(edge))
	}

	return from, to, nil
}

func (graph *Graph) Connect(edge *EdgeConfig) error {
	from, to, err := graph.getEdgeNodes(edge, false)
	if err != nil {
		return err
	}

	to.Input = append(to.Input, NodeId(*edge.FromNodeId))
	from.Output = append(from.Output, NodeId(*edge.ToNodeId))
	graph.Config.Edges = append(graph.Config.Edges, edge)

	to.OnInputChange()

	return nil
}

func (graph *Graph) Disconnect(edge *EdgeConfig) error {
	from, to, err := graph.getEdgeNodes(edge, true)
	if err != nil {
		return err
	}

	to.Input = slices.DeleteFunc(to.Input, func(id NodeId) bool { return id == NodeId(*edge.FromNodeId) })
	from.Output = slices.DeleteFunc(from.Output, func(id NodeId) bool { return id == NodeId(*edge.ToNodeId) })
	graph.Config.Edges = slices.DeleteFunc(graph.Config.Edges, isEdgeEqualsFunc(edge))

	to.OnInputChange()

	return nil
}

func (graph *Graph) getFreeNodeId() NodeId {
	graph.nextNodeId += 1 // start with 1
	for graph.Nodes[graph.nextNodeId] != nil {
		graph.nextNodeId += 1
	}
	return graph.nextNodeId
}

func (graph *Graph) AddNewNode(nodeConfig *NodeConfig) NodeId {
	nodeId := graph.getFreeNodeId()
	id := uint64(nodeId)
	nodeConfig.Id = &id
	graph.Config.Nodes = append(graph.Config.Nodes, nodeConfig)
	graph.Nodes[nodeId] = NewNode(graph, nodeConfig)
	return nodeId
}

var lastSyncListenerId SyncListenerId

type SyncListenerDone func()

func (graph *Graph) NewSyncListener() (<-chan *SyncResponse, SyncListenerDone) {
	graph.syncMutex.Lock()
	defer graph.syncMutex.Unlock()

	listener := make(chan *SyncResponse)
	lastSyncListenerId += 1
	localSyncListenerId := lastSyncListenerId
	graph.syncListeners[localSyncListenerId] = listener

	return listener, func() {
		graph.syncMutex.Lock()
		defer graph.syncMutex.Unlock()

		delete(graph.syncListeners, localSyncListenerId)
		close(listener)
	}
}

func (graph *Graph) ReportSync(update *SyncResponse) {
	graph.syncMutex.Lock()
	defer graph.syncMutex.Unlock()

	for _, updates := range graph.syncListeners {
		updates <- update
	}
}
