import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Edge,
  type FitViewOptions,
  type OnNodesDelete,
  type OnNodesChange,
  type OnEdgesChange,
  type DefaultEdgeOptions,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Connection,
  Controls,
  type OnConnectEnd,
  useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

import { IconNewSection, IconPlugConnected } from "@tabler/icons-react"

import Sidebar, { buildDefaultConfig } from './Sidebar';

import JobNode, { type Node } from './JobNode';

import * as client from './client'

import * as config from './gen/internal/graph/config_pb'
import { create } from '@bufbuild/protobuf';
import { NodeStateSchema } from './gen/internal/graph/config_pb';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { canonizeConnection as canonizeEdge, convertEdgeToConfig, isFileConnection } from './util';

import { Syncer } from './syncer';
import { buildNode, getBorderColor } from './misc';
import Menubar, { DialogType, SharedDialogContent } from './Menubar';

import Cookies from 'universal-cookie';
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider, useTheme } from './ThemeProvider';
import { Button } from './components/ui/button';

import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog"
import * as cp from './CopyPaste';
import { ScrollArea } from "@/components/ui/scroll-area"

const fitViewOptions: FitViewOptions = {};
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: false,
};

var syncer = new Syncer()
const nodeInitSize = { x: 100, y: 30 }

function patchStyle<T extends { style?: React.CSSProperties }>(obj: T, style: React.CSSProperties): T {
  return { ...obj, style: { ...obj.style, ...style } }
}

