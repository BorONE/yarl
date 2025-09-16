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
  type Viewport,
  useReactFlow,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Sidebar, { defaultJobInfo } from './Sidebar';

import JobNode, { type Node } from './JobNode';

import * as client from './client'

import * as config from './gen/internal/graph/config_pb'
import { create } from '@bufbuild/protobuf';
import { NodeConfigSchema, NodeStateSchema } from './gen/internal/graph/config_pb';
import { anyPack } from '@bufbuild/protobuf/wkt';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { canonizeConnection, convertConnectionToEdge } from './util';

import { Syncer } from './syncer';
import { buildNode, getBorderColor } from './misc';
import Menubar from './Menubar';

import Cookies from 'universal-cookie';

const fitViewOptions: FitViewOptions = {};
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: false,
};

var syncer = new Syncer()
const nodeInitSize = {x: 100, y: 30}

function InternalFlow() {
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

  const connect = (connection: Connection) => {
    const source = nodes.find(node => node.id == connection.source) as Node
    const target = nodes.find(node => node.id == connection.target) as Node
    client.graph.connect(convertConnectionToEdge(connection, source, target))
    setEdges((eds) => {
      const input = nodes.find(nd => nd.id == connection.source)
      return addEdge(canonizeConnection(connection, input?.data.state), eds)
    })
  }

  const onConnect: OnConnect = useCallback(
    async (connection) => {
      const isValidConnection = (connection.sourceHandle === null) == (connection.targetHandle === null)
      if (!isValidConnection) {
        return
      }
      connect(connection)
    },
    [nodes, setEdges],
  );
  const onDisconnect = useCallback(
    async (connection: Edge) => {
      const source = nodes.find(node => node.id == connection.source) as Node
      const target = nodes.find(node => node.id == connection.target) as Node
      client.graph.disconnect(convertConnectionToEdge(connection, source, target))
      setEdges((eds) => eds.filter((ed) => ed != connection))
    },
    [nodes, setEdges],
  );

  const refReactFlow = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow();

  const addNewNodeByButton = useCallback(async (vieport: Viewport) => {
    const rect = refReactFlow.current?.getBoundingClientRect() as DOMRect
    return addNewNode({
      x: (-vieport.x + rect.width / 2) / vieport.zoom - nodeInitSize.x / 2,
      y: (-vieport.y + rect.height / 2) / vieport.zoom - nodeInitSize.y / 2
    })
  }, [setNodes]);

  const addNewNode = useCallback(async (pos: { x: number, y: number }) => {
    const snap = (value: number) => Math.round(value / 10) * 10
    var config = create(NodeConfigSchema, {
      Name: "",
      Job: anyPack(defaultJobInfo.schema, defaultJobInfo.init),
      Position: { X: snap(pos.x), Y: snap(pos.y) },
    })
    const response = await client.node.add(config);
    config.Id = response.Id

    const state = create(NodeStateSchema, {
      Id: response.Id,
      State: { case: "Idle", value: { IsReady: true } },
    })

    setNodes((nds) => [...nds.map(nd => ({...nd, selected: false})), buildNode(config, state, true)]);
    return response.Id
  }, [setNodes]);

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
          <ResizablePanelGroup direction="horizontal" onLayout={(layout: number[]) => new Cookies(null).set('layout', layout)}>
            <ResizablePanel defaultSize={layout[0]}>
              <Menubar addNewNode={addNewNodeByButton} />
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgesDelete={(edges: Edge[]) => edges.map((edge) => onDisconnect(edge))}
                onNodesDelete={onNodesDelete}
                onNodeDragStop={(_event: React.MouseEvent, _node: Node, nodes: Node[]) => {
                  nodes.forEach(node => {
                    node.data.config.Position = create(config.PositionSchema, { X: node.position.x, Y: node.position.y })
                    client.node.edit(node.data.config)
                  })
                }}
                nodeTypes={{JobNode}}
                fitView
                fitViewOptions={fitViewOptions}
                defaultEdgeOptions={defaultEdgeOptions}
                snapToGrid
                snapGrid={[10, 10]}
                ref={refReactFlow}
                onConnectEnd={async (event, connectionState) => {
                  if (!connectionState.isValid) {
                    const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
                    const flowPos = screenToFlowPosition({ x: clientX, y: clientY })
                    const spawnPos = connectionState.fromPosition == 'left'
                      ? {x: flowPos.x - nodeInitSize.x, y: flowPos.y - 10}
                      : {x: flowPos.x, y: flowPos.y - 10}
                    const id = await addNewNode(spawnPos)
                    const ends = [connectionState.fromNode?.id as string, id.toString()]
                    const [source, target] = connectionState.fromPosition == 'left' ? ends.reverse() : ends
                    connect({ source: source, target: target, sourceHandle: null, targetHandle: null })
                  }
                }}
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
    </div>
  );
}

function Flow() {
  return (
    <div className="providerflow">
      <ReactFlowProvider>
        <InternalFlow />
      </ReactFlowProvider>
    </div>
  )
}

export default Flow;
