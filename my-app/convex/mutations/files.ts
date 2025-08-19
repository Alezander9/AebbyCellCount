import { mutation } from "../_generated/server";

// Mutation to generate upload URL for large images
export const generateUploadUrl = mutation({
    handler: async (ctx) => {
      return await ctx.storage.generateUploadUrl();
    },
  });
  