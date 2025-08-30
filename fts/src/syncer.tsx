import * as client from './client'
import {
    type Edge,
} from '@xyflow/react';
import * as config from './gen/internal/graph/config_pb'
import { buildNode, isReady } from './misc';
import type { Node } from './JobNode';
import { canonizeConnection, convertEdgeToConnection } from './util';

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
        const config = update.NodeConfig as config.NodeConfig
        const state = update.NodeState as config.NodeState
        const node = buildNode(config, state)
        this.initialGraph.nodes.push(node)
        break
      }
      case config.SyncType.InitEdge: {
        const edge = update.EdgeConfig as config.EdgeConfig
        const state = this.initialGraph.nodes
          .map(node => node.data.state)
          .find((state) => state.Id == BigInt(edge.FromNodeId)) as config.NodeState
        this.initialGraph.edges.push(convertEdgeToConnection(edge, state))
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
        this.setEdges((eds: Edge[]) => eds.map((ed) => update.NodeState?.Id == BigInt(ed.source) ? canonizeConnection(ed) : ed))
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
