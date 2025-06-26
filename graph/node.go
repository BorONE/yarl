package graph

import (
	"fmt"
	"log"
	"sync"
	"time"
)

type Node struct {
	Config *NodeConfig
	Output []NodeId
	Input  []NodeId
	graph  *Graph

	unsafe unsafeNode
	mutex  sync.Mutex
}

func NewNode(graph *Graph, config *NodeConfig) *Node {
	node := &Node{
		Config: config,
		graph:  graph,
	}
	node.unsafe.safe = node
	return node
}

func (node *Node) Run() error {
	err := node.unsafe.startJob()
	if err != nil {
		return err
	}

	node.HandleJobResult()
	return nil
}

func (node *Node) HandleJobResult() {
	node.unsafe.Err = <-node.unsafe.ErrChan

	node.mutex.Lock()
	defer node.mutex.Unlock()

	node.unsafe.endJob()
}

func (node *Node) Reset() error {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	return node.unsafe.reset()
}

func (node *Node) IsReady() bool {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	return node.unsafe.isReady()
}

func (node *Node) GetStatus() NodeStatus {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	if node.unsafe.status == NodeStatus_Stopped {
		return NodeStatus_Idle
	} else {
		return node.unsafe.status
	}
}

func (node *Node) GetState() *NodeState {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	return node.unsafe.getState()
}

func (node *Node) WaitRunEnd() (NodeStatus, error) {
	for {
		switch status := node.GetStatus(); status {
		case NodeStatus_Failed, NodeStatus_Success:
			return status, nil
		case NodeStatus_Stopped, NodeStatus_Running:
			// noop
			log.Println("status is", status.String())
		case NodeStatus_Idle:
			return status, fmt.Errorf("unexepected state: %s", status.String())
		default:
			log.Panicln("unexpected state: ", status.String())
		}

		time.Sleep(time.Second)
	}
}
