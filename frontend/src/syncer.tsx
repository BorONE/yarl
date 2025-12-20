import * as client from './client'
import {
    type Edge,
} from '@xyflow/react';
import * as config from './gen/internal/graph/config_pb'
import { buildNode } from './misc';
import type { Node } from './JobNode';
import { canonizeConnection, convertConfigToEdge } from './util';

import { toast } from "sonner"


enum SyncerState {
  init = 0,
  sync = 1,
}

export class Syncer {
  state = SyncerState.init
  initialGraph : { nodes: Node[], edges: Edge[] } = { nodes: [], edges: [] }
  isInited : boolean = false
  
  setNodes: React.Dispatch<React.SetStateAction<Node[]>> = nds => nds
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = eds => eds

  async sync() {
    try {
      for await (const update of client.graph.sync({})) {
        switch (this.state) {
        case SyncerState.init:
          this.handleInit(update)
          break
        case SyncerState.sync:
          this.handleSync(update)
          break
        }
      }
    } catch (err) {
      console.error('sync::exception', err)
      toast(`Sync exception`, { description: `${err}` })
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
        const config = update.EdgeConfig as config.EdgeConfig
        const source = this.initialGraph.nodes.find(node => node.data.id == config.FromNodeId)
        const target = this.initialGraph.nodes.find(node => node.data.id == config.ToNodeId)
        const edge = convertConfigToEdge(config, source, target)
        this.initialGraph.edges.push(edge)
        break
      }
      case config.SyncType.InitDone: {
        console.log('sync::init', this.initialGraph)
        this.isInited = true
        this.state = SyncerState.sync
        this.setNodes(this.initialGraph.nodes)
        this.setEdges(this.initialGraph.edges)
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
        this.setNodes([])
        this.setEdges([])
        this.state = SyncerState.init
        break
      }
      case config.SyncType.Error: {
        toast("Error", { description: update.Error["error"] })
      }
    }
  }
};
