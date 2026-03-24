/**
 * Represents a typed service identifier.
 *
 * Tokens are useful when a dependency should be resolved by an explicit key
 * instead of by its class constructor.
 */
// oxlint-disable-next-line no-unused-vars
export class Token<T> {
  /**
   * A human-readable name for this token.
   *
   * This value is useful for debugging and display, but token resolution is
   * based on the token instance itself.
   */
  public name?: string;

  /**
   * Creates a token with an optional display name.
   *
   * @param name A human-readable name used for debugging and display.
   */
  constructor(name?: string) {
    this.name = name;
  }

  /**
   * Returns a readable string representation of this token.
   *
   * @returns A display string for this token.
   */
  public toString() {
    return this.name ? `Token(${this.name})` : `Token()`;
  }
}
