package graph

import (
	"fmt"
	"log"
	"pipegraph/job"
	"sync"
)

type Node struct {
	Config *NodeConfig
	Output []NodeId
	Input  []NodeId
	graph  *Graph

	Status NodeStatus

	EndListeners []func()

	Job     job.Job
	ErrChan chan error
	Err     error
	Arts    job.Artifacts
}

func NewNode(graph *Graph, config *NodeConfig) *Node {
	return &Node{
		Config: config,
		graph:  graph,
	}
}

func (node *Node) Run(endGuard *sync.Mutex) error {
	err := node.startJob()
	if err != nil {
		return err
	}

	go func() {
		node.Err = <-node.ErrChan
		endGuard.Lock()
		node.endJob()
		endGuard.Unlock()
	}()
	return nil
}

func (node *Node) startJob() error {
	if !node.IsReady() {
		return fmt.Errorf("node is not ready")
	}

	switch node.Status {
	case NodeStatus_Idle:
		// noop
	case NodeStatus_Running, NodeStatus_Success, NodeStatus_Failed, NodeStatus_Stopped:
		return fmt.Errorf("invalid operation for node with state %s", node.Status.String())
	default:
		log.Panicln("unexpected state: ", node.Status.String())
	}

	var err error
	node.Job, err = job.CreateJob(node.Config.Job)
	if err != nil {
		return err
	}

	node.ErrChan = make(chan error)
	log.Printf("job(id=%v) is starting...", node.Config.GetId())
	go func() { node.ErrChan <- node.Job.Run() }()
	node.Status = NodeStatus_Running
	return nil
}

func (node *Node) endJob() {
	var err error
	node.Arts, err = node.Job.CollectArtifacts()
	if err != nil {
		log.Printf("failed to get arts of node(id=%v): %v", node.Config.Id, err)
	}
	log.Printf("job(id=%v) finished: err=%v artifacts=%v", node.Config.GetId(), node.Err, node.Arts)

	node.Job = nil

	switch node.Status {
	case NodeStatus_Stopped:
		for _, listener := range node.EndListeners {
			listener()
		}
		node.EndListeners = nil

		node.Err = nil
		node.Arts = nil
		node.Status = NodeStatus_Idle
	case NodeStatus_Running:
		if node.Err != nil {
			node.Status = NodeStatus_Failed
		} else {
			node.Status = NodeStatus_Success
		}

		for _, listener := range node.EndListeners {
			listener()
		}
		node.EndListeners = nil
	default:
		log.Panicln("unexpected state: ", node.Status.String())
	}
}

func (node *Node) Reset() error {
	switch node.Status {
	case NodeStatus_Stopped:
		return nil
	case NodeStatus_Running:
		node.Status = NodeStatus_Stopped
		node.Job.Reset()
		node.graph.Updates = append(node.graph.Updates, node.GetState())
	case NodeStatus_Success, NodeStatus_Failed:
		node.Err = nil
		node.Arts = nil
		node.Status = NodeStatus_Idle
		node.graph.Updates = append(node.graph.Updates, node.GetState())
	case NodeStatus_Idle:
		node.graph.Updates = append(node.graph.Updates, node.GetState())
		return fmt.Errorf("invalid operation for node with state %s", node.Status.String())
	default:
		log.Panicln("unexpected state: ", node.Status.String())
	}

	for _, output := range node.Output {
		node.graph.Nodes[output].Reset()
	}

	return nil
}

func (node *Node) IsReady() bool {
	for _, inputId := range node.Input {
		if node.graph.Nodes[inputId].Status != NodeStatus_Success {
			return false
		}
	}
	return true
}

func asPtr[T any](x T) *T {
	p := new(T)
	*p = x
	return p
}

func (node *Node) GetState() *NodeState {
	return &NodeState{
		Id:      node.Config.Id,
		Status:  node.Status.Enum(),
		IsReady: asPtr(node.IsReady()),
	}
}
