/**
 * 値が空でない文字列であることを確認する型述語
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
