package register

import (
	"log"
	"os"
	"os/exec"
	"pipegraph/internal/job"
	"pipegraph/internal/util"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/anypb"
)

type ScriptJob struct {
	args []string

	cmd  *exec.Cmd
	kill func()

	arts   job.Artifacts
	stdout util.ThreadSafeStringBuilder
	stderr util.ThreadSafeStringBuilder
}

func (j *ScriptJob) reset() {
	j.kill = func() {}
}

func (j *ScriptJob) Run() error {
	j.cmd, j.kill = job.NewCommandWithKill(j.args[0], j.args[1:]...)
	log.Println("cmd:", j.cmd.Args)

	j.cmd.Stdout = &j.stdout
	j.cmd.Stderr = &j.stderr
	j.cmd.Start()

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
			args: append([]string{*cfg.Interpreter}, cfg.Args...),
		}
		job.reset()

		err = os.WriteFile(cfg.GetFilename(), []byte(strings.Join(cfg.GetSource(), "\n")), 0644)
		if err != nil {
			return nil, err
		}

		return job, nil
	})
}
