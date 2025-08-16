import React, { useCallback } from 'react';
import { applyNodeChanges } from '@xyflow/react';
import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { type Node } from '@xyflow/react';
import { type NodeConfig, type NodeState } from './gen/internal/graph/config_pb';
import { ShellCommandConfigSchema, type ShellCommandConfig } from './gen/internal/job/register/shell_pb';
import { extractJobType } from './util';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from "@/components/ui/textarea"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

import { AnySchema, type Any } from '@bufbuild/protobuf/wkt';

import * as client from './client'
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import Cookies from 'universal-cookie';


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

export default ({ nodes, setNodes } : { nodes: Node[], setNodes: (value: React.SetStateAction<Node[]>) => void, style: any }) => {
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

    const renderEditorShellCommand = () => {
        const job : ShellCommandConfig = jobMsg
        return <div className="grid w-full items-center gap-3">
            <Label htmlFor="ShellCommand.Command">Command</Label>
            <Input
                id="ShellCommand.Command"
                onChange={onShellCommandChange}
                placeholder='echo "hello yarl"'
                value={job.Command}
                style={{ fontFamily: "monospace" }}
            />
        </div>
    }
    const renderEditor = () => {
        return <>
            <AccordionTrigger>Editor</AccordionTrigger>
            <AccordionContent>

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

                {renderEditorShellCommand()}

            </AccordionContent>
        </>
    }

    const renderArts = () => {
        const state : NodeState = selectedNode.data.state
        if (state.State.case != "Done") {
            return <></>
        }

        const done = state.State.value
        const arts = done.Arts

        const renderStream = (key: string) => {
            if (!(key in arts)) {
                return undefined
            }
            return <div className="grid w-full gap-3" style={{padding: 5}}>
                <Label htmlFor={key}>{key}</Label>
                <Textarea id={key} readOnly={true} value={arts[key]} style={{fontFamily: "monospace"}}/>
            </div>
        }

        const renderTime = (label: string, key: string) => {
            if (!(key in arts)) {
                return undefined
            }
            return <div style={{color: "#747474"}}>
                {label}: {arts[key].split('.')[0]}
            </div>
        }

        const content = [
            renderTime("started", "started_at"),
            renderTime("finished", "finished_at"),
            renderStream("stdout"),
            renderStream("stderr"),
        ].filter((el) => typeof el != "undefined")

        if (content.length == 0) {
            return <></>
        }

        return <>
            <AccordionTrigger>Artifacts</AccordionTrigger>
            <AccordionContent>
                {...content}
            </AccordionContent>
        </>
    }

    if (selectedNodes.length == 0) {
        return <></>
    } else if (selectedNodes.length > 1) {
        return <>More than one node is selected</>
    }

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
                {renderEditor()}
            </AccordionItem>
            <AccordionItem value="arts">
                {renderArts()}
            </AccordionItem>
        </Accordion>
    </aside>
};
