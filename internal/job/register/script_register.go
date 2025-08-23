package register

import (
	"fmt"
	"log"
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

func (j *ScriptJob) reset() {
	j.kill = func() {}
}

func (j *ScriptJob) Run(ctx job.RunContext) error {
	filename := "script"
	filepath := path.Join(ctx.Dir, filename)

	err := os.WriteFile(filepath, []byte(j.source), 0777)
	if err != nil {
		j.arts.Reset(map[string]string{})
		return fmt.Errorf("failed to create script: %v", err)
	}

	log.Println(path.Join(".", filename))
	j.cmd, j.kill = job.NewCommandWithKill(fmt.Sprintf("./%s", filename))

	j.cmd.Dir = ctx.Dir

	j.cmd.Stdout = &j.stdout
	j.cmd.Stderr = &j.stderr

	err = j.cmd.Start()
	if err != nil {
		j.arts.Reset(map[string]string{})
		return fmt.Errorf("failed to start script: %v", err)
	}

	j.arts.Reset(map[string]string{"started_at": time.Now().String()})
	defer j.arts.Set("finished_at", time.Now().String())
	return j.cmd.Wait()
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
