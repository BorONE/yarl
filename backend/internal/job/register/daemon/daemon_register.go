package daemon

import (
	"fmt"
	"os"
	"path"
	"time"
	"yarl/internal/job"
	"yarl/internal/util"

	_ "embed"

	"google.golang.org/protobuf/types/known/anypb"
)

//go:embed daemon_format.sh
var DAEMON_SCRIPT_FORMAT string

const DAEMON_SCRIPT_FILENAME = ".script"

type DaemonJob struct {
	config *DaemonConfig

	cmd  *util.Cmd
	arts job.Artifacts
}

func (j *DaemonJob) Run(ctx *job.RunContext) error {
	source := fmt.Sprintf(DAEMON_SCRIPT_FORMAT, j.config.GetRun(), j.config.GetStatus(), j.config.GetShutdown())
	err := os.WriteFile(path.Join(ctx.Dir, DAEMON_SCRIPT_FILENAME), []byte(source), 0777)
	if err != nil {
		return fmt.Errorf("failed to create script: %v", err)
	}

	j.arts.Reset(map[string]string{
		"script":     source,
		"started_at": time.Now().String(),
	})
	defer func() { j.arts.Set("finished_at", time.Now().String()) }()

	j.cmd = util.NewCmd("./" + DAEMON_SCRIPT_FILENAME)
	j.cmd.Dir = ctx.Dir
	return j.cmd.Run()
}

func (j *DaemonJob) Kill() error {
	j.cmd.Kill()
	return nil
}

func (j *DaemonJob) CollectArtifacts() map[string]string {
	arts := j.arts.Dump()
	arts["stdout"] = j.cmd.Stdout.String()
	arts["stderr"] = j.cmd.Stderr.String()
	return arts
}

var _ job.Job = &DaemonJob{}

func init() {
	job.Register(&DaemonConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		cfg := &DaemonConfig{}
		err := anyConfig.UnmarshalTo(cfg)
		if err != nil {
			return nil, err
		}
		return &DaemonJob{config: cfg}, nil
	})
}
