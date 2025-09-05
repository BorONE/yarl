import { create, toBinary,  type DescMessage, type MessageInitShape } from '@bufbuild/protobuf';
import * as config from './gen/internal/graph/config_pb'
import { type Connection, type Edge } from '@xyflow/react';
import { getBorderColor } from './misc';
import type { Node } from './JobNode';

export const extractJobType = (typeUrl: string) => {
    const splitted = typeUrl.split('.');
    const configType = splitted[splitted.length - 1];
    const configSuffixIndex = configType.indexOf("Config")
    return configType.slice(0, configSuffixIndex == -1 ? configType.length : configSuffixIndex);
}

export function createBinary<Desc extends DescMessage>(schema: Desc, init?: MessageInitShape<Desc>): Uint8Array {
    return toBinary(schema, create(schema, init))
}

function isFileEdge(edge: config.EdgeConfig): boolean {
    if (!!edge.FromFile != !!edge.ToFile) {
        throw `edge ${edge} is invalid (either both or none ends must be files)`
    }
    return !!edge.FromFile
}

function isFileConnection(connection: Edge | Connection): boolean {
    if (!!connection.sourceHandle != !!connection.targetHandle) {
        throw `connection ${connection} is invalid (either both or none ends must be files)`
    }
    return !!connection.sourceHandle
}

export function convertEdgeToConnection(edge: config.EdgeConfig, source: Node, target: Node): Edge {
    const connection = {
        source: `${edge.FromNodeId}`,
        target: `${edge.ToNodeId}`,
        sourceHandle: isFileEdge(edge) ? `${source.data.config.Outputs.indexOf(edge.FromFile)}` : null,
        targetHandle: isFileEdge(edge) ? `${target.data.config.Inputs.indexOf(edge.ToFile)}` : null,
    }
    return canonizeConnection(connection, source.data.state)
}

export function convertConnectionToEdge(connection: Edge | Connection, source: Node, target: Node): config.EdgeConfig {
    return create(config.EdgeConfigSchema, {
        FromNodeId: BigInt(connection.source),
        FromFile: connection.sourceHandle ? source.data.config.Outputs[Number(connection.sourceHandle)] : undefined,
        ToNodeId: BigInt(connection.target),
        ToFile: connection.targetHandle ? target.data.config.Inputs[Number(connection.targetHandle)] : undefined,
    })
}

export function canonizeConnection(connection: Edge | Connection, inputState?: config.NodeState) : Edge {
    const isFile = isFileConnection(connection)
    const style : React.CSSProperties = isFile
        ? { strokeOpacity: 0.5 }
        : { stroke: inputState ? getBorderColor(inputState) : undefined }
    const id = isFile
        ? `${connection.source}-${connection.target}:${connection.sourceHandle}-${connection.targetHandle}`
        : `${connection.source}-${connection.target}`
    return { ...connection, id, style, animated: isFile }
}
