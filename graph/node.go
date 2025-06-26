package graph

import (
	"fmt"
	"log"
	"pipegraph/job"
	"sync"
	"time"
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

	return n.runWithoutLock()
}

func (n *Node) runWithoutLock() error {
	if !n.isReadyWithoutLock() {
		return fmt.Errorf("node is not ready")
	}

	switch n.state {
	case NodeStatus_Stopped:
		return nil
	case NodeStatus_Idle:
		// noop
	case NodeStatus_Running, NodeStatus_Success, NodeStatus_Failed:
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
		n.state = NodeStatus_Idle
	case NodeStatus_Running:
		if n.Err != nil {
			n.state = NodeStatus_Failed
		} else {
			n.state = NodeStatus_Success
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
	case NodeStatus_Success, NodeStatus_Failed:
		n.Err = nil
		n.Arts = nil
		n.state = NodeStatus_Idle
	case NodeStatus_Idle:
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
		if node.graph.Nodes[inputId].state != NodeStatus_Success {
			return false
		}
	}
	return true
}

func (node *Node) GetStatus() NodeStatus {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	return node.getStatusWithoutLock()
}

func (node *Node) getStatusWithoutLock() NodeStatus {
	switch node.state {
	case NodeStatus_Stopped:
		return NodeStatus_Idle
	default:
		return node.state
	}
}

func asPtr[T any](x T) *T {
	p := new(T)
	*p = x
	return p
}

func (node *Node) GetState() *NodeState {
	node.mutex.Lock()
	defer node.mutex.Unlock()

	return node.GetStateWithoutLock()
}

func (node *Node) GetStateWithoutLock() *NodeState {
	return &NodeState{
		Id:      node.Config.Id,
		Status:  node.getStatusWithoutLock().Enum(),
		IsReady: asPtr(node.isReadyWithoutLock()),
	}
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
