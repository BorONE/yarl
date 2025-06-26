package graph

import (
	"fmt"
	"log"
	job "pipegraph/job"
)

type unsafeNode struct {
	safe *Node

	status NodeStatus

	Job     job.Job
	ErrChan chan error
	Err     error
	Arts    job.Artifacts
}

func (node *unsafeNode) startJob() error {
	if !node.isReady() {
		return fmt.Errorf("node is not ready")
	}

	switch node.status {
	case NodeStatus_Stopped:
		return nil
	case NodeStatus_Idle:
		// noop
	case NodeStatus_Running, NodeStatus_Success, NodeStatus_Failed:
		return fmt.Errorf("invalid operation for node with state %s", node.status.String())
	default:
		log.Panicln("unexpected state: ", node.status.String())
	}

	var err error
	node.Job, err = job.CreateJob(node.safe.Config.Job)
	if err != nil {
		return err
	}

	node.ErrChan = make(chan error)
	log.Printf("job(id=%v) is starting...", node.safe.Config.GetId())
	go func() { node.ErrChan <- node.Job.Run() }()
	node.status = NodeStatus_Running
	return nil
}

func (node *unsafeNode) endJob() {
	var err error
	node.Arts, err = node.Job.CollectArtifacts()
	if err != nil {
		log.Printf("failed to get arts of node(id=%v): %v", node.safe.Config.Id, err)
	}
	log.Printf("job(id=%v) finished: err=%v artifacts=%v", node.safe.Config.GetId(), node.Err, node.Arts)

	node.Job = nil

	switch node.status {
	case NodeStatus_Stopped:
		node.Err = nil
		node.Arts = nil
		node.status = NodeStatus_Idle
	case NodeStatus_Running:
		if node.Err != nil {
			node.status = NodeStatus_Failed
		} else {
			node.status = NodeStatus_Success
		}
	default:
		log.Panicln("unexpected state: ", node.status.String())
	}
}

func (node *unsafeNode) reset() error {
	switch node.status {
	case NodeStatus_Stopped:
		return nil
	case NodeStatus_Running:
		node.status = NodeStatus_Stopped
		node.Job.Reset()
	case NodeStatus_Success, NodeStatus_Failed:
		node.Err = nil
		node.Arts = nil
		node.status = NodeStatus_Idle
	case NodeStatus_Idle:
		return fmt.Errorf("invalid operation for node with state %s", node.status.String())
	default:
		log.Panicln("unexpected state: ", node.status.String())
	}

	for _, output := range node.safe.Output {
		node.safe.graph.Nodes[output].Reset()
	}

	return nil
}

func (node *unsafeNode) isReady() bool {
	for _, inputId := range node.safe.Input {
		if node.safe.graph.Nodes[inputId].unsafe.status != NodeStatus_Success {
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

func (node *unsafeNode) getState() *NodeState {
	return &NodeState{
		Id:      node.safe.Config.Id,
		Status:  node.status.Enum(),
		IsReady: asPtr(node.isReady()),
	}
}
