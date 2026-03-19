export type Constructable<T = object, Args extends unknown[] = never[]> = new (...args: Args) => T;

export type AbstractConstructable<T = object, Args extends unknown[] = never[]> = abstract new (...args: Args) => T;
