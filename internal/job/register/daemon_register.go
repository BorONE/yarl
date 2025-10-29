package register

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"pipegraph/internal/job"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	_ "embed"

	"google.golang.org/protobuf/types/known/anypb"
)

// Daemon

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

// DaemonMonitor

type DaemonMonitorJob struct {
	isKilled atomic.Bool
	arts     job.Artifacts
}

func (j *DaemonMonitorJob) Run(ctx *job.RunContext) error {
	var pid *int
	var stdout *string
	var stderr *string

	data, err := os.ReadFile(path.Join(ctx.Dir, "info"))
	if err != nil {
		return fmt.Errorf("failed to read info file: %s", err)
	}

	for _, line := range strings.Split(string(data), "\n") {
		kv := strings.SplitN(line, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key, value := kv[0], kv[1]
		if key == "PID" {
			parsed, err := strconv.Atoi(value)
			if err != nil {
				continue
			}
			pid = &parsed
		} else if key == "STDOUT" {
			stdout = &value
		} else if key == "STDERR" {
			stderr = &value
		}
	}

	j.arts.Set("started_at", time.Now().String())
	defer func() { j.arts.Set("finished_at", time.Now().String()) }()

	for !j.isKilled.Load() {
		if pid != nil {
			process, err := os.FindProcess(*pid)
			if err != nil {
				return fmt.Errorf("failed to find process: %s", err)
			}

			err = process.Signal(syscall.Signal(0))
			if err != nil {
				return fmt.Errorf("process.Signal on pid %d returned: %v", *pid, err)
			}
		}

		func() {
			arts, done := j.arts.Access()
			defer done()

			if stdout != nil {
				data, _ = os.ReadFile(*stdout)
				arts["stdout"] = string(data)
			}

			if stderr != nil {
				data, _ = os.ReadFile(*stderr)
				arts["stderr"] = string(data)
			}
		}()
	}

	return nil
}

func (j *DaemonMonitorJob) Kill() error {
	j.isKilled.Store(true)
	return nil
}

func (j *DaemonMonitorJob) CollectArtifacts() map[string]string {
	return j.arts.Dump()
}

var _ job.Job = &DaemonMonitorJob{}

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
	job.Register(&DaemonMonitorConfig{}, func(anyConfig *anypb.Any) (job.Job, error) {
		job := &DaemonMonitorJob{}
		job.arts.Reset(map[string]string{})
		return job, nil
	})
}
