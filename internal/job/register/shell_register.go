package register

import (
	"os/exec"
	"pipegraph/internal/job"
	"pipegraph/internal/util"
	"time"

	"google.golang.org/protobuf/types/known/anypb"
)

type BashJob struct {
	args []string

	cmd  *exec.Cmd
	kill func()

	arts   job.Artifacts
	stdout util.ThreadSafeStringBuilder
	stderr util.ThreadSafeStringBuilder
}

func (j *BashJob) reset() {
	j.kill = func() {}
}

func (j *BashJob) Run(ctx job.RunContext) error {
	j.cmd, j.kill = job.NewCommandWithKill("/bin/sh", j.args...)

	j.cmd.Dir = ctx.Dir

	j.cmd.Stdout = &j.stdout
	j.cmd.Stderr = &j.stderr
	j.cmd.Start()

	j.arts.Reset(map[string]string{"started_at": time.Now().String()})
	defer j.arts.Set("finished_at", time.Now().String())
	return j.cmd.Wait()
}

func (j *BashJob) Kill() error {
	j.kill()
	j.reset()
	return nil
}

func (j *BashJob) CollectArtifacts() map[string]string {
	arts := j.arts.Dump()
	arts["stdout"] = j.stdout.String()
	arts["stderr"] = j.stderr.String()
	return arts
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
