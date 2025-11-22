package daemon

import (
	"fmt"
	"pipegraph/internal/job"

	"google.golang.org/protobuf/types/known/anypb"
)

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
