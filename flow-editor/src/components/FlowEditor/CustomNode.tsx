import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { NodeData } from '../../types/types';
import { launchNode } from '../../api/backend';
import NodeMenu from './NodeMenu';
import { useNodeUpdates } from '../../hooks/useNodeUpdates';
import './CustomNode.css';

const CustomNode: React.FC<NodeProps<NodeData>> = ({ id, data }) => {
    const applyNodeUpdates = useNodeUpdates();
    const [isLaunching, setIsLaunching] = React.useState(false);
    const { getNodes } = useReactFlow<NodeData>();

    const handleLaunch = async () => {
        if (!data.launchable) return;

        setIsLaunching(true);

        try {
            const nodes = getNodes();
            const allNodes = nodes.map(node => node.data);

            applyNodeUpdates([{
                nodeId: id,
                updates: { status: 'running' }
            }]);

            const updates = await launchNode(id, data, allNodes);
            applyNodeUpdates(updates);
        } catch (error) {
            console.error(`Error launching node ${id}:`, error);
            applyNodeUpdates([{
                nodeId: id,
                updates: { status: 'error' }
            }]);
        } finally {
            setIsLaunching(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        applyNodeUpdates([{
            nodeId: id,
            updates: { [field]: value }
        }]);
    };

    const getStatusText = () => {
        switch (data.status) {
            case 'running': return 'Processing...';
            case 'success': return 'Completed successfully';
            case 'error': return 'Failed to execute';
            default: return 'Ready to launch';
        }
    };

    // Render node fields based on type
    const renderFields = () => {
        if (data.type === 'bash') {
            return (
                <div className="field-group">
                    <label>Filename</label>
                    <input
                        type="text"
                        value={data.filename || ''}
                        onChange={(e) => handleInputChange('filename', e.target.value)}
                        disabled={data.status === 'running'}
                    />
                </div>
            );
        }

        if (data.type === 'python') {
            return (
                <>
                    <div className="field-group">
                        <label>Filename</label>
                        <input
                            type="text"
                            value={data.filename || ''}
                            onChange={(e) => handleInputChange('filename', e.target.value)}
                            disabled={data.status === 'running'}
                        />
                    </div>
                    <div className="field-group">
                        <label>Environment</label>
                        <input
                            type="text"
                            value={data.environment || ''}
                            onChange={(e) => handleInputChange('environment', e.target.value)}
                            disabled={data.status === 'running'}
                        />
                    </div>
                </>
            );
        }

        return null;
    };

    return (
        <div className={`custom-node ${data.type} ${data.status}`}>
            <NodeMenu
                nodeData={data}
                onLaunch={handleLaunch}
                isLaunching={isLaunching}
            />

            <Handle
                type="target"
                position={Position.Top}
                isConnectable={true}
            />

            <div className="node-content">
                <div className="status-indicator"></div>
                <div className="status-label">{getStatusText()}</div>
            </div>

            {/* Additional metadata */}
            {data.lastRun && (
                <div className="node-meta">
                    <small>Last run: {new Date(data.lastRun).toLocaleTimeString()}</small>
                </div>
            )}

            {data.connections && (
                <div className="connection-info">
                    <div className="connection-icon">🔗</div>
                    <div className="connection-text">{data.connections}</div>
                </div>
            )}


            {/* Node-specific fields */}
            <div className="node-fields">
                {renderFields()}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={true}
            />
        </div>
    );
};

export default CustomNode;