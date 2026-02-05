import json
import urllib.request
import urllib.error
import os

# Config
SUPABASE_URL = 'https://qrbayooyblmffolcstgg.supabase.co'
# Using the key the user provided in the previous step (retrieved from file history)
# I will use the one currently in the file c:\dev\sodre\GAS\gas_script_password_reset.gs
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyYmF5b295YmxtZmZvbGNzdGdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEwNzU0MCwiZXhwIjoyMDg1NjgzNTQwfQ.pWlUSd8_qsP2M2GD67Ltov_01qqLJqB9rb2X5tT6eys'

def check_verification_codes():
    url = f"{SUPABASE_URL}/rest/v1/verification_codes?select=*&order=created_at.desc&limit=5"
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f"Bearer {SUPABASE_KEY}",
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    print(f"Checking Supabase table: {url}")
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Status Code: {response.status}")
            data = json.loads(response.read().decode('utf-8'))
            print("Recent Verification Codes:")
            for item in data:
                print(f"- Time: {item.get('created_at')}, Email: {item.get('email')}, Code: {item.get('code')}")
                
            if not data:
                print("No recent verification codes found.")
                
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.reason}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == '__main__':
    check_verification_codes()
