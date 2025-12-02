package util

type EventListener func()

type Event struct {
	listeners []EventListener
}

func (event *Event) OnTrigger(listener EventListener) {
	event.listeners = append(event.listeners, listener)
}

func (event *Event) Trigger() {
	for _, listener := range event.listeners {
		listener()
	}
	event.listeners = nil
}
