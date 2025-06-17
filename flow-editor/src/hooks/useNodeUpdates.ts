import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { NodeData, NodeUpdate } from '../types/types';

export const useNodeUpdates = () => {
  const { setNodes } = useReactFlow<NodeData>();
  
  const applyNodeUpdates = useCallback((updates: NodeUpdate[]) => {
    setNodes(prevNodes => 
      prevNodes.map(node => {
        // Find all updates for this node
        const nodeUpdates = updates.filter(u => u.nodeId === node.id);
        
        // Apply all updates sequentially
        if (nodeUpdates.length > 0) {
          return nodeUpdates.reduce((updatedNode, update) => {
            return {
              ...updatedNode,
              data: {
                ...updatedNode.data,
                ...update.updates
              }
            };
          }, node);
        }
        
        return node;
      })
    );
  }, [setNodes]);
  
  return applyNodeUpdates;
};