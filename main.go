package main

import (
	"flag"
	"io"
	"log"
	"net"
	"os"
	"os/signal"

	"pipegraph/api"
	"pipegraph/graph"
	_ "pipegraph/job/register"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/prototext"
)

var (
	configPath = flag.String("config", "graph.proto.txt", "path to config of graph")
)

func main() {
	flag.Parse()

	file, err := os.Open(*configPath)

	if err != nil {
		log.Fatal(err)
	}

	fileData, err := io.ReadAll(file)

	if err != nil {
		log.Fatal(err)
	}

	graphConfig := &graph.Config{}
	err = prototext.Unmarshal(fileData, graphConfig)

	if err != nil {
		log.Fatal(err)
	}

	gr := graph.NewGraph(graphConfig)

	lis, err := net.Listen("tcp", ":9000")

	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	api.RegisterGraphServer(s, *api.NewImplementedGraphServer(gr))
	api.RegisterNodeServer(s, *api.NewImplementedNodeServer(gr))

	go func() {
		log.Printf("server listening at %v", lis.Addr())
		if err := s.Serve(lis); err != nil {
			log.Fatalf("failed to serve: %v", err)
		}
	}()

	waitSigInt()
	s.GracefulStop()
}

func waitSigInt() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
}
