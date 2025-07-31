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
  type OnNodeDrag,
  type DefaultEdgeOptions,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Sidebar from './Sidebar';

import JobNode from './Node';

import * as client from './client'

// import { Node as apiNode, Graph as apiGraph } from './gen/internal/api/api_pb';
import * as api from './gen/internal/api/api_pb'
import * as config from './gen/internal/graph/config_pb'
import { create, toBinary } from '@bufbuild/protobuf';
import { NodeConfigSchema, NodeStateSchema, type Config } from './gen/internal/graph/config_pb';
import { ShellCommandConfigSchema } from './gen/internal/job/register/shell_pb';
import { AnySchema } from '@bufbuild/protobuf/wkt';
import { ConnectError } from '@connectrpc/connect';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"


const fitViewOptions: FitViewOptions = {
  padding: 0.2,
};
 
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: true,
};
 
const onNodeDrag: OnNodeDrag = (_, node) => {
  // console.log('drag event', node.data);
};

const nodeTypes = {
  JobNode
};

const graphConfig = await client.graph.getConfig({})
const graphState = await client.graph.collectState({})

const applyUpdates = (nds: Node[], updates: api.Updates) => {
  return nds.map((nd) => {
    const state = updates.NodeStates.find((state) => state.Id == nd.data.id);
    return state ? { ...nd, data: { ...nd.data, state }} : nd;
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

const initialNodesWithoutStates: Node[] = graphConfig.Nodes.map((config) => ({
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

const initialNodes: Node[] = applyUpdates(initialNodesWithoutStates, graphState)
const initialEdges: Edge[] = graphConfig.Edges.map((edge) => ({
  id: `${edge.FromNodeId}-${edge.ToNodeId}`,
  source: `${edge.FromNodeId}`,
  target: `${edge.ToNodeId}`
}))
// setNodes((nds) => applyUpdates(nds, graphState))

function Flow() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  hooks.setNodes = setNodes
  hooks.setEdges = setEdges

  // setNodes((nds) => nds.map((nd) => ({
  //   ...nd,
  //   data: {
  //     ...nd.data,
  //     hooks: { setNodes, setEdges },
  //   }
  // })))
 
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
      setNodes((nds) => applyUpdates(nds, updates))
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges, setNodes],
  );
  const onDisconnect = useCallback(
    async (connection: Edge) => {
      const updates = await client.graph.disconnect({ FromNodeId: BigInt(connection.source), ToNodeId: BigInt(connection.target) })
      setNodes((nds) => applyUpdates(nds, updates))
      setEdges((eds) => eds.filter((ed) => ed != connection))
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
    // const job = toBinary(ShellCommandConfigSchema, create(ShellCommandConfigSchema, { Command: "[[ 0 == 1 ]]" }))
    // const job = toBinary(ShellCommandConfigSchema, create(ShellCommandConfigSchema, { Command: "sleep 5" }))
    // const job = toBinary(ShellCommandConfigSchema, create(ShellCommandConfigSchema, { Command: "echo \"hello world\"" }))
    var config = create(NodeConfigSchema, {
      Name: `Node`,
      // Name: `Node ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Date.now() % 26]}`,
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
      setNodes((nds: Node[]) => applyUpdates(nds, create(api.UpdatesSchema, {NodeStates: [update]})))
      client.node.waitDone(id).then((updates) => setNodes((nds: Node[]) => applyUpdates(nds, updates)))
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#CCC' }}>
      <div style={{ height: '45px' }}>
        <button onClick={newGraph}>
          New Graph
        </button>

        <button onClick={addNewNode}>
          Add New Node
        </button>

        <button onClick={runAll}>
          Run All
        </button>
      </div>
        
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
              onNodeDrag={onNodeDrag}
              onNodesDelete={onNodesDelete}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={fitViewOptions}
              defaultEdgeOptions={defaultEdgeOptions}
              // style={{ width: '50vw' }}
              // style={{ background: '#c9f1dd' }}
            />
            
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
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
