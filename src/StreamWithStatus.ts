import { Transform, TransformCallback } from "stream";

export class StreamWithStatus extends Transform {
    private receivedData: boolean = false;
    private isFinished: boolean = false;

    constructor() {
        super({
            objectMode: true,
            transform: (chunk: any, _: string, callback: TransformCallback) => {
                this.receivedData = true;

                callback(undefined, chunk);
            },
        });

        this.once("end", () => this.isFinished = true);
    }

    public wasEmpty(): boolean {
        if (!this.isFinished) {
            throw new Error("It's not possible to check if stream was empty before it finished transferring.");
        }

        return !this.receivedData;
    }
}
