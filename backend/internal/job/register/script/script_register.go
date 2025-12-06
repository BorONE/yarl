package script

import (
	"fmt"
	"os"
	"path"
	"time"
	"yarl/internal/job"
	"yarl/internal/util"

	"google.golang.org/protobuf/proto"
)

type ScriptJob struct {
	config *ScriptConfig

	cmd  *util.Cmd
	arts job.Artifacts
}

const SCRIPT_FILENAME = ".script"

func (j *ScriptJob) Run(ctx *job.RunContext) error {
	err := os.WriteFile(path.Join(ctx.Dir, SCRIPT_FILENAME), []byte(j.config.GetSource()), 0777)
	if err != nil {
		return fmt.Errorf("failed to create script: %v", err)
	}

	j.arts.Reset(map[string]string{"started_at": time.Now().String()})
	defer func() { j.arts.Set("finished_at", time.Now().String()) }()

	j.cmd = util.NewCmd("./" + SCRIPT_FILENAME)
	j.cmd.Dir = ctx.Dir
	return j.cmd.Run()
}

func (j *ScriptJob) Kill() error {
	j.cmd.Kill()
	return nil
}

func (j *ScriptJob) CollectArtifacts() map[string]string {
	arts := j.arts.Dump()
	arts["stdout"] = j.cmd.Stdout.String()
	arts["stderr"] = j.cmd.Stderr.String()
	return arts
}

var _ job.Job = &ScriptJob{}

func init() {
	job.Register(&ScriptConfig{}, func(msg proto.Message) (job.Job, error) {
		return &ScriptJob{config: msg.(*ScriptConfig)}, nil
	})
}
