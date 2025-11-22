package graph

import (
	"context"
	"fmt"
	"log"
	"pipegraph/internal/util"
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
	util.OnGrpcError = func(err error) {
		log.Println("Err: ", err.Error())
		g.ReportSync(&SyncResponse{
			Type:  SyncType_Error.Enum(),
			Error: map[string]string{"error": err.Error()},
		})
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
		return prototext.Format(edge) == prototext.Format(e)
	}
}

type edgeNodes struct {
	from   *Node
	to     *Node
	isFile bool
}

func (graph *Graph) getEdgeNodes(edge *EdgeConfig, existing bool) (*edgeNodes, error) {
	from, ok := graph.Nodes[NodeId(*edge.FromNodeId)]
	if !ok {
		return nil, fmt.Errorf("from node (id=%v) does not exist", *edge.FromNodeId)
	}

	to, ok := graph.Nodes[NodeId(*edge.ToNodeId)]
	if !ok {
		return nil, fmt.Errorf("to node (id=%v) does not exist", *edge.ToNodeId)
	}

	if slices.ContainsFunc(graph.Config.Edges, isEdgeEqualsFunc(edge)) != existing {
		var errorFormat string
		if existing {
			errorFormat = "edge {%v} does not exist"
		} else {
			errorFormat = "edge {%v} already exists"
		}
		return nil, fmt.Errorf(errorFormat, prototext.MarshalOptions{}.Format(edge))
	}

	if (edge.FromPort == nil) != (edge.ToPort == nil) {
		return nil, fmt.Errorf("invalid edge: source target type mismatch (file-node connection)")
	}

	return &edgeNodes{from, to, edge.FromPort != nil}, nil
}

func (graph *Graph) Connect(edge *EdgeConfig) error {
	edgeNodes, err := graph.getEdgeNodes(edge, false)
	if err != nil {
		return err
	}

	graph.Config.Edges = append(graph.Config.Edges, edge)
	edgeNodes.to.OnInputChange()
	return nil
}

func (graph *Graph) Disconnect(edge *EdgeConfig) error {
	edgeNodes, err := graph.getEdgeNodes(edge, true)
	if err != nil {
		return err
	}

	graph.Config.Edges = slices.DeleteFunc(graph.Config.Edges, isEdgeEqualsFunc(edge))
	edgeNodes.to.OnInputChange()
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
