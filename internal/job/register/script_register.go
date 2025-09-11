package register

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"pipegraph/internal/job"
	"pipegraph/internal/util"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/anypb"
)

type ScriptJob struct {
	source string

	cmd  *exec.Cmd
	kill func()

	arts   job.Artifacts
	stdout util.ThreadSafeStringBuilder
	stderr util.ThreadSafeStringBuilder
}

const SCRIPT_FILENAME = ".script"

func (j *ScriptJob) reset() {
	j.cmd, j.kill = job.NewCommandWithKill("./" + SCRIPT_FILENAME)
	j.cmd.Stdout = &j.stdout
	j.cmd.Stderr = &j.stderr
	j.arts.Reset(map[string]string{})
}

func (j *ScriptJob) Run(ctx *job.RunContext) error {
	err := os.WriteFile(path.Join(ctx.Dir, SCRIPT_FILENAME), []byte(j.source), 0777)
	if err != nil {
		j.arts.Reset(map[string]string{})
		return fmt.Errorf("failed to create script: %v", err)
	}

	j.cmd.Dir = ctx.Dir

	j.arts.Set("started_at", time.Now().String())
	defer j.arts.Set("finished_at", time.Now().String())

	return j.cmd.Run()
}

func (j *ScriptJob) Kill() error {
	j.kill()
	j.reset()
	return nil
}

func (j *ScriptJob) CollectArtifacts() map[string]string {
	arts := j.arts.Dump()
	arts["stdout"] = j.stdout.String()
	arts["stderr"] = j.stderr.String()
	return arts
}

var _ job.Job = &ScriptJob{}

func init() {
	job.Register(&ScriptConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		cfg := &ScriptConfig{}
		err := anyConfig.UnmarshalTo(cfg)
		if err != nil {
			return nil, err
		}

		job := &ScriptJob{
			source: strings.Join(cfg.GetSource(), "\n"),
		}
		job.reset()

		return job, nil
	})
}
