import { Readable } from "stream";
export function buildStream<T>(items: T[]): Readable {
    const readable: Readable = new Readable({ objectMode: true });

    items.forEach((item: T) => readable.push(item));

    readable.push(null);

    return readable;
}
