package graph

import (
	"fmt"
	"log"
	"pipegraph/internal/job"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
	"google.golang.org/protobuf/proto"
)

type Node struct {
	Config *NodeConfig
	Output []NodeId
	Input  []NodeId
	graph  *Graph

	state isNodeState_State

	EndListeners []func()

	Job job.Job
}

func NewNode(graph *Graph, config *NodeConfig) *Node {
	node := &Node{
		Config: config,
		graph:  graph,
	}
	node.SetState(&NodeState_IdleState{})
	return node
}

func (node *Node) Run(endGuard *sync.Mutex) error {
	state, ok := node.GetState().State.(*NodeState_Idle)
	if !ok {
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	}

	if !state.Idle.GetIsReady() {
		return fmt.Errorf("node is not ready")
	}

	createdJob, err := job.Create(node.Config.Job)
	if err != nil {
		return fmt.Errorf("job creation failed: %s", err.Error())
	}

	log.Printf("job(id=%v) is starting...", node.Config.GetId())
	node.SetState(&NodeState_InProgressState{Status: NodeState_InProgressState_Running.Enum()})
	node.Job = createdJob

	go func() {
		jobErr := node.Job.Run()

		endGuard.Lock()
		defer endGuard.Unlock()

		log.Printf("job(id=%v) finished", node.Config.GetId())

		state := node.state.(*NodeState_InProgress)
		node.SetState(&NodeState_DoneState{
			Error:     asStringPtr(jobErr),
			Arts:      node.Job.CollectArtifacts(),
			IsStopped: *state.InProgress.Status == NodeState_InProgressState_Stopping,
		})

		for _, listener := range node.EndListeners {
			listener()
		}
		node.EndListeners = nil

		node.Job = nil
	}()
	return nil
}

func asStringPtr(err error) *string {
	if err == nil {
		return nil
	}
	str := err.Error()
	return &str
}

func (node *Node) Reset() error {
	defer func() {
		node.graph.Updates = append(node.graph.Updates, node.GetState())
	}()

	switch state := node.state.(type) {
	case *NodeState_Idle:
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	case *NodeState_InProgress:
		switch *state.InProgress.Status {
		case NodeState_InProgressState_Stopping:
			return nil
		case NodeState_InProgressState_Running:
			state.InProgress.Status = NodeState_InProgressState_Stopping.Enum()
			node.Job.Reset()
		default:
			log.Panicln("unexpected state: ", node.GetStateString())
		}
	case *NodeState_Done:
		node.SetState(&NodeState_IdleState{})
	default:
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	for _, output := range node.Output {
		node.graph.Nodes[output].Reset()
	}

	return nil
}

func (node *Node) isReady() bool {
	for _, inputId := range node.Input {
		input := node.graph.Nodes[inputId]
		if state, ok := input.state.(*NodeState_Done); !ok || state.Done.Error != nil {
			return false
		}
	}
	return true
}

func (node *Node) GetState() *NodeState {
	switch state := node.state.(type) {
	case *NodeState_Idle:
		isReady := node.isReady()
		state.Idle.IsReady = &isReady
	}

	return &NodeState{
		Id:    node.Config.Id,
		State: node.state,
	}
}

func (node *Node) GetStateString() string {
	return prototext.MarshalOptions{}.Format(node.GetState())
}

func (node *Node) SetState(message proto.Message) {
	switch state := message.(type) {
	case *NodeState_IdleState:
		node.state = &NodeState_Idle{state}
	case *NodeState_InProgressState:
		node.state = &NodeState_InProgress{state}
	case *NodeState_DoneState:
		node.state = &NodeState_Done{state}
	default:
		log.Panicln("invalid state: ", prototext.MarshalOptions{}.Format(message))
	}
}
