import json
import urllib.request
import urllib.error

# URL from config.js
GAS_URL = 'https://script.google.com/macros/s/AKfycbzpwAlodnnKDN0VTQI5nzoOXsdOnN7I962ll6o_6hOlE3WdPFaQNvdXpQJt776ThF8/exec'

def test_gas():
    payload = {'email': 'test_verification@example.com'}
    data = json.dumps(payload).encode('utf-8')
    
    headers = {'Content-Type': 'application/json'}
    req = urllib.request.Request(GAS_URL, data=data, headers=headers, method='POST')
    
    print(f"Sending request to {GAS_URL}...")
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Status Code: {response.status}")
            response_body = response.read().decode('utf-8')
            print("Response Body:", response_body)
            
            try:
                json_data = json.loads(response_body)
                if json_data.get('success'):
                    print("SUCCESS: Endpoint accepted the request.")
                else:
                    print(f"FAILURE: Endpoint returned error: {json_data.get('error')}")
            except json.JSONDecodeError:
                print("Response is not JSON.")
                
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.reason}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == '__main__':
    test_gas()
