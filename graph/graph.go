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
		g.Nodes[NodeId(*nodeConfig.Id)] = &Node{
			Config: nodeConfig,
			graph:  g,
		}
	}
	for _, edgeConfig := range config.Edges {
		from, to := g.Nodes[NodeId(*edgeConfig.FromNodeId)], g.Nodes[NodeId(*edgeConfig.ToNodeId)]
		from.Output = append(from.Output, NodeId(edgeConfig.GetToNodeId()))
		to.Input = append(to.Input, NodeId(edgeConfig.GetFromNodeId()))
	}
	return g
}

func (g *Graph) Run() {
	wg := &sync.WaitGroup{}
	for _, node := range g.Nodes {
		g.tryRunRecursively(node, wg)
	}
	wg.Wait()
}

func (g *Graph) tryRunRecursively(node *Node, wg *sync.WaitGroup) {
	if !node.IsReady() {
		return
	}

	wg.Add(1)
	go func() {
		defer wg.Done()

		node.Run()

		for _, outputId := range node.Output {
			g.tryRunRecursively(g.Nodes[outputId], wg)
		}
	}()
}

func (g *Graph) GlobalLock() {
	g.mutex.Lock()
	for _, node := range g.Nodes {
		node.mutex.Lock()
	}
}

func (g *Graph) GlobalUnlock() {
	for _, node := range g.Nodes {
		node.mutex.Unlock()
	}
	g.mutex.Unlock()
}

func (graph *Graph) TryRunAnyNode() (node *Node, isRunning bool, err error) {
	graph.GlobalLock()
	defer graph.GlobalUnlock()

	for _, node := range graph.Nodes {
		if node.getStatusWithoutLock() == NodeStatus_Running {
			isRunning = true
		}

		if node.getStatusWithoutLock() == NodeStatus_Idle && node.isReadyWithoutLock() {
			err := graph.Nodes[NodeId(*node.Config.Id)].runWithoutLock()
			if err != nil {
				return nil, false, err
			}
			return node, true, nil
		}
	}
	return nil, isRunning, nil
}
