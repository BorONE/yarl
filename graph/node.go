package graph

import (
	"fmt"
	"log"
	"pipegraph/job"
	"sync"
)

type Node struct {
	Config *NodeConfig
	state  NodeStatus
	Output []NodeId
	Input  []NodeId

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
	case NodeStatus_Stopped:
		return nil
	case NodeStatus_Waiting:
		// noop
	case NodeStatus_Running, NodeStatus_Finished, NodeStatus_Failed:
		return fmt.Errorf("invalid operation for node with state %s", n.state.String())
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	var err error
	n.Job, err = job.CreateJob(n.Config.Job)

	errChan := make(chan error)
	log.Printf("job(id=%v) is starting...", n.Config.GetId())
	go func() { errChan <- n.Job.Run() }()
	n.state = NodeStatus_Running

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
	case NodeStatus_Stopped:
		n.Err = nil
		n.Arts = nil
		n.state = NodeStatus_Waiting
	case NodeStatus_Running:
		if n.Err != nil {
			n.state = NodeStatus_Failed
		} else {
			n.state = NodeStatus_Finished
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
	case NodeStatus_Stopped:
		return nil
	case NodeStatus_Running:
		n.state = NodeStatus_Stopped
		n.Job.Reset()
	case NodeStatus_Finished, NodeStatus_Failed:
		n.Err = nil
		n.Arts = nil
		n.state = NodeStatus_Waiting
	case NodeStatus_Waiting:
		return fmt.Errorf("invalid operation for node with state %s", n.state.String())
	default:
		log.Panicln("unexpected state: ", n.state.String())
	}

	for _, output := range n.Output {
		n.graph.Nodes[output].Reset()
	}

	return nil
}

func (node *Node) IsReady() bool {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	return node.isReadyWithoutLock()
}

func (node *Node) isReadyWithoutLock() bool {
	for _, inputId := range node.Input {
		if node.graph.Nodes[inputId].state != NodeStatus_Finished {
			return false
		}
	}
	return true
}

func (node *Node) GetStatus() NodeStatus {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	switch node.state {
	case NodeStatus_Stopped:
		return NodeStatus_Waiting
	default:
		return node.state
	}
}