function InternalFlow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  syncer.setNodes = setNodes
  syncer.setEdges = setEdges

  const [isDesynced, setIsDesynced] = useState(false);
  const resync = async () => {
    setIsDesynced(false)
    await syncer.sync()
    setIsDesynced(true)
  }
  useEffect(() => { resync() }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => {
      nds = applyNodeChanges(changes, nds) as Node[]
      const anySelected = nds.some(nd => nd.selected)
      setEdges(eds => {
        const isSelectedEdge = (ed: Edge) => nds.find(nd => nd.id == ed.source)?.selected || nds.find(nd => nd.id == ed.target)?.selected
        const isOpaque = (ed: Edge) => anySelected ? isSelectedEdge(ed) : !isFileConnection(ed)
        return eds.map(ed => patchStyle(ed, { strokeOpacity: isOpaque(ed) ? 1 : 0.5, }))
      })
      const isOpaque = (nd: Node) => anySelected ? nd.selected : true
      return nds.map(nd => patchStyle(nd, { opacity: isOpaque(nd) ? 1 : 0.5 }))
    }),
    [setNodes],
  );

  const onNodesDelete: OnNodesDelete = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes.map((node) => ({ id: node.id, type: 'remove' })), nds))
      changes.forEach((node) => client.node.delete({Id: BigInt(node.id)}))
    },
    [setNodes],
  );
  
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );

  const onNodeDragStop = (_event: React.MouseEvent, _node: Node, nodes: Node[]) => {
    nodes.forEach(node => {
      node.data.config.Position = create(config.PositionSchema, { X: node.position.x, Y: node.position.y })
      client.node.edit(node.data.config)
    })
  }

  const onConnectEnd : OnConnectEnd = async (event, connectionState) => {
    if (!connectionState.isValid) {
      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY })
      const isFileConnection = connectionState.fromHandle?.id
      if (isFileConnection) {
        return
      }
      const spawnPos = connectionState.fromPosition == 'left'
        ? {x: flowPos.x - nodeInitSize.x, y: flowPos.y - 10}
        : {x: flowPos.x, y: flowPos.y - 10}
      const node = await addNodeAt(spawnPos)
      const ends = [connectionState.fromNode?.id as string, node.data.config.Id.toString()]
      const [source, target] = connectionState.fromPosition == 'left' ? ends.reverse() : ends
      // added node won't be deduced automatically, since it will be added to nodes next render frame
      const input = connectionState.fromPosition == 'left' ? node : undefined
      const edge = { source: source, target: target, sourceHandle: null, targetHandle: null }
      connect(edge, input)
    }
  }

  const getEdgeConfig = (connection: Connection | Edge) => {
    const source = nodes.find(node => node.id == connection.source)
    const target = nodes.find(node => node.id == connection.target)
    return convertEdgeToConfig(connection, source, target)
  }

  const connect = (connection: Connection, input?: Node) => {
    const config = getEdgeConfig(connection)
    client.graph.connect(config)
    setEdges(eds => {
      input = input || nodes.find(nd => nd.id == connection.source)
      const edge = canonizeEdge(connection, input?.data.state)
      return addEdge(edge, eds)
    })
  }

  const onConnect = useCallback(
    async (connection: Connection) => {
      const isValidConnection = (connection.sourceHandle === null) == (connection.targetHandle === null)
      if (isValidConnection) {
        connect(connection)
      }
    },
    [nodes, setEdges],
  );

  const onDisconnect = useCallback(
    async (connection: Edge) => {
      const config = getEdgeConfig(connection)
      await client.graph.disconnect(config)
      setEdges(eds => eds.filter(ed => ed != connection))
    },
    [nodes, setEdges],
  );

  const refReactFlow = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow();

  const viewport = useViewport()

  const addNewNodeInCenter = useCallback(() => {
    const rect = refReactFlow.current?.getBoundingClientRect() as DOMRect
    return addNodeAt({
      x: (-viewport.x + rect.width / 2) / viewport.zoom - nodeInitSize.x / 2,
      y: (-viewport.y + rect.height / 2) / viewport.zoom - nodeInitSize.y / 2
    })
  }, [setNodes, viewport]);

  const deselectAllNodes = () => {
    setNodes((nds) => nds.map(nd => ({...nd, selected: false})));
  }

  const addNode = async (config: Omit<config.NodeConfig, 'Id'>) => {
    const response = await client.node.add({ ...config, Id: BigInt(0) });
    const state = create(NodeStateSchema, {
      Id: response.Id,
      State: { case: "Idle", value: { IsReady: true } },
    })
    const node = buildNode({ ...config, Id: response.Id }, state, true)
    setNodes((nds) => [...nds, node])
    return node
  }

  const addNodeAt = useCallback(async (pos: { x: number, y: number }) => {
    deselectAllNodes()
    const snap = (value: number) => Math.round(value / 10) * 10
    var config = buildDefaultConfig({ Position: { X: snap(pos.x), Y: snap(pos.y) } })
    return await addNode(config)
  }, [setNodes]);

  const isLayout = (obj: any, expectedLenght?: number) => {
    return Array.isArray(obj)
      && (typeof expectedLenght == 'undefined' || obj.length == expectedLenght)
      && obj.every(el => typeof el == 'number' && el >= 0)
      && obj.reduce((r, x) => r + x) == 100
  }

  const layout = (() => {
    const layout = new Cookies(null).get('layout')
    return isLayout(layout, 2) ? layout : [80, 20]
  })()

  const addCopyBuffer = async (buf: cp.CopyBuffer) => {
    deselectAllNodes()
    const nodes = await Promise.all(buf.nodes.map(config => addNode(config)))
    cp.RenderEdges(buf.edges, nodes.map(node => node.data.config.Id.toString()))
      .forEach(conn => connect(conn))
  }
  const anySelected = () => nodes.some(node => node.selected)
  const copyNodes = () => {
    const selectedNodes = nodes.filter(node => node.selected)
    if (selectedNodes.length > 0) {
      cp.IntoClipboard(selectedNodes, edges)
    }
  }
  const pasteNodes = () => cp.FromClipboard().then(buf => addCopyBuffer(buf)) 
  const exportNodes = () => {
    const nodesToExport = anySelected() ? nodes.filter(node => node.selected) : nodes
    const buf = cp.BuildCopyBuffer(nodesToExport, edges, false)
    return btoa(JSON.stringify(buf))
  }
  const verifyImport = (data: string) => {
    try {
      const buf = cp.FromBuffer(atob(data))
      cp.RenderEdges(buf.edges, buf.nodes.map(_ => ''))
      return true
    } catch {
      return false;
    }
  }
  const importNodes = (data: string) => addCopyBuffer(cp.FromBuffer(atob(data)))

  useEffect(() => {
    const keyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey) {
        switch (event.key) {
          case 'n':
            addNewNodeInCenter();
            break
          case 'c':
            copyNodes();
            break
          case 'v':
            pasteNodes()
            break
        }
      }
    }
    document.addEventListener("keydown", keyPress)
    return () => document.removeEventListener("keydown", keyPress)
  })

  const { theme } = useTheme()

  const flow = <ReactFlow
    colorMode={theme}
    nodes={nodes}
    edges={edges}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    onConnect={onConnect}
    onEdgesDelete={async (edges: Edge[]) => await Promise.all(edges.map((edge) => onDisconnect(edge)))}
    onNodesDelete={onNodesDelete}
    onNodeDragStop={onNodeDragStop}
    onConnectEnd={onConnectEnd}
    nodeTypes={{JobNode}}
    fitView
    fitViewOptions={fitViewOptions}
    defaultEdgeOptions={defaultEdgeOptions}
    snapToGrid
    snapGrid={[10, 10]}
    ref={refReactFlow}
  >
    <Background style={{backgroundColor: 'var(--background)'}} variant={BackgroundVariant.Dots} />
    <MiniMap nodeColor={(node: Node) => getBorderColor(node.data.state)} zoomable pannable />
    <Controls style={{ position: 'absolute', bottom: 30 }} />
  </ReactFlow>

  var graphPathRef = useRef<HTMLInputElement>(null)
  const loadGraph = () => client.graph.load({Path: graphPathRef.current?.value})
  
	const [selectedDialog, selectDialog] = useState(DialogType.None)

	const importRef = useRef<HTMLTextAreaElement>(null)

  const emptyFlow = <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <IconNewSection />
      </EmptyMedia>
      <EmptyTitle>Empty graph</EmptyTitle>
      <EmptyDescription>
        You haven't created any nodes yet. Get started by creating node, importing or opening graph.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
		  <Dialog>
        <div className="flex gap-2">
          <Button onClick={() => addNodeAt({ x: 0, y: 0 })}>Create Node</Button>
          <DialogTrigger asChild>
            <Button variant='secondary' onClick={() => selectDialog(DialogType.OpenGraph)}>
              Open
            </Button>
          </DialogTrigger>
          <DialogTrigger asChild>
            <Button variant='secondary' onClick={() => selectDialog(DialogType.ImportNodes)}>
              Import
            </Button>
          </DialogTrigger>
        </div>
        {SharedDialogContent(selectedDialog, {loadGraph, graphPathRef, importRef, verifyImport, importNodes})}
		  </Dialog>
    </EmptyContent>
  </Empty>

  const [showLastState, setShowLastState] = useState(false);
  const resetShowLastState = () => {
    if (showLastState) {
      setShowLastState(false)
    }
  }

  const syncingFlowData = isDesynced ? {
    title: "Desinced",
    description: "Reload page or try to resync using button below",
  } : {
    title: "   Syncing...",
    description: "Connecting to backend and initializing graph",
  }

  const syncingFlow = (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconPlugConnected />
        </EmptyMedia>
        <EmptyTitle>{syncingFlowData.title}</EmptyTitle>
        <EmptyDescription>
          {syncingFlowData.description}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button onClick={() => resync()}>Resync</Button>
          <Button variant='secondary' onClick={() => setShowLastState(true)} disabled={!syncer.isInited}>Show last state</Button>
        </div>
      </EmptyContent>
    </Empty>
  )

  var currentFlow = flow
  if (nodes.length == 0) {
    currentFlow = emptyFlow
  }
  if (!syncer.isInited || isDesynced) {
    currentFlow = showLastState ? currentFlow : syncingFlow
  } else {
    resetShowLastState()
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ResizablePanelGroup direction="horizontal" onLayout={(layout: number[]) => new Cookies(null).set('layout', layout)}>
        <ResizablePanel defaultSize={layout[0]}>
          <Menubar
            anySelected={anySelected}
            verifyImport={verifyImport}
            addNewNode={addNewNodeInCenter}
            copyNodes={copyNodes}
            pasteNodes={pasteNodes}
            exportNodes={exportNodes}
            importNodes={importNodes}
          />
          {currentFlow}
        </ResizablePanel>
        <ResizableHandle/>
        <ResizablePanel defaultSize={layout[1]}>
          <ScrollArea className="h-full">
            <Sidebar nodes={nodes} setNodes={setNodes}/>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function Flow() {
  return (
    <div className="providerflow">
      <ReactFlowProvider>
        <ThemeProvider defaultTheme='system'>
          <InternalFlow />
        </ThemeProvider>
      </ReactFlowProvider>
      <Toaster style={{background: "#DD5274"}} visibleToasts={100} duration={1/0} closeButton />
    </div>
  )
}

export default Flow;
