# upload_images.ps1
# Helper script to upload images from local img/ to data.sodre.jp/img/
# Note: This script requires 'curl' and valid server access if using an API.
# If you are using FTP/SFTP, please upload the contents of the 'img' directory 
# (excluding pwa-icon.png) to the 'img' directory on data.sodre.jp.

$IMAGE_DIR = "img"
$REMOTE_URL = "https://data.sodre.jp/api/upload.php" # Adjust if there is a specific bulk upload API

Write-Host "Please upload all files from the '$IMAGE_DIR' directory to 'https://data.sodre.jp/img/'" -ForegroundColor Cyan
Write-Host "Exception: 'pwa-icon.png' should remain local." -ForegroundColor Yellow

# Example curl command for a single file if the API supports it:
# curl -X POST -H "Authorization: Bearer <TOKEN>" -F "files[]=@img/logo.webp" https://data.sodre.jp/api/upload.php
