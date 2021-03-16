/* istanbul ignore next */
export function report(pkgName: string) {
  return new Error(`[${pkgName}] Please report this bug to the author.`);
}
