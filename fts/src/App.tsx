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

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar"

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

function buildNode(config: config.NodeConfig, state: config.NodeState) {
  var node : Node = {
    id: `${config.Id}`,
    type: 'JobNode',
    position: config.Position ? { x: config.Position.X, y: config.Position.Y } : { x: 0, y: 0 },
    data: {
      id: config.Id,
      config,
      state,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    ...nodeInitParams,
  }
  node.style = {
    ...node.style,
    borderColor: getBorderColor(state),
  }
  return node
}

function isReady(state: config.NodeState) {
  return state.State.case == "Done" && state.State.value.Error == "" && !state.State.value.IsStopped
}

async function init(watching : AsyncIterable<api.Update>) {
  var initialGraph: { nodes: Node[], edges: Edge[] } = { nodes: [], edges: [] } 
  for await (const update of watching) {
    switch (update.Type) {
      case api.UpdateType.InitNode: {
        const config : config.NodeConfig = update.NodeConfig
        const state : config.NodeState = update.NodeState
        initialGraph.nodes.push(buildNode(config, state))
        continue
      }

      case api.UpdateType.InitEdge: {
        const edge : config.EdgeConfig = update.EdgeConfig
        const state : config.NodeState = initialGraph.nodes.map(node => node.data.state).find((state) => state.Id == BigInt(edge.FromNodeId));
        initialGraph.edges.push({
          id: `${edge.FromNodeId}-${edge.ToNodeId}`,
          source: `${edge.FromNodeId}`,
          target: `${edge.ToNodeId}`,
          animated: !isReady(state),
        })
        continue
      }

      case api.UpdateType.InitDone: {
        return initialGraph
      }
    }
  }
}

var watching = client.graph.watch({})
const initialGraph = await init(watching)

function Flow() {
  const [nodes, setNodes] = useState<Node[]>(initialGraph.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialGraph.edges);

  const onNodeStateUpdate = useCallback(
    (update: api.Update) => {
      setNodes((nds) => nds.map((nd) => update.NodeState?.Id == BigInt(nd.id) ? buildNode(nd.data.config, update.NodeState) : nd))
      setEdges((eds) => eds.map((ed) => update.NodeState?.Id == BigInt(ed.source) ? { ...ed, animated: !isReady(update.NodeState) } : ed))
    },
    [setNodes, setEdges],
  );

  const follow = async () => {
    for await (const update of watching) {
      switch (update.Type) {
        case api.UpdateType.UpdateState: {
          onNodeStateUpdate(update)
          break
        }
      }
    }
  }

  follow()

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
      client.graph.connect({ FromNodeId: BigInt(connection.source), ToNodeId: BigInt(connection.target) })
      setEdges((eds) => {
        const node = nodes.find(nd => nd.id == connection.source)
        const state : config.NodeState = node?.data.state
        return addEdge({...connection, animated: !isReady(state)}, eds)
      })
    },
    [nodes, setEdges],
  );
  const onDisconnect = useCallback(
    async (connection: Edge) => {
      client.graph.disconnect({ FromNodeId: BigInt(connection.source), ToNodeId: BigInt(connection.target) })
      setEdges((eds) => eds.filter((ed) => ed != connection))
    },
    [setEdges],
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

    setNodes((nds) => [...nds, buildNode(config, state)]);
  }, [setNodes]);

  const runAll = async () => {
    while (((await client.graph.runReadyNode({})).Id) != 0n);
  }

  const graphInfo = {Path: "yarl.proto.txt"}
  var graphRef = useRef(null)

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div className="providerflow">
        <ReactFlowProvider>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel>
              <Menubar style={{ padding: 0 }}>
                <MenubarMenu>
                  <MenubarTrigger>Graph</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem onSelect={newGraph}>New</MenubarItem>
                    <MenubarItem onSelect={saveGraph}>Save</MenubarItem>
                    <MenubarItem onSelect={loadGraph}>Load</MenubarItem>
                    <MenubarSeparator/>
                    <MenubarItem onSelect={runAll}>Run</MenubarItem>
                  </MenubarContent>
                </MenubarMenu><MenubarMenu>
                  <MenubarTrigger>Node</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem onSelect={addNewNode}>New</MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
                <Input
                    id="Graph.Path"
                    ref={graphRef}
                    // className='max-w-sm'
                    placeholder='yarl.proto.txt'
                    defaultValue={graphInfo.Path}
                />
              </Menubar>
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
