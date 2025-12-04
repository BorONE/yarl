package job

import (
	"fmt"
	"log"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
)

type RunContext struct {
	Dir string
}

type Job interface {
	Run(ctx *RunContext) error
	Kill() error
	CollectArtifacts() map[string]string
}

type internalCreator func(*anypb.Any) (Job, error)
type Creator func(proto.Message) (Job, error)

var creators map[string]internalCreator = make(map[string]internalCreator)

// Make sure that .pb.go-files' init-s executed before Register call. Otherwise
// you will get nil dereference since config type is not in proto-registry and
// any is not able to Marshal message.
//
// NB execution order of init-s is lexigraphical order of corresponding files,
// so <job>.pb.go should preced <job_register>.go file. NB '.' < '_'
func Register(cfg proto.Message, creator Creator) error {
	job, err := anypb.New(cfg)
	if err != nil {
		log.Panicln("failed to register job: ", err)
		return err
	}
	creators[job.TypeUrl] = func(anyConfig *anypb.Any) (Job, error) {
		msg := proto.Clone(cfg)
		err := anyConfig.UnmarshalTo(msg)
		if err != nil {
			return nil, err
		}
		return creator(msg)
	}
	log.Println(job.TypeUrl, " is registered")
	return nil
}

func Create(cfg *anypb.Any) (Job, error) {
	creator, ok := creators[cfg.GetTypeUrl()]
	if !ok {
		return nil, fmt.Errorf("unknown job type: %v", cfg.GetTypeUrl())
	}
	return creator(cfg)
}
