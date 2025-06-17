import { Node } from 'reactflow';

export interface NodeType {
  id: string;
  name: string;
  properties: Record<string, any>;
}

export interface NodeData {
  id: string;
  type: string;
  name: string;
  status: 'default' | 'running' | 'success' | 'error';
  launchable: boolean;
  // New optional properties for connection info
  lastReported?: string;
  connections?: string;
  lastConnected?: string;
  [key: string]: any;
}

export type FlowNode = Node<NodeData>;

export interface NodeUpdate {
  nodeId: string;
  updates: Partial<NodeData>;
}