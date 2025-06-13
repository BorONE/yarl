package register

import (
	"context"
	"os/exec"
	"pipegraph/config"
	"pipegraph/job"
)

type ShellScriptJob struct {
	cmd    *exec.Cmd
	ctx    context.Context
	cancel func()
}

func (j *ShellScriptJob) Init(job *config.Job) {
	j.ctx, j.cancel = context.WithCancel(context.Background())
	defer j.cancel()

	j.cmd = exec.CommandContext(j.ctx, "/bin/sh", *job.Path)
}

func (j *ShellScriptJob) Run() error {
	return j.cmd.Run()
}

func (j *ShellScriptJob) Stop() {
	j.cancel()
}

var _ job.Job = &ShellScriptJob{}

func init() {
	job.RegisterJobType(config.JobType_ShellScript, func() job.Job { return &ShellScriptJob{} })
}
