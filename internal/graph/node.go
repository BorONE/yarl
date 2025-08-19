package graph

import (
	"fmt"
	"log"
	"pipegraph/internal/job"
	"pipegraph/internal/util"
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

	DoneEvent util.Event

	Job job.Job
}

var EndGuard *sync.Mutex

func NewNode(graph *Graph, config *NodeConfig) *Node {
	node := &Node{
		Config: config,
		graph:  graph,
	}
	node.SetState(&NodeState_IdleState{})
	return node
}

func (node *Node) Run() error {
	if state, isIdle := node.GetState().State.(*NodeState_Idle); !isIdle || !state.Idle.GetIsReady() {
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
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

		EndGuard.Lock()
		defer EndGuard.Unlock()

		log.Printf("job(id=%v) finished", node.Config.GetId())
		log.Printf("job(id=%v) finished %v", node.Config.GetId(), jobErr)

		state := node.state.(*NodeState_InProgress)
		isStopped := *state.InProgress.Status == NodeState_InProgressState_Stopping
		isSkipped := *state.InProgress.Status == NodeState_InProgressState_Skipping
		node.SetState(&NodeState_DoneState{
			Error:     asStringPtr(jobErr),
			IsStopped: &isStopped,
			IsSkipped: &isSkipped,
		})

		for _, outputId := range node.Output {
			output := node.graph.Nodes[outputId]
			output.OnInputChange()
		}

		node.DoneEvent.Trigger()
	}()
	return nil
}

func (node *Node) Plan(plan NodeState_IdleState_IdlePlan) error {
	state, isIdle := node.state.(*NodeState_Idle)
	if !isIdle || state.Idle.GetIsReady() {
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	}

	if state.Idle.GetPlan() == plan {
		return nil
	}

	state.Idle.Plan = &plan
	node.ReportUpdate()

	return nil
}

func (node *Node) Done() error {
	_, isIdle := node.state.(*NodeState_Idle)
	if !isIdle {
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	}

	isStopped := false
	isSkipped := true
	fromIdle := true
	node.SetState(&NodeState_DoneState{
		Error:     nil,
		IsStopped: &isStopped,
		IsSkipped: &isSkipped,
		FromIdle:  &fromIdle,
	})

	for _, outputId := range node.Output {
		output := node.graph.Nodes[outputId]
		output.OnInputChange()
	}

	node.DoneEvent.Trigger()
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
	_, isDone := node.state.(*NodeState_Done)
	if !isDone {
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	}

	node.SetState(&NodeState_IdleState{})
	node.Job = nil

	for _, outputId := range node.Output {
		output := node.graph.Nodes[outputId]
		switch output.state.(type) {
		case *NodeState_Idle:
			output.OnInputChange()
		case *NodeState_InProgress:
			output.Stop()
			output.DoneEvent.OnTrigger(func() { output.Reset() })
		case *NodeState_Done:
			output.Reset()
		default:
			log.Panicln("unexpected state: ", node.GetStateString())
		}
	}

	return nil
}

func (node *Node) Stop() error {
	state, isInProgress := node.state.(*NodeState_InProgress)
	if !isInProgress {
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	}

	switch *state.InProgress.Status {
	case NodeState_InProgressState_Stopping:
		// already stopping
	case NodeState_InProgressState_Running, NodeState_InProgressState_Skipping:
		state.InProgress.Status = NodeState_InProgressState_Stopping.Enum()
		node.Job.Kill()
	default:
		log.Panicln("unexpected state: ", node.GetStateString())
	}

	return nil
}

func (node *Node) Skip() error {
	state, isInProgress := node.state.(*NodeState_InProgress)
	if !isInProgress {
		return fmt.Errorf("invalid operation for node with state %s", node.GetStateString())
	}

	state.InProgress.Status = NodeState_InProgressState_Skipping.Enum()
	node.ReportUpdate()

	for _, outputId := range node.Output {
		output := node.graph.Nodes[outputId]
		output.OnInputChange()
	}

	return nil
}

func (node *Node) OnInputChange() {
	node.ReportUpdate()
	if state, isIdle := node.state.(*NodeState_Idle); isIdle && state.Idle.GetIsReady() {
		switch state.Idle.GetPlan() {
		case NodeState_IdleState_None:

		case NodeState_IdleState_Scheduled:
			err := node.Run()
			if err != nil {
				// TODO
			}

		case NodeState_IdleState_Skipped:
			err := node.Done()
			if err != nil {
				// TODO
			}
		}
	}
}

func (node *Node) isReady() bool {
	for _, inputId := range node.Input {
		input := node.graph.Nodes[inputId]
		stillReady := false
		switch state := input.state.(type) {
		case *NodeState_InProgress:
			stillReady = state.InProgress.GetStatus() == NodeState_InProgressState_Skipping
		case *NodeState_Done:
			stillReady = state.Done.Error == nil || state.Done.GetIsSkipped()
		}
		if !stillReady {
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

func (node *Node) ReportUpdate() {
	state := node.GetState()
	sync := &SyncResponse{Type: SyncType_UpdateState.Enum(), NodeState: proto.CloneOf(state)}
	node.graph.ReportSync(sync)
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
	node.ReportUpdate()
}
