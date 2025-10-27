package register

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"pipegraph/internal/job"
	"time"

	_ "embed"

	"google.golang.org/protobuf/types/known/anypb"
)

//go:embed daemon_format.sh
var DAEMON_SCRIPT_FORMAT string

type DaemonJob struct {
	source string

	cmd  *exec.Cmd
	kill func()

	arts job.Artifacts
}

const DAEMON_SCRIPT_FILENAME = ".script"

func (j *DaemonJob) reset() {
	log.Print("daemon:\n", j.source)
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

func init() {
	validString := ""
	validConfig := DaemonConfig{Run: &validString, Status: &validString, Shutdown: &validString}
	job.Register(&validConfig, func(anyConfig *anypb.Any) (job.Job, error) {
		cfg := &DaemonConfig{}
		err := anyConfig.UnmarshalTo(cfg)
		if err != nil {
			return nil, err
		}

		source := fmt.Sprintf(DAEMON_SCRIPT_FORMAT, cfg.GetRun(), cfg.GetStatus(), cfg.GetShutdown())
		job := &DaemonJob{source: source}
		job.reset()
		return job, nil
	})
}
