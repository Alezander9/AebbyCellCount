# No longer used, all python code is not in convex/actions/daytona.ts


import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from typing import Tuple, List
from scipy.ndimage import label, binary_opening, binary_closing


def count_cells(input_path: str, output_path: str, target_color: Tuple[int, int, int]) -> Tuple[int, List[Tuple[int, int]]]:
    """
    Load an image, detect cells of a specific color, and save the result.
    
    Args:
        input_path: Path to input image
        output_path: Path to save output image
        target_color: RGB color tuple to detect (e.g., (255, 0, 0) for red)
    
    Returns:
        Tuple of (cell_count, cell_locations) where locations are (x, y) centroids
    """
    # Load image
    image = Image.open(input_path).convert('RGB')
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
            cell_locations.append((cx, cy))
    
    # Create output image with detected cells marked
    output_image = image.copy()
    draw = ImageDraw.Draw(output_image)
    
    for i, (cx, cy) in enumerate(cell_locations):
        # Draw circle at cell center
        draw.ellipse([cx-8, cy-8, cx+8, cy+8], outline=(255, 255, 0), width=2)
        # Add cell number
        draw.text((cx-10, cy-20), str(i + 1), fill=(255, 255, 0))
    
    # Save output image
    output_image.save(output_path)
    
    cell_count = len(cell_locations)
    print(f"Found {cell_count} cells in {Path(input_path).name}")
    print(f"Cell locations: {cell_locations}")
    
    return cell_count, cell_locations


def process_all_images(input_dir: str = "input_images", output_dir: str = "output_images", 
                      target_color: Tuple[int, int, int] = (255, 0, 0)) -> None:
    """Process all images in input directory and save results to output directory."""
    input_path, output_path = Path(input_dir), Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'}
    image_files = [f for f in input_path.iterdir() 
                  if f.is_file() and f.suffix.lower() in image_extensions]
    
    if not image_files:
        print(f"No image files found in {input_dir}")
        return
    
    total_cells = 0
    for image_file in sorted(image_files):
        try:
            temp_output = output_path / f"{image_file.stem}_temp{image_file.suffix}"
            cell_count, _ = count_cells(str(image_file), str(temp_output), target_color)
            total_cells += cell_count
            
            final_output = output_path / f"{image_file.stem}_cell_count_{cell_count}_{image_file.suffix}"
            temp_output.rename(final_output)
            print(f"Processed {image_file.name} -> {final_output.name}")
            
        except Exception as e:
            print(f"Error processing {image_file.name}: {e}")
    
    print(f"Total cells found across all images: {total_cells}")

def main():
    """
    Main function to process all images in input_images/ directory.
    Detects red cells by default, but color can be customized.
    """
    print("Starting cell counting process...")
    
    red_color_hex = "FF2600"
    target_color = tuple(int(red_color_hex[i:i+2], 16) for i in (0, 2, 4))
    process_all_images("input_images", "output_images", target_color)
    
    print("Cell counting process completed!")


if __name__ == "__main__":
    main()
