
try:
    with open(r'c:\dev\sodre\img\pwa-icon.png', 'rb') as f:
        header = f.read(8)
        print(f"Header: {header.hex()}")
        if header.startswith(b'\x89PNG\r\n\x1a\n'):
            print("Format: PNG")
        elif header.startswith(b'\xff\xd8'):
            print("Format: JPEG")
        elif header.startswith(b'RIFF') and header[8:12] == b'WEBP':
            print("Format: WEBP")
        else:
            print("Format: Unknown")
except Exception as e:
    print(f"Error: {e}")
