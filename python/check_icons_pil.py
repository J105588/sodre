
from PIL import Image
import os

files = ['c:\\dev\\sodre\\img\\icon-192.png', 'c:\\dev\\sodre\\img\\icon-512.png']

for file_path in files:
    try:
        with Image.open(file_path) as img:
            print(f"File: {os.path.basename(file_path)}")
            print(f"Format: {img.format}")
            print(f"Size: {img.size}")
            print("-" * 20)
    except Exception as e:
        print(f"Error checking {file_path}: {e}")
