import * as util from "util";

const setTimeoutPromise: (millis: number, value: any) => Promise<any> = util.promisify(setTimeout);

export async function delay<T>(millis: number, value: T): Promise<T> {
    return setTimeoutPromise(millis, value);
}

export function randomDelay(min: number = 1, max: number = 10) {
    return Math.floor(Math.random() * ( max - min + 1 ) + min);
}
