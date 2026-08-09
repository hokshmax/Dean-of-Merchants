import { describe, expect, it } from "vitest";
import { generateDesignInputSchema, generateDesignToolDefinition } from "./generate-design";

describe("generateDesignInputSchema", () => {
  it("accepts a non-empty prompt", () => {
    const result = generateDesignInputSchema.safeParse({ prompt: "a minimalist mountain line-art design" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty prompt", () => {
    const result = generateDesignInputSchema.safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing prompt", () => {
    const result = generateDesignInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("generateDesignToolDefinition", () => {
  it("declares the tool name and a required prompt parameter", () => {
    expect(generateDesignToolDefinition.name).toBe("generate_design");
    expect(generateDesignToolDefinition.parameters.required).toEqual(["prompt"]);
  });
});
