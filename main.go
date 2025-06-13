package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"pipegraph/config"
	"pipegraph/graph"

	_ "pipegraph/job/register"

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
	gr.Run()
}
