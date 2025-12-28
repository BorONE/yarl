import type { Connection, Edge } from "@xyflow/react"
import * as config from './gen/internal/graph/config_pb'
import type { Node } from "./JobNode"

type Overwrite<A, B> = Omit<A, keyof B> & B
type CopyBufferNode = Overwrite<config.NodeConfig, {Id: undefined}>

export type CopyBuffer = {
  nodes: CopyBufferNode[],
  edges: string[],
}

export function BuildCopyBuffer(nodes: Node[], edges: Edge[], isLocal: boolean): CopyBuffer {
    const nodeIds = nodes.map(node => node.id)
    return {
        nodes: nodes.map(node => ({ ...node.data.config, Id: undefined })),
        edges: edges
            .map(edge => ({
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
                sourceIndex: nodeIds.indexOf(edge.source),
                targetIndex: nodeIds.indexOf(edge.target),
            }))
            .filter(edge => {
                if (isLocal) {
                    return (edge.sourceIndex >= 0) || (edge.targetIndex >= 0)
                } else {
                    return (edge.sourceIndex >= 0) && (edge.targetIndex >= 0)
                }
            })
            .map(edge => {
                const source = edge.sourceIndex >= 0 ? ('i' + edge.sourceIndex) : edge.source
                const target = edge.targetIndex >= 0 ? ('i' + edge.targetIndex) : edge.target
                return `${source}:${target},${edge.sourceHandle || ''}:${edge.targetHandle || ''}`
            })
    }
}

export function IntoClipboard(nodes: Node[], edges: Edge[]) {
    const copyBuffer = BuildCopyBuffer(nodes, edges, true)
    navigator.clipboard.writeText(JSON.stringify(copyBuffer))
}

export function FromBuffer(serialized: string): CopyBuffer {
    const buffer : CopyBuffer = JSON.parse(serialized)
    buffer.nodes
        .forEach(config => {
            if (config.Position) {
                config.Position.X += 10
                config.Position.Y += 10
            }
            if (config.Job) {
                config.Job.value = new Uint8Array(Object.entries(config.Job.value).map(x => x[1]))
            }
        })
    return buffer
}

export async function FromClipboard() {
    const clipboard = await navigator.clipboard.readText()
    return FromBuffer(clipboard);
}

export function RenderEdges(edges: string[], ids: string[]): Connection[] {
    return edges
        .map(edge => {
            const [nodes, handles] = edge.split(',')
            const [source, target] = nodes.split(':')
            const [sourceHandle, targetHandle] = handles.split(':')
            return {
                source: source.startsWith('i') ? ids[Number(source.slice(1))] : source,
                target: target.startsWith('i') ? ids[Number(target.slice(1))] : target,
                sourceHandle: sourceHandle || null,
                targetHandle: targetHandle || null,
            }
        })
}
