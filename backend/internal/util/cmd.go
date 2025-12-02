package util

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

type Cmd struct {
	*exec.Cmd
	kill func()

	Stdout ThreadSafeStringBuilder
	Stderr ThreadSafeStringBuilder
}

func NewCmd(name string, args ...string) *Cmd {
	cmd := &Cmd{}
	cmd.Cmd, cmd.kill = NewCommandWithKill(name, args...)
	cmd.Cmd.Stdout = &cmd.Stdout
	cmd.Cmd.Stderr = &cmd.Stderr
	return cmd
}

func (cmd *Cmd) Kill() {
	cmd.kill()
}
