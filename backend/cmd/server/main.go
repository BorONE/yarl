package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"

	"yarl/internal/api"
	_ "yarl/internal/job/register"
)

var port = flag.Int("port", 9000, "Port for runner to listen to")

func main() {
	flag.Parse()

	address := fmt.Sprintf(":%v", *port)
	lis, err := net.Listen("tcp", address)
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
