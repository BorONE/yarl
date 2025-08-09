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
}

func (holder *GraphHolder) New(ctx context.Context) error {
	holder.resetGraph(&graph.Config{})
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

	holder.resetGraph(config)
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

func (holder *GraphHolder) resetGraph(config *graph.Config) {
	if holder.Graph != nil {
		holder.Graph.ReportSync(&graph.SyncResponse{Type: graph.SyncType_Reset.Enum()})
		holder.cancel()
	}
	holder.ctx, holder.cancel = context.WithCancel(context.Background())
	holder.Graph = graph.NewGraph(config, holder.ctx)
	holder.Graph.ReportSync(&graph.SyncResponse{Type: graph.SyncType_Reset.Enum()})
	generateInit(holder.Graph, holder.Graph.ReportSync)
}
