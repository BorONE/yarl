import React, { useState, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { NodeType } from '../../types/types';
import { fetchNodeTypes, launchGlobal } from '../../api/backend';
import { useNodeUpdates } from '../../hooks/useNodeUpdates';

interface GlobalControlsProps {
    onAddNode: (nodeType: NodeType) => void;
}

const GlobalControls: React.FC<GlobalControlsProps> = ({ onAddNode }) => {
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [selectedType, setSelectedType] = useState<string>('');
    const [isLaunching, setIsLaunching] = useState(false);
    const { getNodes } = useReactFlow();
    const applyNodeUpdates = useNodeUpdates();
    const [toggleLaunchableMode, setToggleLaunchableMode] = useState(false);

    const handleToggleLaunchable = () => {
        const nodes = getNodes();
        applyNodeUpdates(
            nodes.map(node => ({
                nodeId: node.id,
                updates: { launchable: !node.data.launchable }
            }))
        );
    };

    useEffect(() => {
        const loadNodeTypes = async () => {
            const types = await fetchNodeTypes();
            setNodeTypes(types);
            if (types.length > 0) setSelectedType(types[0].id);
        };
        loadNodeTypes();
    }, []);

    const handleGlobalLaunch = async () => {
        setIsLaunching(true);

        try {
            // Get current nodes for context
            const nodes = getNodes();
            const allNodes = nodes.map(node => node.data);

            console.log("Applying initial running state");
            applyNodeUpdates(allNodes.map(node => ({
                nodeId: node.id,
                updates: { status: 'running' }
            })));

            console.log("Fetching updates from backend");
            const updates = await launchGlobal(allNodes);
            console.log("Received updates:", updates);

            console.log("Applying updates");
            applyNodeUpdates(updates);
        } catch (error) {
            console.error("Error in global launch:", error);
            // Set all nodes to error state
            const nodes = getNodes();
            applyNodeUpdates(nodes.map(node => ({
                nodeId: node.id,
                updates: { status: 'error' }
            })));
        } finally {
            setIsLaunching(false);
        }
    };

    return (
        <div className="global-controls">
            <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="node-type-selector"
            >
                {nodeTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                        {type.name}
                    </option>
                ))}
            </select>



            <button
                onClick={() => {
                    const type = nodeTypes.find(t => t.id === selectedType);
                    if (type) onAddNode(type);
                }}
                className="add-node-btn"
            >
                Add Node
            </button>

            <button
                onClick={handleGlobalLaunch}
                className="global-launch-btn"
                disabled={isLaunching}
            >
                {isLaunching ? 'Launching...' : 'Global Launch'}
            </button>

            <button
                onClick={() => setToggleLaunchableMode(!toggleLaunchableMode)}
                className={`toggle-btn ${toggleLaunchableMode ? 'active' : ''}`}
            >
                Toggle Mode
            </button>

            {toggleLaunchableMode && (
                <button
                    onClick={handleToggleLaunchable}
                    className="toggle-launchable-btn"
                >
                    Toggle All Launchable
                </button>
            )}
        </div>
    );
};

export default GlobalControls;