package graph

import (
	"sync"
)

type NodeId uint64

type Graph struct {
	Config *Config
	Nodes  map[NodeId]*Node
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
