package job

import "pipegraph/config"

type Job interface {
	Init(job *config.Job)
	Run() error
	Stop()
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
