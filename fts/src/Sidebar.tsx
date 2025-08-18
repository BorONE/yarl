import React, { useCallback, useState, type ReactElement } from 'react';
import { applyNodeChanges } from '@xyflow/react';
import { create, fromBinary } from '@bufbuild/protobuf';
import { type NodeConfig } from './gen/internal/graph/config_pb';
import { ShellCommandConfigSchema, type ShellCommandConfig } from './gen/internal/job/register/shell_pb';
import { extractJobType } from './util';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

import { anyPack, type Any } from '@bufbuild/protobuf/wkt';

import * as client from './client'
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import Cookies from 'universal-cookie';
import Artifacts from './Arts';
import type { Node } from './JobNode';
import { buildNode } from './misc';


type TypeInfo = {
    type: string,
    typeUrl: string,
    schema: any,
    init: any,
    editor: (job: any, ctx: Context) => ReactElement,
}

type Context = {
    onShellCommandChange: React.ChangeEventHandler<HTMLInputElement>
}

const typeInfos : { [id: string] : TypeInfo} = {
    ShellCommand: {
        type: 'ShellCommand',
        typeUrl: "type.googleapis.com/register.ShellCommandConfig",
        schema: ShellCommandConfigSchema,
        init: {Command: "echo \"Hello, YaRL!\""},
        editor: (job: ShellCommandConfig, ctx: Context) => {
            return <div className="grid w-full items-center gap-3">
                <Label htmlFor="ShellCommand.Command">Command</Label>
                <Input
                    id="ShellCommand.Command"
                    onChange={ctx.onShellCommandChange}
                    placeholder='echo "hello yarl"'
                    value={job.Command}
                    style={{ fontFamily: "monospace" }}
                />
            </div>
        }
    },
    // ShellScript: {
    //     type: 'ShellScript',
    //     typeUrl: "type.googleapis.com/register.ShellScriptConfig",
    //     schema: ShellScriptConfigSchema,
    //     init: {Path: "/dev/null"},
    // },
}

export default ({ nodes, setNodes } : { nodes: Node[], setNodes: (value: React.SetStateAction<Node[]>) => void }) => {
    const [artsLength, setArtsLength] = useState(0)

    const onJobSelected = (info: TypeInfo) => useCallback(
        () => setNodes(
            (nds) => {
                const selectedNode = nds.filter((nd) => nd.selected)[0]
                if (selectedNode.data.config.Job?.typeUrl == info.typeUrl) {
                    return nds
                }
                const job = anyPack(info.schema, info.init)
                const editedConfig = {...selectedNode.data.config, Job: job}
                const editedNode = buildNode(editedConfig, selectedNode.data.state, true)
                client.node.edit(editedConfig)
                return applyNodeChanges([{id: selectedNode.id, item: editedNode, type: 'replace'}], nds)
            }
        ),
        [setNodes],
    )

    const jobTypes = Object.keys(typeInfos)
        .map(key => <DropdownMenuItem key={key} onSelect={onJobSelected(typeInfos[key])}> {key} </DropdownMenuItem>)

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

    const onShellCommandChange : React.ChangeEventHandler<HTMLInputElement> = useCallback(
        (evt) => setNodes(
            (nds: Node[]) => {
                return nds.map((nd) => {
                    if (!nd.selected) {
                        return nd
                    }
                    const config : NodeConfig = nd.data.config
                    const schema = ShellCommandConfigSchema
                    var job : ShellCommandConfig = config.Job ? fromBinary(schema, config.Job.value) : create(schema, {})
                    job.Command = evt.target.value
                    const editedConfig = { ...config, Job: anyPack(schema, job) }
                    client.node.edit(editedConfig)
                    return buildNode(editedConfig, nd.data.state, true)
                })
            }
        ),
        [setNodes],
    )

    const context : Context = {
        onShellCommandChange,
    }

    const getCurrentEditor = (job: Any) => {
        const info = typeInfos[extractJobType(job.typeUrl)]
        const msg = fromBinary(info.schema, job.value)
        return info.editor(msg, context)
    }

    const selectedNodes = nodes.filter((nd) => nd.selected)

    if (selectedNodes.length == 0) {
        return <></>
    } else if (selectedNodes.length > 1) {
        return <>More than one node is selected</>
    }

    const selectedNode = selectedNodes[0]
    const config: NodeConfig = selectedNode.data.config
    const job = config?.Job

    return <aside>
        <Input
            id="Node.Name"
            onChange={onNameChange}
            placeholder='Node'
            value={config.Name}
            style={{ fontSize: 20 }}
            className='grid w-full items-center gap-3 -border file:font-medium'
        />

        <Separator/>

        <Accordion
            type="multiple"
            defaultValue={new Cookies().get('sidebar-accordion')}
            onValueChange={(values) => new Cookies().set('sidebar-accordion', values)}>
            <AccordionItem value="editor">
                <AccordionTrigger>Editor</AccordionTrigger>
                <AccordionContent>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="nodrag p-1">
                                {job ? extractJobType(job.typeUrl) : ""}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {jobTypes}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {job != undefined ? getCurrentEditor(job) : <></>}
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="arts" disabled={artsLength == 0}>
                <AccordionTrigger>Artifacts</AccordionTrigger>
                <AccordionContent>
                    <Artifacts
                        selectedNode={selectedNode}
                        onContent={content => setArtsLength(content.length)}
                    />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </aside>
};
