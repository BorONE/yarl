package register

import (
	"context"
	"os/exec"
	"pipegraph/job"
	"strings"
)

type ShellScriptJob struct {
	cfg *job.Config

	cmd    *exec.Cmd
	ctx    context.Context
	cancel func()

	Stdout strings.Builder
	Stderr strings.Builder
}

func (j *ShellScriptJob) Init(cfg *job.Config) {
	j.cfg = cfg

	j.ctx, j.cancel = context.WithCancel(context.Background())
	j.cmd = exec.CommandContext(j.ctx, "/bin/sh", *j.cfg.GetShellScript().Path)
	j.cmd.Stdout = &j.Stdout
	j.cmd.Stderr = &j.Stderr
}

func (j *ShellScriptJob) Run() error {
	defer j.cancel()
	return j.cmd.Run()
}

func (j *ShellScriptJob) Reset() error {
	j.cancel()
	j.Init(j.cfg)
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
	job.Register(&job.Config_ShellScript{}, func() job.Job { return &ShellScriptJob{} })
}
