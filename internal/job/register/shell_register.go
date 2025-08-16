package register

import (
	"context"
	"os/exec"
	"pipegraph/internal/job"
	"pipegraph/internal/util"
	"syscall"
	"time"

	"google.golang.org/protobuf/types/known/anypb"
)

type BashJob struct {
	args []string

	cmd    *exec.Cmd
	cancel func()

	artifacts job.Artifacts
	stdout    util.ThreadSafeStringBuilder
	stderr    util.ThreadSafeStringBuilder
}

func (j *BashJob) reset() {
	j.cancel = func() {}
}

func (j *BashJob) Run() error {
	j.cmd, j.cancel = makeCommandWithGroupCancel(context.Background(), "/bin/sh", j.args...)
	defer j.cancel()

	j.artifacts = make(job.Artifacts)
	j.artifacts["started_at"] = time.Now().String()
	defer func() { j.artifacts["finished_at"] = time.Now().String() }()

	j.cmd.Stdout = &j.stdout
	j.cmd.Stderr = &j.stderr

	return j.cmd.Run()
}

// Default cancel just kills main process, not child processes. This function
// creates group which can be killed with cancel.
func makeCommandWithGroupCancel(ctx context.Context, name string, args ...string) (*exec.Cmd, context.CancelFunc) {
	ctx, cancel := context.WithCancel(ctx)

	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	go func() {
		<-ctx.Done()
		if cmd.Process != nil {
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
	}()

	return cmd, cancel
}

func (j *BashJob) Reset() error {
	j.cancel()
	j.reset()
	return nil
}

func (j *BashJob) CollectArtifacts() job.Artifacts {
	j.artifacts["stdout"] = j.stdout.String()
	j.artifacts["stderr"] = j.stderr.String()
	return j.artifacts
}

var _ job.Job = &BashJob{}

func init() {
	job.Register(&ShellScriptConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		cfg := &ShellScriptConfig{}
		err := anyConfig.UnmarshalTo(cfg)
		if err != nil {
			return nil, err
		}

		job := &BashJob{args: append([]string{*cfg.Path}, cfg.Args...)}
		job.reset()
		return job, nil
	})

	job.Register(&ShellCommandConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		cfg := &ShellCommandConfig{}
		err := anyConfig.UnmarshalTo(cfg)
		if err != nil {
			return nil, err
		}

		job := &BashJob{args: []string{"-c", cfg.GetCommand()}}
		job.reset()
		return job, nil
	})
}
