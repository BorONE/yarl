package job

import (
	"fmt"
	"pipegraph/config"
)

type Job interface {
	Init(job *config.Job)
	Run() error
	Reset() error
	CollectArtifacts() (Artifacts, error)
}

type Artifacts map[string]any

func (a Artifacts) GetString(key string) (string, error) {
	artifact, ok := a[key]
	if !ok {
		return "", fmt.Errorf("artifact %s does not exist", key)
	}
	result, ok := artifact.(string)
	if !ok {
		return "", fmt.Errorf("artifact %s is not string, but %v", key, result)
	}
	return result, nil
}

type JobCreator func() Job

var jobTypes map[config.JobType]JobCreator = make(map[config.JobType]JobCreator)

func RegisterJobType(jobType config.JobType, jobCreator JobCreator) {
	jobTypes[jobType] = jobCreator
}

func CreateJob(jobConfig *config.Job) Job {
	job := jobTypes[*jobConfig.Type]()
	job.Init(jobConfig)
	return job
}
