export type PromiseResolve<T> = (result: T) => void;
export type PromiseReject = (e: Error) => void;

export type Mapper<T, U> = (chunk: T, index: number, encoding: string) => U | Promise<U>;
export type Filter<T> = (chunk: T, encoding?: string) => boolean | Promise<boolean>;
export type Reducer<T, U> = (acc: U, chunk: T) => U;
export type KeyMapper<T, K> = (chunk: T) => K;
