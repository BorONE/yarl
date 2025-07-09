package job

import (
	"fmt"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
)

type Job interface {
	Run() error
	Reset() error
	CollectArtifacts() (Artifacts, error)
}

type JobRunner struct {
	Job
	Err  error
	Done chan any
}

func (runner *JobRunner) Run() {
	runner.Done = make(chan any)
	runner.Err = runner.Job.Run()
	close(runner.Done)
}

func (runner *JobRunner) Error() *string {
	if runner.Err != nil {
		err := runner.Err.Error()
		return &err
	} else {
		return nil
	}
}

type Artifacts map[string]any

func (a Artifacts) GetString(key string) (string, error) {
	artifact, ok := a[key]
	if !ok {
		return "", fmt.Errorf("artifact %s does not exist", key)
	}
	result, ok := artifact.(string)
	if !ok {
		return "", fmt.Errorf("artifact %s is not string, but %v", key, result)
	}
	return result, nil
}

type Creator func(*anypb.Any) (Job, error)

var creators map[string]Creator = make(map[string]Creator)

// Make sure that .pb.go-files' init-s executed before Register call. Otherwise
// you will get nil dereference since config type is not in proto-registry and
// any is not able to Marshal message.
//
// NB execution order of init-s is lexigraphical order of corresponding files,
// so <job>.pb.go should preced <job_register>.go file. NB '.' < '_'
func Register(cfg proto.Message, creator Creator) error {
	job, err := anypb.New(cfg)
	if err != nil {
		return err
	}
	creators[job.TypeUrl] = creator
	return nil
}

func Create(cfg *anypb.Any) (Job, error) {
	creator, ok := creators[cfg.GetTypeUrl()]
	if !ok {
		return nil, fmt.Errorf("unknown job type: %v", cfg.GetTypeUrl())
	}
	return creator(cfg)
}
