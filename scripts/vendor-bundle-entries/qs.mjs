import qs from "qs";

export function stringify(obj, options) {
    return qs.stringify(obj, options);
}
