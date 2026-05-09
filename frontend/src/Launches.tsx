import { useEffect, useRef, useState } from "react"
import * as client from "./client"
import type { Node } from "./JobNode";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { Label } from "./components/ui/label";
import { LaunchesPolicySchema, type LaunchesPolicy } from "./gen/internal/graph/config_pb";
import { ButtonGroup } from "./components/ui/button-group";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { create } from '@bufbuild/protobuf';

export default ({ selectedNode, onChange } : { selectedNode: Node, onChange: (policy: LaunchesPolicy) => void }) => {
    const inputRef : React.Ref<HTMLInputElement> = useRef(null)
    const setInputValue = (value: string) => {
        if (inputRef.current) {
            inputRef.current.value = value
        }
        onChange(create(LaunchesPolicySchema, { Limit: Number(value) }))
    }

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

    const limit = selectedNode.data.config.LaunchesPolicy?.Limit

    const onInputLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const parsed = Number(event.target.value)
            console.log(event.target.value, parsed)
            if (parsed < 0 || parsed >= 2 ** 31 ) {
                throw Error("invalid range")
            }
            setIsValid(true)
            onChange(create(LaunchesPolicySchema, { Limit: parsed }))
        } catch {
            setIsValid(false)
        }
    }

    return <>
        <div className="flex">
            <Label htmlFor="limit">Limit</Label>
            <ButtonGroup aria-label="Media controls" style={{ padding: 5 }} >
                <Input id="limit" placeholder="unlimited" ref={inputRef} defaultValue={(limit || "").toString()} aria-invalid={!isValid} onChange={onInputLimitChange} type='number' step={1} />
                <Button variant="outline" size="icon" onClick={() => setInputValue("1")} >
                    1
                </Button>
                <Button variant="outline" onClick={() => setInputValue("")} >
                    unlimited
                </Button>
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