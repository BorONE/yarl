package api

import (
	context "context"
	"io"
	"os"
	"pipegraph/internal/graph"

	"google.golang.org/protobuf/encoding/prototext"
)

type GraphHolder struct {
	*graph.Graph
}

func (holder *GraphHolder) New(ctx context.Context) error {
	holder.Graph = graph.NewGraph(&graph.Config{})
	return nil
}

func (holder *GraphHolder) Load(ctx context.Context, path *Path) error {
	file, err := os.Open(path.GetPath())
	if err != nil {
		return err
	}

	fileData, err := io.ReadAll(file)
	if err != nil {
		return err
	}

	config := &graph.Config{}
	err = prototext.Unmarshal(fileData, config)
	if err != nil {
		return err
	}

	holder.Graph = graph.NewGraph(config)
	return nil
}

func (holder *GraphHolder) Save(ctx context.Context, path *Path) error {
	file, err := os.Create(path.GetPath())
	if err != nil {
		return err
	}

	marshalled, err := prototext.MarshalOptions{Multiline: true}.Marshal(holder.Config)
	if err != nil {
		return err
	}

	_, err = file.Write(marshalled)
	if err != nil {
		return err
	}

	return nil
}
