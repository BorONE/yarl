import React, { useState, useCallback } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Background,
  Controls,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './CustomNode';
import GlobalControls from './GlobalControls';
import { NodeType, FlowNode, NodeUpdate } from '../../types/types';
import { reportNewNode, reportNewEdge } from '../../api/backend';
import './FlowEditor.css';

const nodeTypes = {
  custom: CustomNode,
};

// Helper to apply node updates
const applyUpdates = (nodes: FlowNode[], updates: NodeUpdate[]): FlowNode[] => {
  return nodes.map(node => {
    const update = updates.find(u => u.nodeId === node.id);
    if (update) {
      return {
        ...node,
        data: {
          ...node.data,
          ...update.updates
        }
      };
    }
    return node;
  });
};

const FlowEditor: React.FC = () => {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => 
      setNodes((nds) => applyNodeChanges(changes, nds) as FlowNode[]),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => 
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `edge-${Date.now()}`,
        animated: true,
        style: { stroke: '#94a3b8' }
      };
      
      // Update UI immediately
      setEdges((eds) => addEdge(newEdge, eds));
      
      try {
        // Report to backend and get updates
        const updates = await reportNewEdge(newEdge);
        
        // Apply backend updates
        setNodes(prevNodes => applyUpdates(prevNodes, updates));
      } catch (error) {
        console.error("Failed to report edge:", error);
      }
    },
    []
  );

  const addNewNode = async (nodeType: NodeType) => {
    const nodeId = `node-${Date.now()}`;
    const nodeName = `${nodeType.name} ${nodes.length + 1}`;
    
    const newNode: FlowNode = {
      id: nodeId,
      type: 'custom',
      position: { x: 100 + nodes.length * 200, y: 100 },
      data: {
        id: nodeId,
        type: nodeType.id,
        name: nodeName,
        status: 'default',
        launchable: true,
      },
    };
    
    // Update UI immediately
    setNodes((nds) => nds.concat(newNode));
    
    try {
      // Report to backend and get updates
      const updates = await reportNewNode(newNode);
      
      // Apply backend updates
      setNodes(prevNodes => applyUpdates(prevNodes, updates));
    } catch (error) {
      console.error("Failed to report node:", error);
    }
  };

  return (
    <div className="flow-editor">
      <GlobalControls onAddNode={addNewNode} />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

const FlowEditorWrapper = () => (
  <ReactFlowProvider>
    <FlowEditor />
  </ReactFlowProvider>
);

export default FlowEditorWrapper;