package graph

import (
	"sync"
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
