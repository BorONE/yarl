package job

import (
	"maps"
	"sync"
)

type Artifacts struct {
	data map[string]string
	mu   sync.Mutex
}

func (a *Artifacts) Access() (data map[string]string, done func()) {
	a.mu.Lock()
	return a.data, func() { a.mu.Unlock() }
}

func (a *Artifacts) Reset(data map[string]string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.data = data
}

func (a *Artifacts) Set(key, value string) {
	data, done := a.Access()
	defer done()
	data[key] = value
}

func (a *Artifacts) Dump() map[string]string {
	data, done := a.Access()
	defer done()
	if data == nil {
		return map[string]string{}
	}
	return maps.Clone(data)
}
