import * as client from './client'
import {
    type Edge,
} from '@xyflow/react';
import * as config from './gen/internal/graph/config_pb'
import { buildNode } from './misc';
import type { Node } from './JobNode';
import { canonizeConnection, convertEdgeToConnection } from './util';

import { toast } from "sonner"


enum SyncerState {
  init = 0,
  sync = 1,
}

function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function backoff(index: number) {
  const msSecond = 1000
  var msBackoffs = [1, 2, 5, 10, 15, 30].map(s => s * msSecond)
  var msMaxBackoff = 60 * msSecond
  return timeout(index < msBackoffs.length ? msBackoffs[index] : msMaxBackoff)
}

export class StableSyncer {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>> = nds => nds
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = eds => eds

  async sync() {
    for (var tryNumber = 0; ; tryNumber += 1) {
      try {
        const syncer = new Syncer()
        syncer.setNodes = this.setNodes
        syncer.setEdges = this.setEdges
        await syncer.sync()
      } catch (err) {
        const error = err as Error
        console.error('sync::exception', err)
        toast(`Sync exception #${tryNumber} "${error.name}"`, { description: error.message })
        await backoff(tryNumber)
      }
    }
  }
};

export class Syncer {
  state = SyncerState.init
  initialGraph : { nodes: Node[], edges: Edge[] } = { nodes: [], edges: [] }
  stream = client.graph.sync({})
  
  setNodes: React.Dispatch<React.SetStateAction<Node[]>> = nds => nds
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = eds => eds

  async sync() {
    for await (const update of this.stream) {
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
        const source = this.initialGraph.nodes.find(node => node.data.id == edge.FromNodeId) as Node
        const target = this.initialGraph.nodes.find(node => node.data.id == edge.ToNodeId) as Node
        this.initialGraph.edges.push(convertEdgeToConnection(edge, source, target))
        break
      }
      case config.SyncType.InitDone: {
        console.log('sync::init', this.initialGraph)
        this.state = SyncerState.sync
        this.setNodes((_) => this.initialGraph.nodes)
        this.setEdges((_) => this.initialGraph.edges)
        break
      }
    }
  }
  
  handleSync(update: config.SyncResponse) {
    console.log('sync::update', update)
    switch (update.Type) {
      case config.SyncType.UpdateState: {
        this.setNodes((nds: Node[]) => nds.map((nd) => update.NodeState?.Id == BigInt(nd.id) ? buildNode(nd.data.config, update.NodeState, nd.selected) : nd))
        this.setEdges((eds: Edge[]) => eds.map((ed) => update.NodeState?.Id == BigInt(ed.source) ? canonizeConnection(ed, update.NodeState) : ed))
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
      case config.SyncType.Error: {
        toast("Error", { description: update.Error["error"] })
      }
    }
  }

};
