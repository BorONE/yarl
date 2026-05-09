import { useEffect, useState } from "react"
import * as client from "./client"
import type { Node } from "./JobNode";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { Label } from "./components/ui/label";
import { LaunchesPolicySchema, type LaunchesPolicy } from "./gen/internal/graph/config_pb";
import { ButtonGroup } from "./components/ui/button-group";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { MinusIcon, PlusIcon } from "lucide-react";
import { create } from '@bufbuild/protobuf';

export default ({ selectedNode, onChange } : { selectedNode: Node, onChange: (policy: LaunchesPolicy) => void }) => {
    useEffect(() => {
        update();
    }, [selectedNode, selectedNode.data.state]);

    const initLaunches : string[] = []
    const [launches, setLaunches] = useState(initLaunches)

    const initSelectedLaunch : string = ""
    const [selectedLaunch, setSelectedLaunch] = useState(initSelectedLaunch)

    const initIsValid : boolean = true
    const [isValid, setIsValid] = useState(initIsValid)
    
    const id = selectedNode.data.id

    const update = async () => {
        const msg = await client.node.getLaunches({ Id: id })
        setLaunches(msg.Launches)
        setSelectedLaunch(msg.SelectedLaunch)
    }
    
    const choose = (launch: string) => async () => {
        await client.node.chooseLaunch({ Id: id, Launch: launch })
        update()
    }

    switch (selectedNode.data.state.State.case) {
    case "Idle":
        return <em>
            Skip to choose launch
        </em>
    case "InProgress":
        return <em>
            Runnning node...
        </em>
    case "Done":
        break;
    }

    const limit = selectedNode.data.config.LaunchesPolicy ? selectedNode.data.config.LaunchesPolicy?.Limit : ""

    return <>
        <div className="flex">
            <Label htmlFor="limit">Limit</Label>
            <ButtonGroup
                aria-label="Media controls"
                style={{ padding: 5 }}
            >
                <Input id="limit" className="w-15" placeholder="0" value={limit.toString()} aria-invalid={!isValid} onChange={(event) => {
                    try {
                        const parsed = Number(event.target.value)
                        if (parsed < 0 || parsed >= 2 ** 31 ) {
                            throw Error("invalid range")
                        }
                        setIsValid(true)
                        onChange(create(LaunchesPolicySchema, { Limit: parsed }))
                    } catch {
                        setIsValid(false)
                    }                
                }} />
                {/* <Button variant="outline" size="icon">
                    <MinusIcon />
                </Button>
                <Button variant="outline" size="icon">
                    <PlusIcon />
                </Button> */}
            </ButtonGroup>
        </div>
        <RadioGroup value={selectedLaunch} style={{ padding: 5 }}>
        {
            launches.map(
                launch => (
                    <div key={launch} className="flex items-center gap-3">
                        <RadioGroupItem id={launch} value={launch} onClick={choose(launch)} />
                        <Label htmlFor={launch}>{launch}</Label>
                    </div>
                )
            )
        }
        </RadioGroup>
    </>
}