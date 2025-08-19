"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Daytona } from '@daytonaio/sdk';
import sharp from 'sharp';


// Define return types
type CompressionResult = {
  success: boolean;
  compressedImage?: string;
  originalSize?: number;
  compressedSize?: number;
  error?: string;
};

type ProcessingResult = {
  success: boolean;
  cell_count?: number;
  cell_locations?: number[][];
  annotated_image_base64?: string;
  error?: string;
  rawOutput?: string;
};

// Action to compress images before processing
export const compressImage = action({
  args: {
    imageBase64: v.string(),
    maxWidth: v.optional(v.number()),
    maxHeight: v.optional(v.number()),
    quality: v.optional(v.number())
  },
  handler: async (ctx, { imageBase64, maxWidth = 1200, maxHeight = 1200, quality = 85 }): Promise<CompressionResult> => {
    console.log("=== COMPRESSING IMAGE ===");
    console.log("[COMPRESSION] Original size:", imageBase64.length);
    
    try {
      // Remove data URL prefix if present
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const inputBuffer = Buffer.from(base64Data, 'base64');
      
      // Compress with Sharp
      const compressedBuffer = await sharp(inputBuffer)
        .resize(maxWidth, maxHeight, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality })
        .toBuffer();
      
      const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
      
      console.log("[COMPRESSION] Compressed size:", compressedBase64.length);
      console.log("[COMPRESSION] Compression ratio:", (compressedBase64.length / imageBase64.length * 100).toFixed(1) + "%");
      
      return {
        success: true,
        compressedImage: compressedBase64,
        originalSize: imageBase64.length,
        compressedSize: compressedBase64.length
      };
    } catch (error) {
      console.error("[COMPRESSION] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compression failed'
      };
    }
  }
});



