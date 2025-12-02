package main

import (
	"log"
	"net"
	"os"
	"os/signal"

	"yarl/internal/api"
	_ "yarl/internal/job/register"
)

func main() {
	lis, err := net.Listen("tcp", ":9000")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	server := api.NewServer()

	go func() {
		waitSigInt()
		log.Printf("got sigint, shutting down...")
		go server.GracefulStop()
		waitSigInt()
		log.Printf("got sigint again, stopping...")
		server.Stop()
	}()

	log.Printf("server listening at %v", lis.Addr())
	if err := server.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}

func waitSigInt() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
}
