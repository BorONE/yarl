package register

import (
	"maps"
	"os/exec"
	"pipegraph/internal/job"
	"pipegraph/internal/util"
	"sync"
	"syscall"
	"time"

	"google.golang.org/protobuf/types/known/anypb"
)

type BashJob struct {
	args []string

	cmd  *exec.Cmd
	kill func()

	arts   job.Artifacts
	artsMu sync.Mutex
	stdout util.ThreadSafeStringBuilder
	stderr util.ThreadSafeStringBuilder
}

func (j *BashJob) reset() {
	j.kill = func() {}
}

func (j *BashJob) Run() error {
	j.cmd, j.kill = startCommandWithKill("/bin/sh", j.args...)

	j.cmd.Stdout = &j.stdout
	j.cmd.Stderr = &j.stderr
	j.cmd.Start()

	j.resetArts(job.Artifacts{"started_at": time.Now().String()})
	defer func() { j.setArt("finished_at", time.Now().String()) }()
	return j.cmd.Wait()
}

// Default cancel just kills main process, not child processes. This function
// creates group which can be killed with cancel.
func startCommandWithKill(name string, args ...string) (*exec.Cmd, func()) {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return cmd, func() { syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
}

func (j *BashJob) Kill() error {
	j.kill()
	j.reset()
	return nil
}

func (j *BashJob) resetArts(init job.Artifacts) {
	j.artsMu.Lock()
	defer j.artsMu.Unlock()

	j.arts = init
}

func (j *BashJob) setArt(key, value string) {
	j.artsMu.Lock()
	defer j.artsMu.Unlock()

	j.arts[key] = value
}

func (j *BashJob) CollectArtifacts() job.Artifacts {
	j.artsMu.Lock()
	defer j.artsMu.Unlock()

	j.arts["stdout"] = j.stdout.String()
	j.arts["stderr"] = j.stderr.String()
	return maps.Clone(j.arts)
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
