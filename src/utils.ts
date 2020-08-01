export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomElement<T>(list: T[]): T {
    return list[randomInt(0, list.length-1)];
}

/** Defaults to a random floating-point number in [0,1[. */
export function random(min: number = 0, max: number = 1): number {
    return min + Math.random() * (max - min);
}

/** If value is lower than min or greater than max, force it to become min or max, respectively. */
export function limit(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}