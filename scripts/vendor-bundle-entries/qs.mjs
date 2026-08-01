import qs from "qs";

export function stringify(obj, options) {
    return qs.stringify(obj, options);
}

export function parse(str, options) {
    return qs.parse(str, options);
}
