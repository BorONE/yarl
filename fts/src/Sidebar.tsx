import React, { useCallback, type JSX } from 'react';
import { applyNodeChanges, useStore } from '@xyflow/react';
import { create, fromBinary, toBinary, toJsonString } from '@bufbuild/protobuf';
import { type Node } from '@xyflow/react';
import { NodeConfigSchema, type NodeConfig } from './gen/internal/graph/config_pb';
import { ShellCommandConfigSchema, ShellScriptConfigSchema, type ShellCommandConfig } from './gen/internal/job/register/shell_pb';
import { extractJobType } from './util';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AnySchema, type Any } from '@bufbuild/protobuf/wkt';

import * as client from './client'
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';


type TypeInfo = {
    type: string,
    typeUrl: string,
    schema: any,
    init: any,
    // editor: () => JSX.Element,
}

const typeInfos : { [id: string] : TypeInfo} = {
    ShellCommand: {
        type: 'ShellCommand',
        typeUrl: "type.googleapis.com/register.ShellCommandConfig",
        schema: ShellCommandConfigSchema,
        init: {Command: "echo \"Hello, YaRL!\""},
    },
    // ShellScript: {
    //     type: 'ShellScript',
    //     typeUrl: "type.googleapis.com/register.ShellScriptConfig",
    //     schema: ShellScriptConfigSchema,
    //     init: {Path: "/dev/null"},
    // },
}

function getTypeInfo(typeUrl: string) {
    return typeInfos[extractJobType(typeUrl)]
}

export default ({ nodes, setNodes, style } : { nodes: Node[], setNodes: (value: React.SetStateAction<Node[]>) => void, style: any }) => {
    const replaceJob = (node: Node, info: TypeInfo) => {
        node.data.config.Job = create(AnySchema, {
            typeUrl: info.typeUrl,
            value: toBinary(info.schema, create(info.schema, info.init)),
        })
        return node
    }

    const onJobSelected = (info: TypeInfo) => useCallback(
        () => setNodes(
            (nds) => {
                const selectedNode = nds.filter((nd) => nd.selected)[0]
                if (selectedNode.data.config.Job.typeUrl == info.typeUrl) {
                    return nds
                }
                const editedNode = replaceJob(selectedNode, info)
                client.node.edit(editedNode.data.config)
                return applyNodeChanges([{id: selectedNode.id, item: editedNode, type: 'replace'}], nds)
            }
        ),
        [setNodes],
    )
  
    const selectedNodes = nodes.filter((nd) => nd.selected)
    
    const selectedNode = selectedNodes[0]
    const config: NodeConfig = selectedNode?.data.config
    const job = config?.Job
    const jobType = job ? extractJobType(job.typeUrl) : null
    const schema = job ? typeInfos[jobType].schema : null
    const jobMsg = job ? fromBinary(schema, job.value) : null
    // const job? = toJsonString(schema, jobMsg)

    const items = Object.keys(typeInfos).map((key) => <DropdownMenuItem key={key} onSelect={onJobSelected(typeInfos[key])}>{key}</DropdownMenuItem>)

    const onShellCommandChange : React.ChangeEventHandler<HTMLInputElement> = useCallback(
        (evt) => setNodes(
            (nds: Node[]) => {
                return nds.map((nd) => {
                    if (nd.selected) {
                        var config : NodeConfig = nd.data.config
                        var job : Any = config.Job
                        const info = getTypeInfo(job.typeUrl)
                        var jobValue : ShellCommandConfig = fromBinary(info.schema, job.value)
                        jobValue.Command = evt.target.value
                        job.value = toBinary(info.schema, jobValue)
                        client.node.edit(config)
                    }
                    return nd
                })
            }
        ),
        [setNodes],
    )
    const onNameChange : React.ChangeEventHandler<HTMLInputElement> = useCallback(
        (evt) => setNodes(
            (nds: Node[]) => (
                nds.map(
                    (nd) => {
                        if (!nd.selected) {
                            return nd
                        }
                        var config : NodeConfig = nd.data.config
                        config.Name = evt.target.value
                        client.node.edit(config)
                        return {...nd, data: { ...nd.data, config } }
                    }
                )
            )
        ),
        [setNodes],
    )
    const editor = () => {
        const job : ShellCommandConfig = jobMsg
        return <div className="grid w-full items-center gap-3">
            <Label htmlFor="ShellCommand.Command">Command</Label>
            <Input
                id="ShellCommand.Command"
                onChange={onShellCommandChange}
                placeholder='echo "hello yarl"'
                value={job.Command}
            />
        </div>
    }

    if (selectedNodes.length == 0) {
        return <></>
    } else if (selectedNodes.length > 1) {
        return <>More than one node is selected</>
    }

    return <aside style={style}>
        <Input
            id="ShellCommand.Command"
            onChange={onNameChange}
            placeholder='Node'
            value={config.Name}
            style={{ fontSize: 20 }}
            className='grid w-full items-center gap-3 -border file:font-medium'
        />

        <Separator/>

        <div style={{ margin: '5px' }}>
            <DropdownMenu>  
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="nodrag p-1">
                        {extractJobType(job.typeUrl)}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {items}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        {editor()}
    </aside>
};
