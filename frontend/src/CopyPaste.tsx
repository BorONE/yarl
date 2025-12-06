import type { Connection, Edge } from "@xyflow/react"
import * as config from './gen/internal/graph/config_pb'
import type { Node } from "./JobNode"

type Overwrite<A, B> = Omit<A, keyof B> & B
type CopyBufferNode = Overwrite<config.NodeConfig, {Id: undefined}>
type CopyBufferEdge = { edge: Edge, sourceIndex: number, targetIndex: number }

export type CopyBuffer = {
  nodes: CopyBufferNode[],
  edges: CopyBufferEdge[],
}

export function BuildCopyBuffer(nodes: Node[], edges: Edge[], isLocal: boolean): CopyBuffer {
    const nodeIds = nodes.map(node => node.id)
    return {
        nodes: nodes.map(node => ({ ...node.data.config, Id: undefined })),
        edges: edges
            .map(edge => ({
                edge,
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

export function RenderEdges(edges: CopyBufferEdge[], ids: string[]) {
    return edges.map(edge => ({
        source: edge.sourceIndex >= 0 ? ids[edge.sourceIndex] : edge.edge.source,
        target: edge.targetIndex >= 0 ? ids[edge.targetIndex] : edge.edge.target,
        sourceHandle: edge.edge.sourceHandle || null,
        targetHandle: edge.edge.targetHandle || null,
    } as Connection))
}
