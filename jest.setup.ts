import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

// jsdom 環境では TextDecoder/TextEncoder がグローバルに存在しないためポリフィルする
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
}
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
}
