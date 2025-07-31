import { create, toBinary,  type DescMessage, type MessageInitShape, type MessageShape } from '@bufbuild/protobuf';

export const extractJobType = (typeUrl: string) => {
    const splitted = typeUrl.split('.');
    const configType = splitted[splitted.length - 1];
    const configSuffixIndex = configType.indexOf("Config")
    return configType.slice(0, configSuffixIndex == -1 ? configType.length : configSuffixIndex);
}

export function createBinary<Desc extends DescMessage>(schema: Desc, init?: MessageInitShape<Desc>): Uint8Array {
    return toBinary(schema, create(schema, init))
}
