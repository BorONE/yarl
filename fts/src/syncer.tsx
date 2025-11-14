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

export class StableSyncer {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>> = nds => nds
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = eds => eds
  
  syncer : Syncer | null = null
  wasSynced : boolean = false

  async sync() {
    const msSecond = 1000
    const msBackoffs = [1, 2, 5, 10, 1].map(s => s * msSecond)
    const rounds = msBackoffs.map((backoff, i) => ({number: i + 1, backoff}))
    for (let i = 0; i < rounds.length; ++i) {
      const round = rounds[i]
      try {
        this.syncer = new Syncer()
        this.syncer.setNodes = this.setNodes
        this.syncer.setEdges = this.setEdges
        await this.syncer.sync()
        this.wasSynced = true
        this.syncer = null
      } catch (err) {
        console.error('sync::exception', err)
        toast(`Sync exception #${round.number}`, { description: `${err}` })
        await timeout(round.backoff)
      }
    }
    toast("Sync restarts are exhausted", { description: "Reload page to sync with backend again" })
  }

  isInited() {
    return this.wasSynced || this.isSynced()
  }

  isSynced() {
    return this.syncer ? this.syncer.isInited() : false
  }
};

export class Syncer {
  state = SyncerState.init
  initialGraph : { nodes: Node[], edges: Edge[] } = { nodes: [], edges: [] }
  stream = client.graph.sync({})
  isInited_ : boolean = false
  
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
        this.isInited_ = true
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

  isInited() {
    return this.isInited_
  }
};