// Helper function to compress image inline to avoid circular reference
const compressImageInline = async (imageBase64: string): Promise<CompressionResult> => {
  console.log("=== COMPRESSING IMAGE INLINE ===");
  console.log("[TEMPLOG] [COMPRESSION] Starting compression process");
  console.log("[TEMPLOG] [COMPRESSION] Original imageBase64 length:", imageBase64.length);
  console.log("[TEMPLOG] [COMPRESSION] Original size in MB:", (imageBase64.length / (1024 * 1024)).toFixed(2));
  
  try {
    // Remove data URL prefix if present
    console.log("[TEMPLOG] [COMPRESSION] Checking for data URL prefix...");
    const hasDataPrefix = imageBase64.includes(',');
    console.log("[TEMPLOG] [COMPRESSION] Has data URL prefix:", hasDataPrefix);
    
    const base64Data = hasDataPrefix ? imageBase64.split(',')[1] : imageBase64;
    console.log("[TEMPLOG] [COMPRESSION] Base64 data length after prefix removal:", base64Data.length);
    
    console.log("[TEMPLOG] [COMPRESSION] Converting base64 to buffer...");
    const inputBuffer = Buffer.from(base64Data, 'base64');
    console.log("[TEMPLOG] [COMPRESSION] Input buffer size:", inputBuffer.length, "bytes");
    
    // Compress with Sharp
    console.log("[TEMPLOG] [COMPRESSION] Starting Sharp compression (1200x1200, quality=80)...");
    const compressedBuffer = await sharp(inputBuffer)
      .resize(1200, 1200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    console.log("[TEMPLOG] [COMPRESSION] Sharp compression complete");
    console.log("[TEMPLOG] [COMPRESSION] Compressed buffer size:", compressedBuffer.length, "bytes");
    
    const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
    console.log("[TEMPLOG] [COMPRESSION] Final compressed base64 length:", compressedBase64.length);
    console.log("[TEMPLOG] [COMPRESSION] Final size in MB:", (compressedBase64.length / (1024 * 1024)).toFixed(2));
    
    const compressionRatio = (compressedBase64.length / imageBase64.length * 100);
    console.log("[TEMPLOG] [COMPRESSION] Compression ratio:", compressionRatio.toFixed(1) + "%");
    console.log("[TEMPLOG] [COMPRESSION] Size reduction:", ((imageBase64.length - compressedBase64.length) / (1024 * 1024)).toFixed(2), "MB saved");
    
    return {
      success: true,
      compressedImage: compressedBase64,
      originalSize: imageBase64.length,
      compressedSize: compressedBase64.length
    };
  } catch (error) {
    console.error("[TEMPLOG] [COMPRESSION] ❌ Error during compression:", error);
    console.error("[TEMPLOG] [COMPRESSION] Error type:", typeof error);
    console.error("[TEMPLOG] [COMPRESSION] Error message:", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Compression failed'
    };
  }
};

// Helper function to process with Daytona (extracted for reuse)
const processWithDaytona = async (imageBase64: string, targetColor: { r: number, g: number, b: number }): Promise<ProcessingResult> => {
  console.log("[TEMPLOG] 🚀 Starting Daytona processing");
  console.log("[TEMPLOG] Image size for Daytona:", imageBase64.length, "bytes");
  
  try {
    console.log("[TEMPLOG] Initializing Daytona client...");
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY || 'YOUR_API_KEY',
    });

    let sandbox;
    try {
      console.log("[TEMPLOG] Creating Daytona sandbox...");
      sandbox = await daytona.create({
        language: "python",
      });
      console.log("[TEMPLOG] Sandbox created successfully");
      
      // Install packages first
      console.log("[TEMPLOG] Installing Python packages...");
      await sandbox.process.codeRun(
        'import subprocess; subprocess.run(["pip", "install", "numpy", "pillow", "scipy"], check=True)'
      );
      console.log("[TEMPLOG] Package installation complete");
      
      // Upload the image as a file
      console.log("[TEMPLOG] Uploading image to sandbox...");
      const base64Data = imageBase64.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      console.log("[TEMPLOG] Image buffer size for upload:", imageBuffer.length, "bytes");
      await sandbox.fs.uploadFile(imageBuffer, "input_image.png");
      console.log("[TEMPLOG] ✅ Image file uploaded successfully to sandbox");
      
      // Python processing code
      const processingCode = `
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, binary_opening, binary_closing
import base64
import io
import json

def count_cells(image_path: str, target_color: tuple = (255, 38, 0)) -> dict:
    """Process image file and return cell count results"""
    try:
        # Load image from file
        image = Image.open(image_path).convert('RGB')
        image_array = np.array(image)
        
        print(f"[DEBUG] Image shape: {image_array.shape}")
        print(f"[DEBUG] Target color: {target_color}")
        print(f"[DEBUG] Image color range: min={np.min(image_array)}, max={np.max(image_array)}")
        
        # Create color mask with tolerance
        tolerance = 15  # Moderate tolerance for better precision with uncompressed images
        target = np.array(target_color)
        diff = np.abs(image_array - target)
        mask = np.all(diff <= tolerance, axis=2)
        
        print(f"[DEBUG] Pixels matching color (tolerance={tolerance}): {np.sum(mask)}")
        
        # Clean up mask with morphological operations
        mask = binary_closing(mask, structure=np.ones((3, 3)))
        mask = binary_opening(mask, structure=np.ones((3, 3)))
        
        print(f"[DEBUG] Pixels after morphological operations: {np.sum(mask)}")
        
        # Find connected components
        labeled_array, num_features = label(mask)
        
        print(f"[DEBUG] Connected components found: {num_features}")
        
        # Calculate centroids and filter by size
        min_area = 40  # Reasonable min area for uncompressed images
        cell_locations = []
        
        print(f"[DEBUG] Using min_area: {min_area}")
        
        for i in range(1, num_features + 1):
            component_mask = labeled_array == i
            area = np.sum(component_mask)
            
            print(f"[DEBUG] Component {i}: area={area}, min_area={min_area}")
            
            if area >= min_area:
                # Calculate centroid
                y_coords, x_coords = np.where(component_mask)
                cx, cy = int(np.mean(x_coords)), int(np.mean(y_coords))
                cell_locations.append([cx, cy])
                print(f"[DEBUG] Added cell at ({cx}, {cy})")
            else:
                print(f"[DEBUG] Component {i} too small (area={area} < {min_area})")
        
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
        
        print(f"[DEBUG] Final cell count: {len(cell_locations)}")
        print(f"[DEBUG] Cell locations: {cell_locations}")
        
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

# Process the uploaded image
target_color = (${targetColor.r}, ${targetColor.g}, ${targetColor.b})
result = count_cells("input_image.png", target_color)
print("RESULT_JSON:" + json.dumps(result))
`;

      console.log("[TEMPLOG] Executing Python code...");
      const response = await sandbox.process.codeRun(processingCode);
      
      console.log("[TEMPLOG] Python execution completed");
      console.log("[TEMPLOG] Response exitCode:", response.exitCode);
      
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
};

// Action to process images from Convex storage (for large images)
export const processCellImageFromStorage = action({
  args: {
    storageId: v.id("_storage"),
    targetColor: v.optional(v.object({
      r: v.number(),
      g: v.number(), 
      b: v.number()
    }))
  },
  handler: async (ctx, { storageId, targetColor = { r: 255, g: 38, b: 0 } }): Promise<ProcessingResult> => {
    console.log("=== PROCESSING CELL IMAGE FROM STORAGE ===");
    console.log("[TEMPLOG] Storage ID:", storageId);
    console.log("[TEMPLOG] Target color:", targetColor);
    
    try {
      // Download the image from storage
      console.log("[TEMPLOG] Downloading image from Convex storage...");
      const imageBlob = await ctx.storage.get(storageId);
      if (!imageBlob) {
        return {
          success: false,
          error: "Image not found in storage"
        };
      }
      
      // Convert blob to buffer
      const imageBuffer = await imageBlob.arrayBuffer();
      console.log("[TEMPLOG] Downloaded image size:", imageBuffer.byteLength, "bytes");
      console.log("[TEMPLOG] Size in MB:", (imageBuffer.byteLength / (1024 * 1024)).toFixed(2));
      
      // No compression needed - use original image quality for better cell detection
      console.log("[TEMPLOG] Using original image without compression for better cell detection...");
      
      // Convert to base64 for processing (preserve original format)
      const imageBase64 = `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`;
      console.log("[TEMPLOG] Base64 size:", imageBase64.length, "bytes");
      console.log("[TEMPLOG] Using uncompressed image for processing");
      
      // Now proceed with Daytona processing using the original image
      return await processWithDaytona(imageBase64, targetColor);
      
    } catch (error) {
      console.error("[TEMPLOG] Error processing image from storage:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error processing image from storage'
      };
    }
  }
});

// Action to process actual uploaded images (for smaller images)
export const processCellImage = action({
  args: {
    imageBase64: v.string(),
    targetColor: v.optional(v.object({
      r: v.number(),
      g: v.number(), 
      b: v.number()
    }))
  },
  handler: async (ctx, { imageBase64, targetColor = { r: 255, g: 38, b: 0 } }): Promise<ProcessingResult> => {
    console.log("=== PROCESSING CELL IMAGE ===");
    console.log("[TEMPLOG] Received imageBase64 length:", imageBase64.length);
    console.log("[TEMPLOG] Received imageBase64 prefix:", imageBase64.substring(0, 100));
    console.log("[TEMPLOG] Received targetColor:", targetColor);
    console.log("[TEMPLOG] Environment DAYTONA_API_KEY exists:", !!process.env.DAYTONA_API_KEY);
    
    // Check if image is too large and needs compression
    const maxSize = 4 * 1024 * 1024; // 4MB to stay under 5MB limit
    console.log("[TEMPLOG] Image size check - Current:", imageBase64.length, "bytes, Max allowed:", maxSize, "bytes");
    console.log("[TEMPLOG] Size in MB - Current:", (imageBase64.length / (1024 * 1024)).toFixed(2), "MB, Max:", (maxSize / (1024 * 1024)).toFixed(2), "MB");
    console.log("[TEMPLOG] Needs compression:", imageBase64.length > maxSize);
    
    if (imageBase64.length > maxSize) {
      console.log("[TEMPLOG] ⚠️  Image too large, starting compression...");
      console.log("[TEMPLOG] Original size before compression:", imageBase64.length, "bytes");
      
      const compressionResult: CompressionResult = await compressImageInline(imageBase64);
      
      console.log("[TEMPLOG] Compression completed, success:", compressionResult.success);
      if (compressionResult.success) {
        console.log("[TEMPLOG] Compression stats:");
        console.log("[TEMPLOG]   - Original size:", compressionResult.originalSize, "bytes");
        console.log("[TEMPLOG]   - Compressed size:", compressionResult.compressedSize, "bytes");
        console.log("[TEMPLOG]   - Compression ratio:", compressionResult.compressedSize && compressionResult.originalSize ? 
          (compressionResult.compressedSize / compressionResult.originalSize * 100).toFixed(1) + "%" : "unknown");
      }
      
      if (!compressionResult.success) {
        console.log("[TEMPLOG] ❌ Compression failed:", compressionResult.error);
        return {
          success: false,
          error: "Failed to compress image: " + compressionResult.error
        };
      }
      
      imageBase64 = compressionResult.compressedImage!;
      console.log("[TEMPLOG] ✅ Using compressed image, new size:", imageBase64.length, "bytes");
      console.log("[TEMPLOG] New size in MB:", (imageBase64.length / (1024 * 1024)).toFixed(2), "MB");
      console.log("[TEMPLOG] Compressed image still under limit:", imageBase64.length <= maxSize);
    } else {
      console.log("[TEMPLOG] ✅ Image size OK, no compression needed");
    }
    
    try {
      console.log("[TEMPLOG] 🚀 About to send to Daytona - Final checks:");
      console.log("[TEMPLOG] Final imageBase64 length:", imageBase64.length, "bytes");
      console.log("[TEMPLOG] Final size in MB:", (imageBase64.length / (1024 * 1024)).toFixed(2), "MB");
      console.log("[TEMPLOG] Under 5MB limit:", imageBase64.length < (5 * 1024 * 1024));
      console.log("[TEMPLOG] Convex action arg size estimate:", Math.round(imageBase64.length * 1.1), "bytes (with overhead)");
      
      console.log("[TEMPLOG] Initializing Daytona client...");
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY || 'YOUR_API_KEY',
      });

      let sandbox;
      try {
        console.log("[TEMPLOG] Creating Daytona sandbox...");
        sandbox = await daytona.create({
          language: "python",
        });
        console.log("[TEMPLOG] Sandbox created successfully");
        
        // Install packages first
        console.log("[TEMPLOG] Installing Python packages...");
        await sandbox.process.codeRun(
          'import subprocess; subprocess.run(["pip", "install", "numpy", "pillow", "scipy"], check=True)'
        );
        console.log("[TEMPLOG] Package installation complete");
        
        // Use a much better approach - upload the image as a file and reference it in Python
        console.log("[TEMPLOG] About to upload image file to sandbox...");
        
        // Convert base64 to buffer and upload as file
        console.log("[TEMPLOG] Extracting base64 data for file upload...");
        const base64Data = imageBase64.split(',')[1]; // Remove data:image/png;base64, prefix
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        console.log("[TEMPLOG] Image buffer size for upload:", imageBuffer.length, "bytes");
        console.log("[TEMPLOG] Buffer size in MB:", (imageBuffer.length / (1024 * 1024)).toFixed(2), "MB");
        
        await sandbox.fs.uploadFile(imageBuffer, "input_image.png");
        console.log("[TEMPLOG] ✅ Image file uploaded successfully to sandbox");
        
        const processingCode = `
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, binary_opening, binary_closing
import base64
import io
import json

def count_cells(image_path: str, target_color: tuple = (255, 38, 0)) -> dict:
    """Process image file and return cell count results"""
    try:
        # Load image from file
        image = Image.open(image_path).convert('RGB')
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
        
        print(f"[DEBUG] Final cell count: {len(cell_locations)}")
        print(f"[DEBUG] Cell locations: {cell_locations}")
        
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

# Process the uploaded image
target_color = (${targetColor.r}, ${targetColor.g}, ${targetColor.b})
result = count_cells("input_image.png", target_color)
print("RESULT_JSON:" + json.dumps(result))
`;

        console.log("[TEMPLOG] Created processing code, length:", processingCode.length);
        console.log("[TEMPLOG] About to execute Python code...");
        
        const response = await sandbox.process.codeRun(processingCode);
        
        console.log("[TEMPLOG] Python execution completed");
        console.log("[TEMPLOG] Response exitCode:", response.exitCode);
        console.log("[TEMPLOG] Response result length:", response.result?.length || 0);
        
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