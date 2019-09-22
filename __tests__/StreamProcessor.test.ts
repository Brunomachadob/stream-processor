// Is required by inversify
import { Readable } from "stream";

import { StreamProcessor, StreamWithStatus } from "../src";
import { delay, randomDelay } from "./util/delay";
import { buildStream } from "./util/buildStream";

type SimpleItem = {
    itemId: number,
    itemName: string,
}

type SimpleModel = {
    id: number,
    name: string,
    age: number,
    country: string,
    items: SimpleItem[],
};

const SIMPLE_MODEL_ARR: SimpleModel[] = [
    { id: 1, name: "Test1", age: 18, country: "DE", items: [{ itemId: 1, itemName: "Item1" }, { itemId: 2, itemName: "Item2" }] },
    { id: 2, name: "Test2", age: 20, country: "DE" ,items: [{ itemId: 3, itemName: "Item3" }, { itemId: 4, itemName: "Item4" }] },
    { id: 3, name: "Test3", age: 26, country: "BR", items: [{ itemId: 5, itemName: "Item5" }, { itemId: 6, itemName: "Item6" }] },
    { id: 4, name: "Test4", age: 23, country: "BR", items: [{ itemId: 7, itemName: "Item7" }, { itemId: 8, itemName: "Item8" }] },
];

