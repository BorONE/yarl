package util

import "sync"

type WaitAny struct {
	isDone bool
	cond   sync.Cond
}

func NewWaitAny() *WaitAny {
	return &WaitAny{cond: *sync.NewCond(&sync.Mutex{})}
}

func (w *WaitAny) Done() {
	w.cond.L.Lock()
	w.isDone = true
	w.cond.L.Unlock()
	w.cond.Broadcast()
}

func (w *WaitAny) Wait() {
	w.cond.L.Lock()
	for !w.isDone {
		w.cond.Wait()
	}
	w.cond.L.Unlock()
}

func (w *WaitAny) Select() chan any {
	result := make(chan any)
	go func() {
		w.Wait()
		result <- struct{}{}
	}()
	return result
}
