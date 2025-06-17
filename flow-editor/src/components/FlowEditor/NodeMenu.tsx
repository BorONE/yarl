import React from 'react';
import { NodeData } from '../../types/types';

interface NodeMenuProps {
  nodeData: NodeData;
  onLaunch: () => void;
  isLaunching: boolean;
}

const NodeMenu: React.FC<NodeMenuProps> = ({ nodeData, onLaunch, isLaunching }) => {
  return (
    <div className="node-menu">
      <div className="node-header">
        <h3 className="node-title">{nodeData.name}</h3>
        <p className="node-type">{nodeData.type.toUpperCase()}</p>
      </div>
      <button 
        onClick={onLaunch} 
        className="launch-btn"
        disabled={
          !nodeData.launchable || 
          nodeData.status === 'running' || 
          isLaunching
        }
      >
        {isLaunching ? 'Launching...' : 'Launch'}
      </button>
    </div>
  );
};

export default NodeMenu;