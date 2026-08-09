import { describe, expect, it } from "vitest";
import { parseGenerateImagesResponse } from "./imagen-client";

describe("parseGenerateImagesResponse", () => {
  it("decodes base64 image bytes and defaults mimeType to image/png", () => {
    const base64 = Buffer.from("fake-png-bytes").toString("base64");
    const result = parseGenerateImagesResponse(
      { generatedImages: [{ image: { imageBytes: base64 } }] },
      "a mountain",
    );
    expect(result.imageBytes).toEqual(Buffer.from("fake-png-bytes"));
    expect(result.mimeType).toBe("image/png");
  });

  it("preserves an explicit mimeType", () => {
    const base64 = Buffer.from("fake-jpg-bytes").toString("base64");
    const result = parseGenerateImagesResponse(
      { generatedImages: [{ image: { imageBytes: base64, mimeType: "image/jpeg" } }] },
      "a mountain",
    );
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("throws when the response has no image data", () => {
    expect(() => parseGenerateImagesResponse({ generatedImages: [] }, "a mountain")).toThrow(
      "Imagen returned no image data",
    );
  });
});
