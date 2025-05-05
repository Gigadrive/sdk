/**
 * Creates a type where all properties are optional except for the specified keys which are required.
 *
 * @template T - The base type containing all properties
 * @template K - The keys of properties that should be required
 *
 * @example
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 *
 * // Makes all fields optional except 'id'
 * type PartialUserWithId = PartialWithRequired<User, 'id'>;
 */
export type PartialWithRequired<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>;
