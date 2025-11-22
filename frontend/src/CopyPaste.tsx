import type { Connection, Edge } from "@xyflow/react"
import * as config from './gen/internal/graph/config_pb'
import type { Node } from "./JobNode"

type Overwrite<A, B> = Omit<A, keyof B> & B
type CopyBufferNode = Overwrite<config.NodeConfig, {Id: undefined}>
type CopyBufferEdge = { edge: Edge, sourceIndex: number, targetIndex: number }

type CopyBuffer = {
  nodes: CopyBufferNode[],
  edges: CopyBufferEdge[],
}

export function IntoBuffer(nodes: Node[], edges: Edge[]) {
    const selectedNodes = nodes.filter(node => node.selected).map(node => node.id)
    const copyBuffer: CopyBuffer = {
        nodes: nodes
            .filter(node => node.selected)
            .map(node => ({ ...node.data.config, Id: undefined })),
        edges: edges
            .map(edge => ({
                edge,
                sourceIndex: selectedNodes.indexOf(edge.source),
                targetIndex: selectedNodes.indexOf(edge.target),
            }))
            .filter(edge => (edge.sourceIndex >= 0) || (edge.targetIndex >= 0))
    }
    navigator.clipboard.writeText(JSON.stringify(copyBuffer))
}

export async function FromBuffer() {
    const clipboard = await navigator.clipboard.readText()
    const copied : CopyBuffer = JSON.parse(clipboard)
    copied.nodes
        .forEach(config => {
            if (config.Position) {
                config.Position.X += 10
                config.Position.Y += 10
            }
            if (config.Job) {
                config.Job.value = new Uint8Array(Object.entries(config.Job.value).map(x => x[1]))
            }
        })
    return copied
}

export function RenderEdges(edges: CopyBufferEdge[], ids: string[]) {
    return edges.map(edge => ({
        source: edge.sourceIndex >= 0 ? ids[edge.sourceIndex] : edge.edge.source,
        target: edge.targetIndex >= 0 ? ids[edge.targetIndex] : edge.edge.target,
        sourceHandle: edge.edge.sourceHandle || null,
        targetHandle: edge.edge.targetHandle || null,
    } as Connection))
}
