package script

import (
	"fmt"
	"os"
	"path"
	"strings"
	"time"
	"yarl/internal/job"
	"yarl/internal/util"

	"google.golang.org/protobuf/types/known/anypb"
)

type ScriptJob struct {
	source string

	cmd  *util.Cmd
	arts job.Artifacts
}

const SCRIPT_FILENAME = ".script"

func (j *ScriptJob) Run(ctx *job.RunContext) error {
	err := os.WriteFile(path.Join(ctx.Dir, SCRIPT_FILENAME), []byte(j.source), 0777)
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
	job.Register(&ScriptConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		cfg := &ScriptConfig{}
		err := anyConfig.UnmarshalTo(cfg)
		if err != nil {
			return nil, err
		}
		return &ScriptJob{source: strings.Join(cfg.GetSource(), "\n")}, nil
	})
}
