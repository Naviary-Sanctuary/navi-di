/**
 * A class constructor that can be instantiated with `new`.
 */
export type Constructable<T = object, Args extends unknown[] = never[]> = new (...args: Args) => T;

/**
 * An abstract class constructor used for typing class-based service identifiers.
 */
export type AbstractConstructable<T = object, Args extends unknown[] = never[]> = abstract new (...args: Args) => T;
