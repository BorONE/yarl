import { useState, useCallback, useRef } from 'react';
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

import JobNode from './Node2';
import { nodeInitParams } from './Node2';

import * as client from './client'

import * as api from './gen/internal/api/api_pb'
import * as config from './gen/internal/graph/config_pb'
import { create } from '@bufbuild/protobuf';
import { NodeConfigSchema, NodeStateSchema } from './gen/internal/graph/config_pb';
import { ShellCommandConfigSchema } from './gen/internal/job/register/shell_pb';
import { AnySchema } from '@bufbuild/protobuf/wkt';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { createBinary } from './util';
import { Input } from './components/ui/input';


const fitViewOptions: FitViewOptions = {
  // padding: 0.2,
};
 
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: false,
};

function getBorderColor(nodeState: config.NodeState) {
  const stateCase = nodeState.State.case;
  const state = nodeState.State.value;
  switch (stateCase) {
  case "Idle":
      return "#D9D9D9"
  case "InProgress":
      return "#5773E4"
  case "Done":
      if (state.IsStopped) {
          return "#DD5274"
      } else if (state.Error) {
          return "#DD5274"
      } else {
          return "#6DDD52"
      }
  }
  return "#D9D9D9"
}

const applyUpdates = (nds: Node[], updates: api.Updates) => {
  return nds.map((nd) => {
    const state = updates.NodeStates.find((state) => state.Id == nd.data.id);
    if (state) {
      const borderColor = getBorderColor(state)
      return { ...nd, data: { ...nd.data, state }, style: { ...nd.style, borderColor} };
    }
    return nd;
  })
}

const applyUpdatesEdges = (eds: Edge[], updates: api.Updates) => {
  return eds.map((ed) => {
    const state = updates.NodeStates.find((state) => state.Id == BigInt(ed.source));
    return state ? { ...ed, animated: !(state.State.case == "Done" && state.State.value.Error == "" && !state.State.value.IsStopped) } : ed;
  })
}

type Hooks = {
  onUpdates: ((updates: api.Updates) => void) | null
}

var hooks : Hooks = {
  onUpdates: null,
}

async function updateGraph() {
  const graphConfig = await client.graph.getConfig({})
  const graphState = await client.graph.collectState({})
  
  const nodes: Node[] = graphConfig.Nodes.map((config) => ({
    id: `${config.Id}`,
    type: 'JobNode',
    position: config.Position ? { x: config.Position.X, y: config.Position.Y } : { x: 0, y: 0 },
    data: {
      id: config.Id,
      config,
      hooks,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    ...nodeInitParams,
  }))

  const edges: Edge[] = graphConfig.Edges.map((edge) => ({
    id: `${edge.FromNodeId}-${edge.ToNodeId}`,
    source: `${edge.FromNodeId}`,
    target: `${edge.ToNodeId}`
  }))
  
  return {
    nodes: applyUpdates(nodes, graphState),
    edges: applyUpdatesEdges(edges, graphState),
  }
}

const initialGraph = await updateGraph()

function Flow() {
  const [nodes, setNodes] = useState<Node[]>(initialGraph.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialGraph.edges);

  const onUpdates = useCallback(
    (updates: api.Updates) => {
      setNodes((nds) => applyUpdates(nds, updates))
      setEdges((eds) => applyUpdatesEdges(eds, updates))
    },
    [setNodes, setEdges],
  );

  hooks.onUpdates = onUpdates

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
      setEdges((eds) => {
        const node = nodes.find(nd => nd.id == connection.source)
        const state : config.NodeState = node?.data.state
        return addEdge({...connection, animated: state && !(state.State.case == "Done" && state.State.value.Error == "" && !state.State.value.IsStopped)}, eds)
      })
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
  
  const saveGraph = useCallback(async () => {
    await client.graph.save({Path: graphRef.current.value});
  }, [])
  
  const loadGraph = useCallback(async () => {
    await client.graph.load({Path: graphRef.current.value});
    const graph = await updateGraph()
    setNodes((_) => graph.nodes)
    setEdges((_) => graph.edges)
  }, [setNodes, setEdges])
  
  const spawnNode = useCallback(async (config: config.NodeConfig, state: config.NodeState) => {
    const node : Node = {
      id: `${config.Id}`,
      type: 'JobNode',
      position: config.Position ? { x: config.Position.X, y: config.Position.Y } : { x: 0, y: 0 },
      data: {
        id: config.Id,
        config,
        state,
        hooks: { setNodes, setEdges },
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      ...nodeInitParams,
    };

    setNodes((nds) => [...nds, node]);
  }, [nodes])

  const addNewNode = useCallback(async () => {
    var config = create(NodeConfigSchema, {
      Name: `Node`,
      Job: create(AnySchema, {
        typeUrl: "type.googleapis.com/register.ShellCommandConfig",
        value: createBinary(ShellCommandConfigSchema, { Command: 'echo "Hello, YaRL!"' }),
      }),
      Position: { X: 0, Y: 0 },
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

  const graphInfo = {Path: "yarl.proto.txt"}
  var graphRef = useRef(null)

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
                onNodeDragStop={(event: React.MouseEvent, node: Node, nodes: Node[]) => {
                  node.data.config.Position = create(config.PositionSchema, { X: node.position.x, Y: node.position.y })
                  client.node.edit(node.data.config)
                }}
                nodeTypes={{JobNode}}
                fitView
                fitViewOptions={fitViewOptions}
                defaultEdgeOptions={defaultEdgeOptions}
                snapToGrid
                snapGrid={[20, 20]}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel>
              <label>Graph</label>
              <button onClick={newGraph}>
                New
              </button>
              <button onClick={saveGraph}>
                Save
              </button>
              <button onClick={loadGraph}>
                Load
              </button>
              <Input
                  id="Graph.Path"
                  ref={graphRef}
                  className='max-w-sm'
                  placeholder='yarl.proto.txt'
                  defaultValue={graphInfo.Path}
              />

              <label>Node</label>
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
