"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Daytona } from '@daytonaio/sdk';


// Action to process actual uploaded images
export const processCellImage = action({
  args: {
    imageBase64: v.string(),
    targetColor: v.optional(v.object({
      r: v.number(),
      g: v.number(), 
      b: v.number()
    }))
  },
  handler: async (ctx, { imageBase64, targetColor = { r: 255, g: 38, b: 0 } }) => {
    console.log("=== PROCESSING CELL IMAGE ===");
    
    try {
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY || 'YOUR_API_KEY',
      });

      let sandbox;
      try {
        sandbox = await daytona.create({
          language: "python",
        });
        
        // Install packages first
        await sandbox.process.codeRun(
          'import subprocess; subprocess.run(["pip", "install", "numpy", "pillow", "scipy"], check=True)'
        );
        
        // Create and run the processing code directly
        const processingCode = `
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, binary_opening, binary_closing
import base64
import io
import json

def count_cells(image_base64: str, target_color: tuple = (255, 38, 0)) -> dict:
    """Process base64 image and return cell count results"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64.split(',')[-1])  # Remove data:image/png;base64, prefix if present
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        image_array = np.array(image)
        
        # Create color mask with tolerance
        tolerance = 10
        target = np.array(target_color)
        diff = np.abs(image_array - target)
        mask = np.all(diff <= tolerance, axis=2)
        
        # Clean up mask with morphological operations
        mask = binary_closing(mask, structure=np.ones((3, 3)))
        mask = binary_opening(mask, structure=np.ones((3, 3)))
        
        # Find connected components
        labeled_array, num_features = label(mask)
        
        # Calculate centroids and filter by size
        min_area = 50
        cell_locations = []
        
        for i in range(1, num_features + 1):
            component_mask = labeled_array == i
            area = np.sum(component_mask)
            
            if area >= min_area:
                # Calculate centroid
                y_coords, x_coords = np.where(component_mask)
                cx, cy = int(np.mean(x_coords)), int(np.mean(y_coords))
                cell_locations.append([cx, cy])
        
        # Create output image with detected cells marked
        output_image = image.copy()
        draw = ImageDraw.Draw(output_image)
        
        for i, (cx, cy) in enumerate(cell_locations):
            # Draw circle at cell center
            draw.ellipse([cx-8, cy-8, cx+8, cy+8], outline=(255, 255, 0), width=2)
            # Add cell number
            draw.text((cx-10, cy-20), str(i + 1), fill=(255, 255, 0))
        
        # Convert to base64
        img_buffer = io.BytesIO()
        output_image.save(img_buffer, format='PNG')
        img_bytes = img_buffer.getvalue()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        return {
            "success": True,
            "cell_count": len(cell_locations),
            "cell_locations": cell_locations,
            "annotated_image_base64": img_base64
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# Process the provided image
image_b64 = "${imageBase64}"
target_color = (${targetColor.r}, ${targetColor.g}, ${targetColor.b})

result = count_cells(image_b64, target_color)
print("RESULT_JSON:" + json.dumps(result))
`;

        const response = await sandbox.process.codeRun(processingCode);
        
        if (response.exitCode !== 0) {
          return {
            success: false,
            error: response.result
          };
        }
        
        // Parse result
        const lines = response.result.trim().split('\n');
        const resultLine = lines.find(line => line.startsWith('RESULT_JSON:'));
        
        if (resultLine) {
          const jsonStr = resultLine.replace('RESULT_JSON:', '');
          const result = JSON.parse(jsonStr);
          return result;
        } else {
          return {
            success: false,
            error: "No result found in output",
            rawOutput: response.result
          };
        }
        
      } finally {
        if (sandbox) {
          await sandbox.delete();
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
});