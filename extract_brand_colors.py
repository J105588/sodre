from PIL import Image
import collections
import colorsys

def extract_colors(image_path, num_colors=10):
    try:
        img = Image.open(image_path)
        img = img.resize((150, 150))
        img = img.convert('RGB')
        
        pixels = list(img.getdata())
        
        # Filter for specific hues to find the Blue and Green
        blue_pixels = []
        green_pixels = []
        orange_pixels = []
        
        for r, g, b in pixels:
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            if s > 0.3 and v > 0.3:
                # Orange/Yellow
                if 0.05 < h < 0.15:
                    orange_pixels.append((r, g, b))
                # Green
                elif 0.2 < h < 0.4:
                    green_pixels.append((r, g, b))
                # Blue
                elif 0.5 < h < 0.7:
                    blue_pixels.append((r, g, b))

        def get_dominant(px_list):
            if not px_list: return None
            # simple average or most common
            q = []
            for r, g, b in px_list:
                qr = round(r / 10) * 10
                qg = round(g / 10) * 10
                qb = round(b / 10) * 10
                q.append((qr, qg, qb))
            return collections.Counter(q).most_common(1)[0][0]

        dom_orange = get_dominant(orange_pixels)
        dom_green = get_dominant(green_pixels)
        dom_blue = get_dominant(blue_pixels)
        
        final_colors = []
        if dom_orange: final_colors.append(dom_orange)
        if dom_green: final_colors.append(dom_green)
        if dom_blue: final_colors.append(dom_blue)

        print("COLORS_START")
        for r, g, b in final_colors:
            print('#{:02x}{:02x}{:02x}'.format(r, g, b))
        print("COLORS_END")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Using the path provided in the user metadata
    path = r'C:/Users/linux/.gemini/antigravity/brain/5f1bd079-48f2-486a-8b7c-35653ced5026/uploaded_media_1769880676975.png'
    extract_colors(path)
