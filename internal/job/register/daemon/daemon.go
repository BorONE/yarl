package daemon

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"pipegraph/internal/job"
	"time"

	_ "embed"
)

//go:embed daemon_format.sh
var DAEMON_SCRIPT_FORMAT string

const DAEMON_SCRIPT_FILENAME = ".script"

type DaemonJob struct {
	source string

	cmd  *exec.Cmd
	kill func()

	arts job.Artifacts
}

func (j *DaemonJob) reset() {
	j.cmd, j.kill = job.NewCommandWithKill("./" + DAEMON_SCRIPT_FILENAME)
	j.arts.Reset(map[string]string{})
}

func (j *DaemonJob) Run(ctx *job.RunContext) error {
	err := os.WriteFile(path.Join(ctx.Dir, DAEMON_SCRIPT_FILENAME), []byte(j.source), 0777)
	if err != nil {
		j.arts.Reset(map[string]string{})
		return fmt.Errorf("failed to create script: %v", err)
	}

	j.cmd.Dir = ctx.Dir

	j.arts.Set("started_at", time.Now().String())
	defer func() { j.arts.Set("finished_at", time.Now().String()) }()

	return j.cmd.Run()
}

func (j *DaemonJob) Kill() error {
	j.kill()
	j.reset()
	return nil
}

func (j *DaemonJob) CollectArtifacts() map[string]string {
	return j.arts.Dump()
}

var _ job.Job = &DaemonJob{}
