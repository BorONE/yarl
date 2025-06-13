package graph

import (
	"fmt"
	"log"
	"pipegraph/config"
	"pipegraph/job"
	"sync"
)

type Node struct {
	Config *config.Node
	state  NodeState
	output []NodeId
	input  []NodeId

	Job job.Job
	Err error

	mutex sync.Mutex
	graph *Graph
}

func (n *Node) Run(job job.Job) error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	if !n.isReady() {
		return fmt.Errorf("node is not ready")
	}

	switch n.state {
	case NodeState_Stopped:
		return nil
	case NodeState_Waiting:
		// noop
	case NodeState_Running, NodeState_Finished, NodeState_Failed:
		return fmt.Errorf("invalid operation for node with state %s", n.state.String())
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	errChan := make(chan error)
	n.Job = job
	go func() { errChan <- job.Run() }()
	n.state = NodeState_Running

	n.mutex.Unlock()
	n.Err = <-errChan
	n.mutex.Lock()
	n.Job = nil

	if n.state == NodeState_Stopped {
		n.state = NodeState_Waiting
		return nil
	}

	if n.Err != nil {
		n.state = NodeState_Failed
	} else {
		n.state = NodeState_Finished
	}
	return nil
}

func (n *Node) Reset() error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	switch n.state {
	case NodeState_Stopped:
		return nil
	case NodeState_Running, NodeState_Finished, NodeState_Failed:
		// noop
	case NodeState_Waiting:
		return fmt.Errorf("invalid operation for node with state %s", n.state.String())
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	if n.Job != nil {
		n.Job.Stop()
	}

	n.state = NodeState_Stopped
	return nil
}

func (node *Node) isReady() bool {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	for _, inputId := range node.input {
		if node.graph.Nodes[inputId].state != NodeState_Finished {
			return false
		}
	}
	return true
}

func (node *Node) GetState() NodeState {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	switch node.state {
	case NodeState_Stopped:
		return NodeState_Waiting
	default:
		return node.state
	}
}
