package register

import (
	"context"
	"os/exec"
	"pipegraph/job"
	"strings"

	"google.golang.org/protobuf/types/known/anypb"
)

type ShellScriptJob struct {
	ShellScriptConfig

	cmd    *exec.Cmd
	ctx    context.Context
	cancel func()

	Stdout strings.Builder
	Stderr strings.Builder
}

func (j *ShellScriptJob) reset() {
	j.ctx, j.cancel = context.WithCancel(context.Background())
	j.cmd = exec.CommandContext(j.ctx, "/bin/sh", *j.Path)
	j.cmd.Stdout = &j.Stdout
	j.cmd.Stderr = &j.Stderr
}

func (j *ShellScriptJob) Run() error {
	defer j.cancel()
	return j.cmd.Run()
}

func (j *ShellScriptJob) Reset() error {
	j.cancel()
	j.reset()
	return nil
}

func (j *ShellScriptJob) CollectArtifacts() (job.Artifacts, error) {
	result := make(map[string]any)
	result["stdout"] = j.Stdout.String()
	result["stderr"] = j.Stderr.String()
	return result, nil
}

var _ job.Job = &ShellScriptJob{}

func init() {
	job.Register(&ShellScriptConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		job := &ShellScriptJob{}
		err := anyConfig.UnmarshalTo(job)
		if err != nil {
			return nil, err
		}
		job.reset()
		return job, nil
	})
}
