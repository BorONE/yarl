import { create, toBinary,  type DescMessage, type MessageInitShape } from '@bufbuild/protobuf';
import * as config from './gen/internal/graph/config_pb'
import { type Connection, type Edge } from '@xyflow/react';
import { isReady } from './misc';

export const extractJobType = (typeUrl: string) => {
    const splitted = typeUrl.split('.');
    const configType = splitted[splitted.length - 1];
    const configSuffixIndex = configType.indexOf("Config")
    return configType.slice(0, configSuffixIndex == -1 ? configType.length : configSuffixIndex);
}

export function createBinary<Desc extends DescMessage>(schema: Desc, init?: MessageInitShape<Desc>): Uint8Array {
    return toBinary(schema, create(schema, init))
}

export function convertEdgeToConnection(edge: config.EdgeConfig, inputState?: config.NodeState): Edge {
    return {
        id: `${edge.FromNodeId}-${edge.ToNodeId}:${edge.FromFile ? edge.FromFile : undefined}-${edge.ToFile ? edge.ToFile : undefined}`,
        source: `${edge.FromNodeId}`,
        target: `${edge.ToNodeId}`,
        sourceHandle: edge.FromFile ? edge.FromFile : undefined,
        targetHandle: edge.ToFile ? edge.ToFile : undefined,
        animated: inputState ? !isReady(inputState) : undefined,
    }
}

export function convertConnectionToEdge(connection: Edge | Connection): config.EdgeConfig {
    return create(config.EdgeConfigSchema, {
        FromNodeId: BigInt(connection.source),
        FromFile: connection.sourceHandle ? connection.sourceHandle : undefined,
        ToNodeId: BigInt(connection.target),
        ToFile: connection.targetHandle ? connection.targetHandle : undefined,
    })
}
