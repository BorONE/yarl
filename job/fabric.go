package job

import (
	"fmt"

	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
)

type Job interface {
	Init(job *Config)
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

type JobNumber protoreflect.FieldNumber

func GetJobNumber(cfg *Config) (JobNumber, error) {
	if cfg.Job == nil {
		return 0, fmt.Errorf("job is not present")
	}
	ref := cfg.ProtoReflect()
	jobDesc := ref.Descriptor().Oneofs().ByName("Job")
	number := ref.WhichOneof(jobDesc).Number()
	return JobNumber(number), nil
}

type JobCreator func() Job

var jobCreators map[JobNumber]JobCreator = make(map[JobNumber]JobCreator)

func Register(cfg isConfig_Job, creator JobCreator) error {
	number, err := GetJobNumber(&Config{Job: cfg})
	if err != nil {
		return err
	}
	jobCreators[number] = creator
	return nil
}

func CreateJob(cfg *Config) (Job, error) {
	number, err := GetJobNumber(cfg)
	if err != nil {
		return nil, err
	}
	job := jobCreators[number]()
	job.Init(cfg)
	return job, err
}
