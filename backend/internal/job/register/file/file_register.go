package file

import (
	"fmt"
	"os"
	"path"
	"strings"
	"yarl/internal/job"

	"google.golang.org/protobuf/proto"
)

type FileJob struct {
	config *FileConfig
}

func (j *FileJob) Run(ctx *job.RunContext) error {
	data := strings.Join(j.config.Data, "\n") + "\n"
	err := os.WriteFile(path.Join(ctx.Dir, "file"), []byte(data), 0666)
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
	job.Register(&FileConfig{}, func(msg proto.Message) (job.Job, error) {
		return &FileJob{config: msg.(*FileConfig)}, nil
	})
}
