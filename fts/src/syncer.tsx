import * as client from './client'
import {
    type Node,
    type Edge,
} from '@xyflow/react';
import * as config from './gen/internal/graph/config_pb'
import { buildNode, isReady } from './misc';

enum SyncerState {
  init = 0,
  sync = 1,
}

export class Syncer {
  state = SyncerState.init
  initialGraph : { nodes: Node[], edges: Edge[] } = { nodes: [], edges: [] }
  stream = client.graph.sync({})
  
  setNodes: React.Dispatch<React.SetStateAction<Node[]>> = nds => nds
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = eds => eds

  async sync() {
    for await (const update of this.stream) {
      console.log(update)
      switch (this.state) {
      case SyncerState.init:
        this.handleInit(update)
        break
      case SyncerState.sync:
        this.handleSync(update)
        break
      }
    }
  }

  handleInit(update: config.SyncResponse) {
    switch (update.Type) {
      case config.SyncType.InitNode: {
        const config : config.NodeConfig = update.NodeConfig
        const state : config.NodeState = update.NodeState
        this.initialGraph.nodes.push(buildNode(config, state))
        break
      }
      case config.SyncType.InitEdge: {
        const edge : config.EdgeConfig = update.EdgeConfig
        const state : config.NodeState = this.initialGraph.nodes.map(node => node.data.state).find((state) => state.Id == BigInt(edge.FromNodeId));
        this.initialGraph.edges.push({
          id: `${edge.FromNodeId}-${edge.ToNodeId}`,
          source: `${edge.FromNodeId}`,
          target: `${edge.ToNodeId}`,
          animated: !isReady(state),
        })
        break
      }
      case config.SyncType.InitDone: {
        this.state = SyncerState.sync
        this.setNodes((_) => this.initialGraph.nodes)
        this.setEdges((_) => this.initialGraph.edges)
        break
      }
    }
  }
  
  handleSync(update: config.SyncResponse) {
    switch (update.Type) {
      case config.SyncType.UpdateState: {
        this.setNodes((nds: Node[]) => nds.map((nd) => update.NodeState?.Id == BigInt(nd.id) ? buildNode(nd.data.config, update.NodeState, nd.selected) : nd))
        this.setEdges((eds: Edge[]) => eds.map((ed) => update.NodeState?.Id == BigInt(ed.source) ? { ...ed, animated: !isReady(update.NodeState) } : ed))
        break
      }
      case config.SyncType.Reset: {
        this.initialGraph = { nodes: [], edges: [] }
        this.setNodes((_) => []);
        this.setEdges((_) => []);
        this.state = SyncerState.init
        this.stream = client.graph.sync({})
        break
      }
    }
  }

};
