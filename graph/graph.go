package graph

import (
	"fmt"
	"slices"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
)

type NodeId uint64

type Graph struct {
	Config *Config
	Nodes  map[NodeId]*Node
	mutex  sync.Mutex
}

func NewGraph(config *Config) *Graph {
	g := &Graph{
		Config: config,
		Nodes:  make(map[NodeId]*Node),
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
	graph.globalLock()
	defer graph.globalUnlock()

	result := []*NodeState{}
	for _, nodeConfig := range graph.Config.Nodes { // iterating over config for determined order
		node := graph.Nodes[NodeId(*nodeConfig.Id)]
		result = append(result, node.unsafe.getState())
	}
	return result
}

func (g *Graph) globalLock() {
	g.mutex.Lock()
	for _, node := range g.Nodes {
		node.mutex.Lock()
	}
}

func (g *Graph) globalUnlock() {
	for _, node := range g.Nodes {
		node.mutex.Unlock()
	}
	g.mutex.Unlock()
}

func (graph *Graph) TryRunAnyNode() (node *Node, isRunning bool, err error) {
	graph.globalLock()
	defer graph.globalUnlock()

	for _, node := range graph.Nodes {
		if node.unsafe.status == NodeStatus_Running {
			isRunning = true
		}

		if node.unsafe.status == NodeStatus_Idle && node.unsafe.isReady() {
			err := node.unsafe.startJob()
			if err != nil {
				return nil, false, err
			}

			go node.HandleJobResult()

			return node, true, nil
		}
	}
	return nil, isRunning, nil
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

func (graph *Graph) Connect(edge *EdgeConfig) ([]*NodeState, error) {
	graph.globalLock()
	defer graph.globalUnlock()

	from, to, err := graph.getEdgeNodes(edge, false)
	if err != nil {
		return nil, err
	}

	if from.unsafe.status != NodeStatus_Success && to.unsafe.status != NodeStatus_Idle {
		to.unsafe.reset()
	}

	to.Input = append(to.Input, NodeId(*edge.FromNodeId))
	from.Output = append(to.Output, NodeId(*edge.ToNodeId))
	graph.Config.Edges = append(graph.Config.Edges, edge)

	states, err := graph.collectTransitiveOutputs(NodeId(*edge.ToNodeId))
	if err != nil {
		return nil, err
	}

	return states, nil
}

func (graph *Graph) Disconnect(edge *EdgeConfig) ([]*NodeState, error) {
	graph.globalLock()
	defer graph.globalUnlock()

	from, to, err := graph.getEdgeNodes(edge, true)
	if err != nil {
		return nil, err
	}

	to.Input = slices.DeleteFunc(to.Input, func(id NodeId) bool { return id == NodeId(*edge.FromNodeId) })
	from.Output = slices.DeleteFunc(to.Output, func(id NodeId) bool { return id == NodeId(*edge.ToNodeId) })
	graph.Config.Edges = slices.DeleteFunc(graph.Config.Edges, isEdgeEqualsFunc(edge))

	return []*NodeState{from.unsafe.getState()}, nil
}

func (graph *Graph) collectTransitiveOutputs(nodeId NodeId) ([]*NodeState, error) {
	_, ok := graph.Nodes[nodeId]
	if !ok {
		return nil, fmt.Errorf("from node (id=%v) does not exist", nodeId)
	}

	nodeIds := []NodeId{}
	used := map[NodeId]bool{}
	queue := []NodeId{nodeId}
	for len(queue) > 0 {
		nodeId, queue = queue[0], queue[1:]
		if used[nodeId] {
			continue
		}
		used[nodeId] = true

		nodeIds = append(nodeIds, nodeId)

		queue = append(queue, graph.Nodes[nodeId].Output...)
	}

	result := []*NodeState{}
	for _, nodeId := range nodeIds {
		node := graph.Nodes[nodeId]
		result = append(result, node.unsafe.getState())
	}
	return result, nil
}
