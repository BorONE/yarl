package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/signal"

	"pipegraph/config"
	"pipegraph/graph"
	_ "pipegraph/server"
	"pipegraph/server/api"

	_ "pipegraph/job/register"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/prototext"
)

func main() {
	file, err := os.Open("graph.proto.txt")
	if err != nil {
		log.Fatal(err)
	}

	fileData, err := io.ReadAll(file)
	if err != nil {
		log.Fatal(err)
	}

	graphConfig := &config.Graph{}
	err = prototext.Unmarshal(fileData, graphConfig)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Print(prototext.Format(graphConfig))

	gr := graph.NewGraph(graphConfig)

	lis, err := net.Listen("tcp", ":9000")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	api.RegisterGraphServer(s, *api.NewImplementedGraphServer(gr))
	log.Printf("server listening at %v", lis.Addr())
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
	// s := server.NewServer(gr)
	//
	// log.Println("listening on port 8080...")
	// go s.ListenAndServe()
	//
	// waitSigInt()
	//
	// s.Shutdown()
}

func waitSigInt() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
}
