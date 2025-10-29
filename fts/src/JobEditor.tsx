import { create, type DescField, type DescMessage, type Message } from "@bufbuild/protobuf"
import { FieldDescriptorProto_Type } from "@bufbuild/protobuf/wkt"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Textarea } from "./components/ui/textarea"

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
    const onFieldChange = (event: React.ChangeEvent<HTMLElement>, name: string) => {
        var result = job
        const field = schema.fields.find(field => field.name == name) as DescField
        switch (field.proto.type) {
        case FieldDescriptorProto_Type.STRING:
            switch (field.fieldKind) {
            case "scalar":
                result[name] = event.target.value
                break
            case "list":
                result[name] = event.target.value.split('\n')
                break
            }
        }
        onChange(schema, result)
    }

    return <>{
        schema.fields.map(field => {
            const id = `${schema.name}.${field.name}`
            const props : any = {
                id: id,
                onChange: (event: React.ChangeEvent<HTMLElement>) => onFieldChange(event, field.name),
                placeholder: init[field.name],
                value: job[field.name],
                style: { fontFamily: "monospace" },
                className: "no-shadow",
            }

            var input

            switch (field.proto.type) {
            case FieldDescriptorProto_Type.STRING:
                switch (field.fieldKind) {
                case "scalar":
                    input = <Input {...props}/>
                    break
                case "list":
                    props.rows = props.value.length
                    props.value = props.value.join('\n')
                    input = <Textarea {...props}/>
                    break
                }
            }
            
            return <div key={id} className="grid w-full items-center gap-3" style={{ marginBottom: 10 }}>
                <Label htmlFor={id}>{field.name}</Label>
                {input}
            </div>
        })
    }</>
}
