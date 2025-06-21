package graph

import (
	"fmt"
	"log"
	"pipegraph/job"
	"sync"
)

type Node struct {
	Config *NodeConfig
	state  NodeState
	output []NodeId
	input  []NodeId

	Job  job.Job
	Err  error
	Arts job.Artifacts

	mutex sync.Mutex
	graph *Graph
}

func (n *Node) Run() error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	if !n.isReadyWithoutLock() {
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

	var err error
	n.Job, err = job.CreateJob(n.Config.Job)

	errChan := make(chan error)
	log.Printf("job(id=%v) is starting...", n.Config.GetId())
	go func() { errChan <- n.Job.Run() }()
	n.state = NodeState_Running

	n.mutex.Unlock()
	n.Err = <-errChan
	n.mutex.Lock()

	n.Arts, err = n.Job.CollectArtifacts()
	if err != nil {
		log.Printf("failed to get arts of node(id=%v): %v", n.Config.Id, err)
	}
	log.Printf("job(id=%v) finished: err=%v artifacts=%v", n.Config.GetId(), n.Err, n.Arts)

	n.Job = nil

	switch n.state {
	case NodeState_Stopped:
		n.Err = nil
		n.Arts = nil
		n.state = NodeState_Waiting
	case NodeState_Running:
		if n.Err != nil {
			n.state = NodeState_Failed
		} else {
			n.state = NodeState_Finished
		}
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	return nil
}

func (n *Node) Reset() error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	switch n.state {
	case NodeState_Stopped:
		return nil
	case NodeState_Running:
		n.state = NodeState_Stopped
		n.Job.Reset()
	case NodeState_Finished, NodeState_Failed:
		n.Err = nil
		n.Arts = nil
		n.state = NodeState_Waiting
	case NodeState_Waiting:
		return fmt.Errorf("invalid operation for node with state %s", n.state.String())
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	for _, output := range n.output {
		n.graph.Nodes[output].Reset()
	}

	return nil
}

func (node *Node) isReady() bool {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	return node.isReadyWithoutLock()
}

func (node *Node) isReadyWithoutLock() bool {
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
