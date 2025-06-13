package graph

import (
	"log"
	"pipegraph/config"
	"pipegraph/job"
	"sync"
)

type NodeId uint64

type Graph struct {
	nodes map[NodeId]*Node
}

func NewGraph(config *config.Graph) *Graph {
	g := &Graph{
		nodes: make(map[NodeId]*Node),
		// readyQueue: make(chan NodeId),
	}
	for _, nodeConfig := range config.Nodes {
		g.nodes[NodeId(*nodeConfig.Id)] = &Node{
			Config: nodeConfig,
			graph:  g,
		}
	}
	for _, edgeConfig := range config.Edges {
		from, to := g.nodes[NodeId(*edgeConfig.FromNodeId)], g.nodes[NodeId(*edgeConfig.ToNodeId)]
		from.output = append(from.output, NodeId(edgeConfig.GetToNodeId()))
		to.input = append(to.input, NodeId(edgeConfig.GetFromNodeId()))
	}
	return g
}

func (g *Graph) GetNode(id NodeId) *Node {
	return g.nodes[id]
}
func (g *Graph) Run() {
	wg := &sync.WaitGroup{}
	for _, node := range g.nodes {
		g.tryRunRecursively(node, wg)
	}
	wg.Wait()
}

func (g *Graph) tryRunRecursively(node *Node, wg *sync.WaitGroup) {
	if !node.isReady() {
		return
	}

	wg.Add(1)
	go func() {
		defer wg.Done()

		log.Println("running job:\n", node.Config.Job)
		node.Run(job.CreateJob(node.Config.Job))

		for _, outputId := range node.output {
			g.tryRunRecursively(g.nodes[outputId], wg)
		}
	}()
}
