import { NodeData, NodeUpdate } from '../types/types';

// Mock backend API
export const fetchNodeTypes = async (): Promise<NodeType[]> => {
  console.log("Fetching node types from backend");
  return [
    { id: 'bash', name: 'Bash Script', properties: { color: '#38bdf8' } },
    { id: 'python', name: 'Python Script', properties: { color: '#fbbf24' } },
  ];
};

// Report new node to backend
export const reportNewNode = async (node: any): Promise<NodeUpdate[]> => {
  console.log("Reporting new node to backend:", node);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Node reported successfully");
      
      // Simulate backend returning updates
      const updates: NodeUpdate[] = [
        {
          nodeId: node.id,
          updates: {
            status: 'default',
            lastReported: new Date().toISOString()
          }
        },
        // Could update other nodes too
      ];
      
      resolve(updates);
    }, 300);
  });
};

// Report new edge to backend
export const reportNewEdge = async (edge: any): Promise<NodeUpdate[]> => {
  console.log("Reporting new edge to backend:", edge);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Edge reported successfully");
      
      // Simulate backend returning updates
      const updates: NodeUpdate[] = [
        {
          nodeId: edge.source,
          updates: {
            connections: `Connected to ${edge.target}`,
            lastConnected: new Date().toISOString()
          }
        },
        {
          nodeId: edge.target,
          updates: {
            connections: `Connected from ${edge.source}`,
            lastConnected: new Date().toISOString()
          }
        }
      ];
      
      resolve(updates);
    }, 300);
  });
};

// Launch a single node and return updates
export const launchNode = async (
  nodeId: string, 
  nodeData: NodeData,
  allNodes: NodeData[] // Pass all nodes for context
): Promise<NodeUpdate[]> => {
  console.log(`Launching node ${nodeId} with data:`, nodeData);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3;
      console.log(`Node ${nodeId} launch ${isSuccess ? 'succeeded' : 'failed'}`);
      
      const updates: NodeUpdate[] = [];
      
      // Update the launched node
      updates.push({
        nodeId,
        updates: {
          status: isSuccess ? 'success' : 'error',
          lastRun: new Date().toISOString(),
          ...(isSuccess && { output: `output-from-${nodeId}` })
        }
      });
      
      // Example: Find connected nodes and update them
      if (isSuccess) {
        // Randomly select some nodes to update
        const nodesToUpdate = allNodes
          .filter(n => n.id !== nodeId)
          .filter(() => Math.random() > 0.5);
        
        nodesToUpdate.forEach(node => {
          updates.push({
            nodeId: node.id,
            updates: {
              status: 'default',
              input: `output-from-${nodeId}`,
              lastUpdated: new Date().toISOString()
            }
          });
        });
      }
      
      resolve(updates);
    }, 1000);
  });
};

// Global launch returns updates for multiple nodes
export const launchGlobal = async (
  allNodes: NodeData[]
): Promise<NodeUpdate[]> => {
  console.log("Global launch with nodes:", allNodes);
  
  return new Promise((resolve) => {
    // Create initial updates for running state
    const updates: NodeUpdate[] = allNodes.map(node => ({
      nodeId: node.id,
      updates: { status: 'running' }
    }));
    
    // Simulate processing delay
    setTimeout(() => {
      // Add final status updates
      allNodes.forEach(node => {
        const isSuccess = Math.random() > 0.3;
        updates.push({
          nodeId: node.id,
          updates: {
            status: isSuccess ? 'success' : 'error',
            lastRun: new Date().toISOString(),
            ...(isSuccess && { output: `output-from-${node.id}` })
          }
        });
      });
      
      resolve(updates);
    }, 1000);
  });
};

// Types for this file
interface NodeType {
  id: string;
  name: string;
  properties: Record<string, any>;
}