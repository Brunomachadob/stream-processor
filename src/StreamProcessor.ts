// tslint:disable:max-file-line-count
import { Writable, Transform, TransformCallback, Stream, PassThrough } from "stream";

import { PromiseResolve, PromiseReject, Mapper, Filter, Reducer, KeyMapper } from "./types";

import { StreamWithStatus } from "./StreamWithStatus";

export class StreamProcessor<T> {
    private static pipeStream<T extends Writable = Writable>(src: Stream, dest: T): T {
        src.on("error", (e: Error) => dest.emit("error", e));

        return src.pipe(dest);
    }

    private readonly head: Writable;
    private tail: Writable;

    constructor() {
        const pass: PassThrough = new PassThrough({ objectMode: true });
        this.head = pass;
        this.tail = pass;
    }

    public start(source: Stream): StreamWithStatus {
        StreamProcessor.pipeStream(source, this.head);

        return StreamProcessor.pipeStream(this.tail, new StreamWithStatus());
    }

    public startMultiple(source: Stream, quantity: number): StreamWithStatus[] {
        const result: Stream = this.start(source);

        return Array.from({ length: quantity }, () => {
            return StreamProcessor.pipeStream(result as Writable, new StreamWithStatus());
        });
    }

    public map<U>(mapper: Mapper<T, U>): StreamProcessor<U> {
        let index: number = 0;

        const transformer: Transform = new Transform({
            objectMode: true,
            transform: async (chunk: any, encoding: string, callback: TransformCallback) => {
                try {
                    const mapped: U = await mapper(chunk, index++, encoding);
                    callback(undefined, mapped);
                } catch (e) {
                    return callback(e);
                }
            },
        });

        return this.pipe(transformer) as any;
    }

    public flatMap<U>(mapper: Mapper<T, U[]> = (chunk: T) => (chunk as any)): StreamProcessor<U> {
        let index: number = 0;

        const transformer: Transform = new Transform({
            objectMode: true,
            async transform(chunk: T, encoding: string, callback: TransformCallback): Promise<void> {
                try {
                    const mapped: U[] = await mapper(chunk, index++, encoding);
                    mapped.forEach((item: U) => {
                        this.emit("data", item);
                    });

                    callback();
                } catch (e) {
                    callback(e);
                }
            },
        });

        return this.pipe(transformer) as any;
    }

    public filter(filterFn: Filter<T>): StreamProcessor<T> {
        const transformer: Transform = new Transform({
            objectMode: true,
            transform: async (chunk: any, encoding: string, callback: TransformCallback) => {
                try {
                    const accept: boolean = await filterFn(chunk, encoding);
                    callback(undefined, accept ? chunk : undefined);
                } catch (e) {
                    return callback(e);
                }
            },
        });

        return this.pipe(transformer);
    }

    public reduce<U>(reducer: Reducer<T, U>, initial?: U): StreamProcessor<U> {
        let acc: U | undefined = initial;

        const transformer: Transform = new Transform({
            objectMode: true,
            transform(chunk: T, _: string, callback: TransformCallback): void {
                try {
                    if (acc !== undefined) {
                        acc = reducer(acc, chunk);
                    } else {
                        acc = chunk as any;
                    }

                    callback();
                } catch (e) {
                    callback(e);
                }
            },
            flush(callback: TransformCallback): void {
                callback(undefined, acc);
            },
        });

        return this.pipe(transformer) as any;
    }

    public async collect(source: Stream): Promise<T[]> {
        const arr: T[] = [];

        return this.collectFromStream(source, (data: T) => {
            arr.push(data);
        }, () => arr);
    }

    public async groupBy<K>(source: Stream, keyMapper: KeyMapper<T, K>): Promise<Map<K, T[]>> {
        const groups: Map<K, T[]> = new Map();

        return this.collectFromStream(source, (data: T) => {
            const key: K = keyMapper(data);
            let list: T[] | undefined = groups.get(key);

            if (!list) {
                list = [];
                groups.set(key, list);
            }

            list.push(data);
        }, () => groups);
    }

    private pipe(dest: Writable): StreamProcessor<T> {
        this.tail = StreamProcessor.pipeStream(this.tail, dest);

        return this;
    }
    private async collectFromStream(
        source: Stream,
        onData: (v: T) => void,
        getResult: () => any,
    ): Promise<any> {
        return new Promise<T[]>((resolve: PromiseResolve<T[]>, reject: PromiseReject) => {
            this.start(source)
                .on("data", (data: T) => {
                    try {
                        onData(data);
                    } catch (e) {
                        reject(e);
                    }
                })
                .on("end", () => resolve(getResult()))
                .on("error", reject);
        });
    }
}
