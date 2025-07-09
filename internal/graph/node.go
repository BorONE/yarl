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

	Job     job.Job
	ErrChan chan error
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
	err := node.startJob()
	if err != nil {
		return err
	}

	go func() {
		jobError := <-node.ErrChan
		endGuard.Lock()
		node.endJob(jobError)
		endGuard.Unlock()
	}()
	return nil
}

func (node *Node) startJob() error {
	if !node.IsReady() {
		return fmt.Errorf("node is not ready")
	}

	switch node.state.(type) {
	case *NodeState_Idle:
		// noop
	case *NodeState_InProgress, *NodeState_Done:
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	default:
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	var err error
	node.Job, err = job.Create(node.Config.Job)
	if err != nil {
		return err
	}

	node.ErrChan = make(chan error)
	log.Printf("job(id=%v) is starting...", node.Config.GetId())
	go func() { node.ErrChan <- node.Job.Run() }()
	node.state = &NodeState_InProgress{InProgress: &NodeState_InProgressState{Status: NodeState_InProgressState_Running.Enum()}}
	return nil
}

func (node *Node) endJob(jobError error) {
	arts, err := node.Job.CollectArtifacts()
	if err != nil {
		log.Printf("failed to get arts of node(id=%v): %v", node.Config.Id, err)
	}
	log.Printf("job(id=%v) finished: err=%v artifacts=%v", node.Config.GetId(), jobError, arts)

	node.Job = nil

	state, ok := node.state.(*NodeState_InProgress)
	if !ok {
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	switch *state.InProgress.Status {
	case NodeState_InProgressState_Stopped:
		for _, listener := range node.EndListeners {
			listener()
		}
		node.EndListeners = nil

		node.SetState(&NodeState_IdleState{})
	case NodeState_InProgressState_Running:
		targetState := &NodeState_DoneState{}
		if jobError != nil {
			errString := jobError.Error()
			targetState.Error = &errString
		}
		targetState.Arts = map[string]string{}
		for key, value := range arts {
			targetState.Arts[key] = fmt.Sprint(value)
		}
		node.SetState(targetState)

		for _, listener := range node.EndListeners {
			listener()
		}
		node.EndListeners = nil
	default:
		log.Panicln("unexpected state: ", node.GetStateString())
	}
}

func (node *Node) Reset() error {
	defer func() {
		node.graph.Updates = append(node.graph.Updates, node.GetState())
	}()

	switch node.state.(type) {
	case *NodeState_Idle:
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	case *NodeState_InProgress:
		node.stop()
	case *NodeState_Done:
		node.reset()
	default:
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	for _, output := range node.Output {
		node.graph.Nodes[output].Reset()
	}

	return nil
}

func (node *Node) reset() {
	_, ok := node.state.(*NodeState_Done)
	if !ok {
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	node.SetState(&NodeState_IdleState{})
}

func (node *Node) stop() {
	state, ok := node.state.(*NodeState_InProgress)
	if !ok {
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	switch *state.InProgress.Status {
	case NodeState_InProgressState_Stopped:
		return
	case NodeState_InProgressState_Running:
		state.InProgress.Status = NodeState_InProgressState_Stopped.Enum()
		node.Job.Reset()
	default:
		log.Panicln("unexpected state: ", node.GetStateString())
	}
}

func (node *Node) IsReady() bool {
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
		isReady := node.IsReady()
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
