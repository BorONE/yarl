package daemon

import (
	"fmt"
	"os"
	"path"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	"yarl/internal/job"

	_ "embed"

	"google.golang.org/protobuf/proto"
)

type DaemonMonitorJob struct {
	isKilled atomic.Bool
	arts     job.Artifacts
}

type DaemonInfo struct {
	pid    *int
	stdout *string
	stderr *string
}

func unquote(s string, q string) string {
	if strings.HasPrefix(s, q) && strings.HasSuffix(s, q) {
		return s[1 : len(s)-1]
	}
	return s
}

func (j *DaemonMonitorJob) parseInfo(lines []string) DaemonInfo {
	var info DaemonInfo
	for _, line := range lines {
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
			info.pid = &parsed
		} else if key == "STDOUT" {
			value = unquote(value, "\"")
			info.stdout = &value
		} else if key == "STDERR" {
			value = unquote(value, "\"")
			info.stderr = &value
		}
	}
	return info
}

func (j *DaemonMonitorJob) Run(ctx *job.RunContext) error {
	data, err := os.ReadFile(path.Join(ctx.Dir, "info"))
	if err != nil {
		return fmt.Errorf("failed to read info file: %s", err)
	}

	j.arts.Reset(map[string]string{"started_at": time.Now().String()})
	defer func() { j.arts.Set("finished_at", time.Now().String()) }()

	for info := j.parseInfo(strings.Split(string(data), "\n")); !j.isKilled.Load(); {
		if info.pid != nil {
			process, err := os.FindProcess(*info.pid)
			if err != nil {
				return fmt.Errorf("failed to find process: %s", err)
			}

			err = process.Signal(syscall.Signal(0))
			if err != nil {
				return fmt.Errorf("process.Signal on pid %d returned: %v", *info.pid, err)
			}
		}

		func() {
			arts, done := j.arts.Access()
			defer done()

			if info.stdout != nil {
				data, _ = os.ReadFile(*info.stdout)
				arts["stdout"] = string(data)
			}

			if info.stderr != nil {
				data, _ = os.ReadFile(*info.stderr)
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
	job.Register(&DaemonMonitorConfig{}, func(proto.Message) (job.Job, error) {
		return &DaemonMonitorJob{}, nil
	})
}
