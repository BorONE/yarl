package util

import (
	"fmt"
	"os"
	"path"
	"pipegraph/internal/job"
	"strings"

	"google.golang.org/protobuf/types/known/anypb"
)

type FileJob struct {
	data string
}

func (j *FileJob) Run(ctx *job.RunContext) error {
	err := os.WriteFile(path.Join(ctx.Dir, "file"), []byte(j.data), 0666)
	if err != nil {
		return fmt.Errorf("failed to write file: %v", err)
	}
	return nil
}

func (j *FileJob) Kill() error {
	return nil
}

func (j *FileJob) CollectArtifacts() map[string]string {
	return map[string]string{}
}

var _ job.Job = &FileJob{}

func init() {
	job.Register(&FileConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		cfg := &FileConfig{}
		err := anyConfig.UnmarshalTo(cfg)
		if err != nil {
			return nil, err
		}

		return &FileJob{
			data: strings.Join(cfg.Data, "\n") + "\n",
		}, nil
	})
}
