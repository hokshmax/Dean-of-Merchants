import { z } from "zod";
import type { Design } from "@dean/shared-types";

export const GENERATE_DESIGN_TOOL_NAME = "generate_design";

/**
 * The model is only ever allowed to emit a visual description -- never an order instruction.
 * Product/size/quantity/shipping details come from the user's choices in the UI after the
 * design is generated, not from anything the model infers from chat.
 */
export const generateDesignInputSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "A detailed visual description of the design to generate, e.g. 'a minimalist mountain " +
        "line-art design in white on a black background'. Should describe imagery/style only, " +
        "not a product type or color of shirt -- the design is applied to a t-shirt afterward.",
    ),
});
export type GenerateDesignInput = z.infer<typeof generateDesignInputSchema>;

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const generateDesignToolDefinition: ToolDefinition = {
  name: GENERATE_DESIGN_TOOL_NAME,
  description:
    "Generates a clothing design image from a text description using AI and returns it for " +
    "the user to preview. The user can then choose a size and buy it printed on a t-shirt " +
    "through the app's checkout flow. This tool does not place an order or take payment.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A detailed visual description of the design to generate",
      },
    },
    required: ["prompt"],
  },
};

export interface GenerateDesignToolResult {
  design: Design;
}
