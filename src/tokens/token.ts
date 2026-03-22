// oxlint-disable-next-line no-unused-vars
export class Token<T> {
  public name?: string;

  constructor(name?: string) {
    this.name = name;
  }

  public toString() {
    return this.name ? `Token(${this.name})` : `Token()`;
  }
}
