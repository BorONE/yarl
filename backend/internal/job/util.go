package job

import (
	"os/exec"
	"syscall"
)

// Default cancel just kills main process, not child processes. This function
// creates group which can be killed with cancel.
func NewCommandWithKill(name string, args ...string) (*exec.Cmd, func()) {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return cmd, func() { syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
}
