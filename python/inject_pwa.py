import os

root_dir = r"c:\dev\sodre"
scripts_to_add = '\n    <script src="pwa-install.js"></script>\n    <script src="pwa-update.js"></script>\n'
# Also handling nested files by using absolute path or fixing src?
# If file is in subfolder, src="pwa-install.js" might be wrong. It should be src="/pwa-install.js" (absolute from root).
# Verified: sw.js registration uses '/sw.js', so likely server root is mounted.
# Let's use root relative paths: src="/pwa-install.js" and src="/pwa-update.js" just to be safe for nested files?
# Previous edits used relative. "pwa-install.js".
# For `member/leo.html`, `src="pwa-install.js"` would look for `member/pwa-install.js`.
# So I MUST use `/pwa-install.js` or handle relative path.
# Given it's a PWA, usually served from root.
# I will use `/pwa-install.js` and `/pwa-update.js` for ALL files to ensure it works from subdirectories too.
# Wait, did I use `/` in previous manual edits?
# Checked Step 212: `src="pwa-install.js"`.
# This works for root files.
# For nested files, I definitely need `/`.
# I will update the script to use `/`.
# And I should probably update the root files to use `/` too for consistency, or just leave them if they work.
# Actually, I'll use `/` for this batch to be safe.

scripts_to_add_absolute = '\n    <script src="/pwa-install.js"></script>\n    <script src="/pwa-update.js"></script>\n'

target_files = []
for dirpath, dirnames, filenames in os.walk(root_dir):
    for filename in filenames:
        if filename.lower().endswith(".html"):
            # Skip already handled files (or check content)
            # handled: index.html, login.html, admin.html, members-area.html
            # But I should verify if they have it.
            # Actually, the user asked to apply to ALL.
            # If I append again, it duplicates.
            # I'll check if "pwa-install.js" is in file content.
            
            filepath = os.path.join(dirpath, filename)
            
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if "pwa-install.js" in content:
                print(f"Skipping {filename} (already present)")
                continue
                
            # Inject before </body>
            if "</body>" in content:
                new_content = content.replace("</body>", scripts_to_add_absolute + "</body>")
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filename}")
            else:
                print(f"Skipping {filename} (no body tag)")
