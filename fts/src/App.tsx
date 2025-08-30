import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Edge,
  type FitViewOptions,
  type OnConnect,
  type OnNodesDelete,
  type OnNodesChange,
  type OnEdgesChange,
  type DefaultEdgeOptions,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Sidebar from './Sidebar';

import JobNode, { type Node } from './JobNode';

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
import { convertConnectionToEdge, createBinary } from './util';
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
import { buildNode, getBorderColor, isReady } from './misc';

import Cookies from 'universal-cookie';

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
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds) as Node[]),
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
      const isValidConnection = (connection.sourceHandle === null) == (connection.targetHandle === null)
      if (!isValidConnection) {
        return
      }

      client.graph.connect(convertConnectionToEdge(connection))
      setEdges((eds) => {
        const node = nodes.find(nd => nd.id == connection.source) as Node
        return addEdge({...connection, animated: !isReady(node.data.state)}, eds)
      })
    },
    [nodes, setEdges],
  );
  const onDisconnect = useCallback(
    async (connection: Edge) => {
      client.graph.disconnect(convertConnectionToEdge(connection))
      setEdges((eds) => eds.filter((ed) => ed != connection))
    },
    [setEdges],
  );
 
  const newGraph = useCallback(() => {
    if (graphPathRef.current != null) {
      graphPathRef.current.value = ""
    }
    new Cookies().set('graph-path', "")
    client.graph.new({})
  }, [])
  const saveGraph = useCallback(() => client.graph.save({Path: graphPathRef.current?.value}), [])
  const loadGraph = useCallback(() => client.graph.load({Path: graphPathRef.current?.value}), [])
  
  const addNewNode = useCallback(async () => {
    var config = create(NodeConfigSchema, {
      Name: "",
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

    setNodes((nds) => [...nds.map(nd => ({...nd, selected: false})), buildNode(config, state, true)]);
  }, [setNodes]);

  // var graphPathRef = useRef(null)
  var graphPathRef = useRef<HTMLInputElement>(null)

  const isLayout = (obj: any, expectedLenght?: number) => {
    return Array.isArray(obj)
      && (typeof expectedLenght == 'undefined' || obj.length == expectedLenght)
      && obj.map(el => typeof el == 'number' && el >= 0).reduce((r, x) => r && x)
      && obj.reduce((r, x) => r + x) == 100
  }
  const layout = (() => {
    const layout = new Cookies(null).get('layout')
    return isLayout(layout, 2) ? layout : [85, 15]
  })()

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div className="providerflow">
        <ReactFlowProvider>
          <ResizablePanelGroup direction="horizontal" onLayout={(layout: number[]) => new Cookies(null).set('layout', layout)}>
            <ResizablePanel defaultSize={layout[0]}>
              <Menubar style={{ padding: 0 }}>
                <MenubarMenu>
                  <MenubarTrigger>Graph</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem onSelect={newGraph}>New</MenubarItem>
                    <MenubarItem onSelect={saveGraph}>Save</MenubarItem>
                    <MenubarItem onSelect={loadGraph}>Load</MenubarItem>
                    <MenubarSeparator/>
                    <MenubarItem onSelect={() => client.graph.scheduleAll({})}>Schedule</MenubarItem>
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
                    defaultValue={new Cookies().get('graph-path')}
                    onChange={(change) => new Cookies().set('graph-path', change.currentTarget.value)}
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
                onNodeDragStop={(_event: React.MouseEvent, node: Node, _nodes: Node[]) => {
                  node.data.config.Position = create(config.PositionSchema, { X: node.position.x, Y: node.position.y })
                  client.node.edit(node.data.config)
                }}
                nodeTypes={{JobNode}}
                fitView
                fitViewOptions={fitViewOptions}
                defaultEdgeOptions={defaultEdgeOptions}
                snapToGrid
                snapGrid={[20, 20]}
              >
                <Background variant={BackgroundVariant.Dots} />
                <MiniMap nodeColor={(node: Node) => getBorderColor(node.data.state)} zoomable pannable />
              </ReactFlow>
            </ResizablePanel>
            <ResizableHandle/>
            <ResizablePanel defaultSize={layout[1]}>
              <Sidebar nodes={nodes} setNodes={setNodes}/>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default Flow;
