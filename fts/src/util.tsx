export const extractJobType = (typeUrl: string) => {
    const splitted = typeUrl.split('.');
    const configType = splitted[splitted.length - 1];
    const configSuffixIndex = configType.indexOf("Config")
    return configType.slice(0, configSuffixIndex == -1 ? configType.length : configSuffixIndex);
}
