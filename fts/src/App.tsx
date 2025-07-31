import { useState, useCallback } from 'react';
import {
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type FitViewOptions,
  type OnConnect,
  type OnNodesDelete,
  type OnNodesChange,
  type OnEdgesChange,
  type DefaultEdgeOptions,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Sidebar from './Sidebar';

import JobNode from './Node';

import * as client from './client'

import * as api from './gen/internal/api/api_pb'
import * as config from './gen/internal/graph/config_pb'
import { create, toBinary } from '@bufbuild/protobuf';
import { NodeConfigSchema, NodeStateSchema, type Config } from './gen/internal/graph/config_pb';
import { ShellCommandConfigSchema } from './gen/internal/job/register/shell_pb';
import { AnySchema } from '@bufbuild/protobuf/wkt';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"


const fitViewOptions: FitViewOptions = {
  padding: 0.2,
};
 
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: false,
};


const applyUpdates = (nds: Node[], updates: api.Updates) => {
  return nds.map((nd) => {
    const state = updates.NodeStates.find((state) => state.Id == nd.data.id);
    return state ? { ...nd, data: { ...nd.data, state }} : nd;
  })
}

const applyUpdatesEdges = (eds: Edge[], updates: api.Updates) => {
  return eds.map((ed) => {
    const state = updates.NodeStates.find((state) => state.Id == BigInt(ed.source));
    return state ? { ...ed, animated: !(state.State.case == "Done" && !state.State.value.Error) } : ed;
  })
}

type Hooks = {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>> | null,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>> | null,
}

var hooks : Hooks = {
  setNodes: null,
  setEdges: null,
}

const graphConfig = await client.graph.getConfig({})
const graphState = await client.graph.collectState({})

const initialNodes: Node[] = graphConfig.Nodes.map((config) => ({
  id: `${config.Id}`,
  type: 'JobNode',
  position: { x: 100, y: 0 },
  data: {
    id: config.Id,
    config,
    hooks,
  },
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  width: 103,
  height: 70,
}))

const initialEdges: Edge[] = graphConfig.Edges.map((edge) => ({
  id: `${edge.FromNodeId}-${edge.ToNodeId}`,
  source: `${edge.FromNodeId}`,
  target: `${edge.ToNodeId}`
}))

function Flow() {
  const [nodes, setNodes] = useState<Node[]>(applyUpdates(initialNodes, graphState));
  const [edges, setEdges] = useState<Edge[]>(applyUpdatesEdges(initialEdges, graphState));

  hooks.setNodes = setNodes
  hooks.setEdges = setEdges

  const onUpdates = useCallback(
    (updates: api.Updates) => {
      setNodes((nds) => applyUpdates(nds, updates))
      setEdges((eds) => applyUpdatesEdges(eds, updates))
    },
    [setNodes, setEdges],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  );
  const onNodesDelete: OnNodesDelete = useCallback(
    (changes) => {
      changes.forEach((node) => client.node.delete({Id: BigInt(node.id)}))
      setNodes((nds) => applyNodeChanges(changes.map((node) => ({ id: node.id, type: 'remove' })), nds))
    },
    [setNodes],
  );
  
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );
  const onConnect: OnConnect = useCallback(
    async (connection) => {
      const updates = await client.graph.connect({ FromNodeId: BigInt(connection.source), ToNodeId: BigInt(connection.target) })
      setEdges((eds) => addEdge(connection, eds))
      onUpdates(updates)
    },
    [setEdges, setNodes],
  );
  const onDisconnect = useCallback(
    async (connection: Edge) => {
      const updates = await client.graph.disconnect({ FromNodeId: BigInt(connection.source), ToNodeId: BigInt(connection.target) })
      setEdges((eds) => eds.filter((ed) => ed != connection))
      onUpdates(updates)
    },
    [setEdges, setNodes],
  );
 
  const newGraph = useCallback(async () => {
    await client.graph.new({});
    setNodes((_) => [])
    setEdges((_) => [])
  }, [setNodes, setEdges])
  
  const spawnNode = useCallback(async (config: config.NodeConfig, state: config.NodeState) => {
    const node : Node = {
      id: `${config.Id}`,
      type: 'JobNode',
      position: { x: 100, y: 0 },
      data: {
        id: config.Id,
        config,
        state,
        hooks: { setNodes, setEdges },
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      width: 103,
      height: 70,
    };

    setNodes((nds) => [...nds, node]);
  }, [nodes])

  const addNewNode = useCallback(async () => {
    const job = toBinary(ShellCommandConfigSchema, create(ShellCommandConfigSchema, { Command: 'echo "Hello, YaRL!"' }))
    var config = create(NodeConfigSchema, {
      Name: `Node`,
      Job: create(AnySchema, {
        typeUrl: "type.googleapis.com/register.ShellCommandConfig",
        value: job,
      })
    })
    const response = await client.node.add(config);
    config.Id = response.Id

    const state = create(NodeStateSchema, {
      Id: response.Id,
      State: { case: "Idle", value: { IsReady: true } },
    })

    spawnNode(config, state)
  }, [nodes]);

  const runAll = async () => {
    while (true) {
      const id = await client.graph.runReadyNode({})
      if (id.Id == 0n) {
        break
      }
      const inProgressState : config.NodeState_InProgressState = {Status: config.NodeState_InProgressState_InProgressStatus.Running}
      const update = create(config.NodeStateSchema, { Id: id.Id, State: { case: "InProgress", value: inProgressState } })
      onUpdates(create(api.UpdatesSchema, {NodeStates: [update]}))
      client.node.waitDone(id).then(onUpdates)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#CCC' }}>
      <div className="providerflow" style={{ height: '100vh' }}>
        <ReactFlowProvider>

        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgesDelete={(edges: Edge[]) => edges.map((edge) => onDisconnect(edge))}
              onNodesDelete={onNodesDelete}
              nodeTypes={{JobNode}}
              fitView
              fitViewOptions={fitViewOptions}
              defaultEdgeOptions={defaultEdgeOptions}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
            <button onClick={newGraph}>
              New Graph
            </button>
            <button onClick={addNewNode}>
              Add New Node
            </button>
            <button onClick={runAll}>
              Run All
            </button>
            <Sidebar
              nodes={nodes}
              setNodes={setNodes}
              style={{}}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default Flow;
