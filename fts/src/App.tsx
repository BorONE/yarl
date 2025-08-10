import { useState, useCallback, useRef } from 'react';
import {
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

import JobNode from './JobNode';

import * as client from './client'

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

import { Syncer } from './syncer';
import { buildNode, isReady } from './misc';

const fitViewOptions: FitViewOptions = {};
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: false,
};

var syncer = new Syncer()

function Flow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  syncer.setNodes = setNodes
  syncer.setEdges = setEdges
  syncer.sync()

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
        return addEdge({...connection, animated: !isReady(node?.data.state)}, eds)
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
 
  const newGraph = useCallback(async () => await client.graph.new({}), [setNodes, setEdges])
  const saveGraph = useCallback(async () => await client.graph.save({Path: graphPathRef.current.value}), [])
  const loadGraph = useCallback(async () => await client.graph.load({Path: graphPathRef.current.value}), [])
  
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

  var graphPathRef = useRef(null)

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
                    ref={graphPathRef}
                    placeholder='yarl.proto.txt'
                    defaultValue={"yarl.proto.txt"}
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
            {
              nodes.filter((nd) => nd.selected).length == 0
                ? <></>
                : <>
                  <ResizableHandle/>
                  <ResizablePanel>
                    <Sidebar nodes={nodes} setNodes={setNodes}/>
                  </ResizablePanel>
                </>
            }
          </ResizablePanelGroup>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default Flow;
