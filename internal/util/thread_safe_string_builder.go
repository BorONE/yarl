package util

import (
	"strings"
	"sync"
)

type ThreadSafeStringBuilder struct {
	b strings.Builder
	m sync.Mutex
}

func (b *ThreadSafeStringBuilder) Write(bytes []byte) (int, error) {
	b.m.Lock()
	defer b.m.Unlock()

	return b.b.Write(bytes)
}

func (b *ThreadSafeStringBuilder) String() string {
	b.m.Lock()
	defer b.m.Unlock()

	return b.b.String()
}
