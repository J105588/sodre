from PIL import Image
import collections
import colorsys

def extract_colors(image_path, num_colors=10):
    try:
        img = Image.open(image_path)
        img = img.resize((150, 150))
        img = img.convert('RGB')
        
        pixels = list(img.getdata())
        
        # Filter for colors with some saturation to find "rich" colors
        colorful_pixels = []
        gray_pixels = []
        
        for r, g, b in pixels:
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            if s > 0.1: # Threshold for "color" vs "gray"
                colorful_pixels.append((r, g, b))
            else:
                gray_pixels.append((r, g, b))
        
        # If we found colorful pixels, prioritize them
        target_pixels = colorful_pixels if len(colorful_pixels) > 100 else pixels
        
        # Simple clustering/counting
        quantized = []
        for r, g, b in target_pixels:
             # Finer quantization
            qr = round(r / 16) * 16
            qg = round(g / 16) * 16
            qb = round(b / 16) * 16
            quantized.append((qr, qg, qb))

        counts = collections.Counter(quantized)
        most_common = counts.most_common(num_colors)
        
        hex_colors = []
        for color, count in most_common:
            r, g, b = color
            r = min(255, max(0, r))
            g = min(255, max(0, g))
            b = min(255, max(0, b))
            hex_colors.append('#{:02x}{:02x}{:02x}'.format(r, g, b))
            
        print("COLORS_START")
        for c in hex_colors:
            print(c)
        print("COLORS_END")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_colors('img/2.png')
