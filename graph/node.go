package graph

import (
	"fmt"
	"log"
	"pipegraph/config"
	"pipegraph/job"
	"sync"
)

type NodeInternalState int32

const (
	NodeInternalState_Waiting NodeInternalState = iota
	NodeInternalState_Running
	NodeInternalState_Finished
	NodeInternalState_Failed
	NodeInternalState_Stopped
)

func (s NodeInternalState) String() string {
	switch s {
	case NodeInternalState_Waiting:
		return "Waiting"
	case NodeInternalState_Running:
		return "Running"
	case NodeInternalState_Finished:
		return "Finished"
	case NodeInternalState_Failed:
		return "Failed"
	case NodeInternalState_Stopped:
		return "Stopped"
	default:
		log.Panicln("unknown state")
	}
	return ""
}

type Node struct {
	Config *config.Node
	state  NodeInternalState
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

	switch n.state {
	case NodeInternalState_Stopped:
		return nil
	case NodeInternalState_Waiting:
		// noop
	case NodeInternalState_Running, NodeInternalState_Finished, NodeInternalState_Failed:
		return fmt.Errorf("invalid operation for node with state %s", n.state.String())
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	errChan := make(chan error)
	n.Job = job
	go func() { errChan <- job.Run() }()
	n.state = NodeInternalState_Running

	n.mutex.Unlock()
	n.Err = <-errChan
	n.mutex.Lock()
	n.Job = nil

	if n.state == NodeInternalState_Stopped {
		n.state = NodeInternalState_Waiting
		return nil
	}

	if n.Err != nil {
		n.state = NodeInternalState_Failed
	} else {
		n.state = NodeInternalState_Finished
	}
	return nil
}

func (n *Node) Reset() error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	switch n.state {
	case NodeInternalState_Stopped:
		return nil
	case NodeInternalState_Running, NodeInternalState_Finished, NodeInternalState_Failed:
		// noop
	case NodeInternalState_Waiting:
		return fmt.Errorf("invalid operation for node with state %s", n.state.String())
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	if n.Job != nil {
		n.Job.Stop()
	}

	n.state = NodeInternalState_Stopped
	return nil
}

func (node *Node) isReady() bool {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	for _, inputId := range node.input {
		if node.graph.nodes[inputId].state != NodeInternalState_Finished {
			return false
		}
	}
	return true
}
