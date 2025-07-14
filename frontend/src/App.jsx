import { useState, useCallback } from 'react';
import { 
  ReactFlow, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge, 
  Background, 
  Controls
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { 
    id: 'n1', 
    position: { x: 0, y: 0 }, 
    data: { label: 'Node 1' },
    sourcePosition: 'right',
    targetPosition: 'left'
  },
  { 
    id: 'n2', 
    position: { x: 200, y: 0 }, 
    data: { label: 'Node 2' },
    sourcePosition: 'right',
    targetPosition: 'left'
  },
];

const initialEdges = [{ 
  id: 'n1-n2', 
  source: 'n1', 
  target: 'n2',
}];

export default function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback(
    (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const addNode = useCallback(() => {
    const node = {
      id: `${nodes.length + 1}`,
      position: { x: 100, y: 0 },
      data: { label: `Node ${nodes.length + 1}` },
      sourcePosition: 'right',
      targetPosition: 'left'
    };

    setNodes((nodesSnapshot) => [...nodesSnapshot, node]);
  }, [nodes]);

  return (
    <div style={{ width: '100vw', height: '80vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      <button onClick={addNode}>
        Add
      </button>
    </div>
  );
}
