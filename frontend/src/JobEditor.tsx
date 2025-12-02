import { type DescField, type DescMessage, type Message } from "@bufbuild/protobuf"
import { FieldDescriptorProto_Type } from "@bufbuild/protobuf/wkt"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Textarea } from "./components/ui/textarea"

import Editor from 'react-simple-code-editor';

type ArbitraryMap = { [key: string]: any }

export default ({
    job,
    schema,
    init,
    onChange,
}: {
    job: Message
    schema: DescMessage,
    init: Message,
    onChange: (schema: DescMessage, job: Message) => void,
}) => {
    const onFieldChange = (field: DescField, value: any) => {
        const update = job as ArbitraryMap
        update[field.name] = value
        onChange(schema, job)
    }

    const getInput = (field: DescField) => {
        const props : any = {
            id: `${schema.name}.${field.name}`,
            placeholder: (init as ArbitraryMap)[field.name],
            value: (job as ArbitraryMap)[field.name],
            style: { fontFamily: "monospace" },
            className: "no-shadow",
        }

        switch (props.id) {
        case 'ScriptConfig.Source':
            props.rows = props.value.length
            props.value = props.value.join('\n')
            return <Editor
                {...props}
                onValueChange={value => onFieldChange(field, value.split('\n'))}
                highlight={x => x}
                padding={10}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
        }

        switch (field.proto.type) {
        case FieldDescriptorProto_Type.STRING:
            switch (field.fieldKind) {
            case "scalar":
                return <Input
                    {...props}
                    onChange={event => onFieldChange(field, event.target.value)}
                />
            case "list":
                props.rows = props.value.length
                props.value = props.value.join('\n')
                return <Textarea
                    {...props}
                    onChange={event => onFieldChange(field, event.target.value.split('\n'))}
                />
            default:
                throw Error(`input unimplemented for ${props.id} = ${field}`)
            }
        default:
            throw Error(`input unimplemented for ${props.id} = ${field}`)
        }
    }

    return <>{
        schema.fields.map(field => {
            const id = `${schema.name}.${field.name}`
            return <div key={id} className="grid w-full items-center gap-3" style={{ marginBottom: 10 }}>
                <Label htmlFor={id}>{field.name}</Label>
                {getInput(field)}
            </div>
        })
    }</>
}
