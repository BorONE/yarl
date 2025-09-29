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

	ctx    context.Context
	cancel context.CancelFunc

	CurrentPath string
}

func (holder *GraphHolder) New(ctx context.Context) error {
	holder.resetGraph(&graph.Config{})
	holder.CurrentPath = "yarl.proto.txt"
	return nil
}

func (holder *GraphHolder) Load(ctx context.Context, path string) error {
	file, err := os.Open(path)
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

	holder.resetGraph(config)
	holder.CurrentPath = path
	return nil
}

func (holder *GraphHolder) SaveCurrent(ctx context.Context) error {
	return holder.Save(ctx, holder.CurrentPath)
}

func (holder *GraphHolder) Save(ctx context.Context, path string) error {
	file, err := os.Create(path)
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

	holder.CurrentPath = path
	return nil
}

func (holder *GraphHolder) resetGraph(config *graph.Config) {
	if holder.Graph != nil {
		holder.cancel()
	}
	holder.ctx, holder.cancel = context.WithCancel(context.Background())
	holder.Graph = graph.NewGraph(config, holder.ctx)
	holder.Graph.ReportSync(&graph.SyncResponse{Type: graph.SyncType_Reset.Enum()})
	generateInit(holder.Graph, holder.Graph.ReportSync)
}