describe("StreamProcessor", () => {
    it("StreamProcessor.collect", async () => {
        const result: number[] = await new StreamProcessor<number>()
            .collect(buildStream([ 1, 2, 3 ]));

        expect(result).toEqual([ 1, 2, 3 ]);
    });

    it("StreamProcessor.map", async () => {
        const result: number[] = await new StreamProcessor<number>()
            .map((n: number) => n * 2)
            .collect(buildStream([ 1, 2, 3 ]));

        expect(result).toEqual([ 2, 4, 6 ]);
    });

    it("StreamProcessor.map with error", async () => {
        const check: () => Promise<number[]> = async () => {
            return new StreamProcessor<number>().map((n: number) => {
                if (n > 2) {
                    throw new Error(`Throwing error because it's greather than 2, got ${n}`);
                }

                return n * 2;
            })
            .collect(buildStream([ 1, 2, 3 ]));
        };

        await expect(check()).rejects.toThrow("Throwing error because it's greather than 2, got 3");
    });

    it("StreamProcessor.flatMap", async () => {

        const result: SimpleItem[] = await new StreamProcessor<SimpleModel>()
            .flatMap((model: SimpleModel) => delay(randomDelay(100, 200), model.items))
            .collect(buildStream(SIMPLE_MODEL_ARR));

        expect(result).toMatchSnapshot();
    });

    it("StreamProcessor.flatMap with error", async () => {
        const check: () => Promise<SimpleItem[]> = async () => {
            return new StreamProcessor<SimpleModel>()
            .flatMap((model: SimpleModel) => {
                if (model.items.length > 1) {
                    throw new Error(`Throwing error because it's greather than 1, got ${model.items.length}`);
                }

                return model.items;
            })
            .collect(buildStream(SIMPLE_MODEL_ARR));
        };

        await expect(check()).rejects.toThrow("Throwing error because it's greather than 1, got 2");
    });

    it("StreamProcessor.filter", async () => {
        const result: number[] = await new StreamProcessor<number>()
            .filter((n: number) => n > 10)
            .collect(buildStream([ 10, 20, 30 ]));

        expect(result).toEqual([ 20, 30 ]);
    });

    it("StreamProcessor.filter with error", async () => {
        const check: () => Promise<number[]> = async () => {
            return new StreamProcessor<number>().filter((n: number): boolean => {
                if (n > 2) {
                    throw new Error(`Throwing error because it's greather than 2, got ${n}`);
                }

                return true;
            })
            .collect(buildStream([ 1, 2, 3 ]));
        };

        await expect(check()).rejects.toThrow("Throwing error because it's greather than 2, got 3");
    });

    it("StreamProcessor.reduce", async () => {
        const input: Readable = buildStream([ 10, 20, 30 ]);
        const reducer = (acc: number, n: number): number => acc + n;

        const [ result ]: number[] = await new StreamProcessor<number>()
            .reduce(reducer).collect(input);

        expect(result).toEqual(60);
    });

    it("StreamProcessor.reduce with different types", async () => {
        const reducer = (acc: SimpleItem[], model: SimpleModel): SimpleItem[] => [ ...acc, ...model.items ];
        const flatMapper = (items: SimpleItem[]): string[] => items.map((item: SimpleItem) => item.itemName);

        const result: string[] = await new StreamProcessor<SimpleModel>()
            .reduce(reducer, [])
            .flatMap(flatMapper)
            .collect(buildStream(SIMPLE_MODEL_ARR));

        expect(result).toMatchSnapshot();
    });

    it("StreamProcessor.reduce with error", async () => {
        const input: Readable = buildStream([ 1, 2, 3 ]);
        const reducer = (acc: number, n: number): number => {
            if (n > 0) {
                throw new Error(`Throwing error because it's greather than 0, got ${n}`);
            }

            return acc + n;
        };

        const check: () => Promise<number[]> = async () => {
            return new StreamProcessor<number>().reduce(reducer).collect(input);
        };

        await expect(check()).rejects.toThrow("Throwing error because it's greather than 0, got 2");
    });

    it("StreamProcessor.groupBy", async () => {
        const input: Readable = buildStream(SIMPLE_MODEL_ARR);
        const keyMapper = (model: SimpleModel): string => model.country;

        const result: Map<string, SimpleModel[]> = await new StreamProcessor<SimpleModel>()
            .groupBy(input, keyMapper);

        expect(result).toMatchSnapshot();
    });

    it("StreamProcessor complex operations", async () => {
        const input: Readable = buildStream(SIMPLE_MODEL_ARR);
        const reducer = (acc: number, n: number): number => acc + n;

        const [ result ]: number[] = await new StreamProcessor<SimpleModel>()
            .filter((model: SimpleModel) => model.country === "BR")
            .map((model: SimpleModel) => delay(200, model.age))
            .reduce(reducer)
            .collect(input);

        expect(result).toEqual(49);
    });

    it("multiple StreamProcessors sharing one source", async () => {
        const input: Readable = buildStream(SIMPLE_MODEL_ARR);
        const reducer = (acc: number, n: number): number => acc + n;

        const brazilianStream: StreamProcessor<number> = new StreamProcessor<SimpleModel>()
            .filter((model: SimpleModel) => model.country === "BR")
            .map((model: SimpleModel) => delay(200, model.age));

        const germanStream: StreamProcessor<number> = new StreamProcessor<SimpleModel>()
            .filter((model: SimpleModel) => model.country === "DE")
            .map((model: SimpleModel) => delay(500, model.age));

        const [ [ brazilianAges ], [ germanAges ] ]: [number[], number[]] = await Promise.all([
            brazilianStream.reduce(reducer).collect(input),
            germanStream.reduce(reducer).collect(input),
         ]);

        expect(brazilianAges).toEqual(49);
        expect(germanAges).toEqual(38);
    });

    it("it should throw an error if ask 'wasEmpty' before done", () => {
        const stream: StreamWithStatus = new StreamProcessor<number>()
            .start(buildStream([1, 2, 3]));

        expect(() => stream.wasEmpty()).toThrow("It's not possible to check if stream was empty before it finished transferring.")
    });

    it("'wasEmpty' should return false if items were transferred", async () => {
        const stream: StreamWithStatus = new StreamProcessor<number>()
            .start(buildStream([1, 2, 3]));

        stream.on("data", () => {}); // To trigger the stram start

        await new Promise((resolve: () => any) => {
            stream.on("end", () => resolve());
        });

        expect(stream.wasEmpty()).toEqual(false)
    });

    it("'wasEmpty' should return true if no items were transferred", async () => {
        const stream: StreamWithStatus = new StreamProcessor<number>()
            .start(buildStream([]));

        stream.on("data", () => {}); // To trigger the stram start

        await new Promise((resolve: () => any) => {
            stream.on("end", () => resolve());
        });

        expect(stream.wasEmpty()).toEqual(true)
    });
});
