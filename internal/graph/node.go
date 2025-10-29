package graph

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"pipegraph/internal/job"
	"pipegraph/internal/util"
	"strings"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
	"google.golang.org/protobuf/proto"
)

type Node struct {
	Config *NodeConfig
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
		state:  &NodeState_Idle{Idle: &NodeState_IdleState{}},
	}
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

	ctx, err := node.prepareRunContext()
	if err != nil {
		return fmt.Errorf("job context preparation failed: %v", err)
	}

	log.Printf("job(id=%v) is starting...", node.Config.GetId())
	node.SetState(&NodeState_InProgressState{Status: NodeState_InProgressState_Running.Enum()})
	node.Job = createdJob

	go func() {
		err = node.Job.Run(ctx)

		EndGuard.Lock()
		defer EndGuard.Unlock()

		log.Printf("job(id=%v) finished (err=\"%v\")", node.Config.GetId(), err)

		state := node.state.(*NodeState_InProgress)
		isStopped := *state.InProgress.Status == NodeState_InProgressState_Stopping
		isSkipped := *state.InProgress.Status == NodeState_InProgressState_Skipping
		node.SetState(&NodeState_DoneState{
			Error:     asStringPtr(err),
			IsStopped: &isStopped,
			IsSkipped: &isSkipped,
		})

		node.NotifyOutputOnInputChange()

		node.DoneEvent.Trigger()
	}()
	return nil
}

const YARL_ROOT = "/home/bor1-ss/.yarl/nodes"

func (node *Node) prepareRunContext() (*job.RunContext, error) {
	err := node.resetRunContext()
	if err != nil {
		return nil, fmt.Errorf("reset failed: %v", err)
	}

	ctx := &job.RunContext{
		Dir: path.Join(YARL_ROOT, fmt.Sprint(node.Config.GetId())),
	}

	err = os.MkdirAll(ctx.Dir, 0777)
	if err != nil {
		return nil, fmt.Errorf("mkdir failed: %v", err)
	}

	for inputPort0Indexed, input := range node.Config.Inputs {
		if strings.HasSuffix(input, "/") {
			err = os.MkdirAll(path.Join(ctx.Dir, input), 0777)
			if err != nil {
				return nil, fmt.Errorf("mkdir failed: %v", err)
			}
		}

		for _, edge := range node.graph.Config.Edges {
			isInputEdge := edge.GetToNodeId() == node.Config.GetId() && edge.GetToPort() == uint64(inputPort0Indexed+1)
			if !isInputEdge {
				continue
			}

			err := copyEdge(edge, node.graph.Nodes)
			if err != nil {
				return nil, fmt.Errorf("copying on edge{%v} failed: %v", prototext.MarshalOptions{}.Format(edge), err)
			}
		}
	}

	return ctx, nil
}

func copyEdge(edge *EdgeConfig, nodes map[NodeId]*Node) error {
	src := path.Join(YARL_ROOT, fmt.Sprint(edge.GetFromNodeId()), nodes[NodeId(*edge.FromNodeId)].Config.Outputs[*edge.FromPort-1])
	dst := path.Join(YARL_ROOT, fmt.Sprint(edge.GetToNodeId()), nodes[NodeId(*edge.ToNodeId)].Config.Inputs[*edge.ToPort-1])
	// TODO use more go-like solution
	cp := exec.Command("cp", "--recursive", src, dst)
	output, err := cp.CombinedOutput()
	if err != nil {
		return fmt.Errorf("cp=`%v` failed: err=\"%v\" %v", cp, err, string(output))
	}
	return nil
}

func (node *Node) resetRunContext() error {
	return os.RemoveAll(path.Join(YARL_ROOT, fmt.Sprint(node.Config.GetId())))
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

	node.NotifyOutputOnInputChange()

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
	node.resetRunContext()
	node.Job = nil

	for _, output := range node.CollectOutput() {
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

	node.NotifyOutputOnInputChange()

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
				log.Printf("node{Id: %v}.Run() failed: %v\n", node.Config.GetId(), err)
				util.GrpcError(err)
			}

		case NodeState_IdleState_Skipped:
			err := node.Done()
			if err != nil {
				util.GrpcError(err)
			}
		}
	}
}

func (node *Node) isReadyAsInput() bool {
	switch state := node.state.(type) {
	case *NodeState_InProgress:
		return state.InProgress.GetStatus() == NodeState_InProgressState_Skipping
	case *NodeState_Done:
		return state.Done.Error == nil || state.Done.GetIsSkipped()
	default:
		return false
	}
}

func (node *Node) isReady() bool {
	for _, input := range node.CollectInput() {
		if !input.isReadyAsInput() {
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

func (node *Node) CollectInput() []*Node {
	result := []*Node{}
	for _, edge := range node.graph.Config.Edges {
		if edge.GetToNodeId() == node.Config.GetId() {
			result = append(result, node.graph.Nodes[NodeId(edge.GetFromNodeId())])
		}
	}
	return result
}

func (node *Node) CollectOutput() []*Node {
	result := []*Node{}
	for _, edge := range node.graph.Config.Edges {
		if edge.GetFromNodeId() == node.Config.GetId() {
			result = append(result, node.graph.Nodes[NodeId(edge.GetToNodeId())])
		}
	}
	return result
}

func (node *Node) NotifyOutputOnInputChange() {
	for _, output := range node.CollectOutput() {
		output.OnInputChange()
	}
}
