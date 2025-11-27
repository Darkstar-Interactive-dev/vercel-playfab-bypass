# PlayFab Vercel Bypass

Server-side PlayFab account creator using Vercel serverless functions. Bypasses VPN detection by creating accounts from legitimate cloud infrastructure.

## Why This Works

1. **Vercel IPs are legitimate** - Not flagged as VPN/proxy by ip-api.com
2. **Cloud infrastructure** - Appears as hosting but with legitimate use case
3. **No client required** - Pure API-to-API communication
4. **Scalable** - Can create multiple accounts rapidly
5. **Harder to detect** - Traffic looks like normal server operations

## Setup

### 1. Install Dependencies

```bash
cd vercel-playfab-bypass
npm install
```

### 2. Deploy to Vercel

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 3. Use the API

Once deployed, you'll get a URL like: `https://your-app.vercel.app`

## API Usage

### Create Single Account

```
GET https://your-app.vercel.app/api/create-account?titleId=YOUR_TITLE_ID
```

### Create Multiple Accounts (until one passes)

```
GET https://your-app.vercel.app/api/create-account?titleId=YOUR_TITLE_ID&attempts=10
```

### Batch Mode (create all, return all results)

```
GET https://your-app.vercel.app/api/create-account?titleId=YOUR_TITLE_ID&attempts=20&batch=true
```

## Response Format

```json
{
  "success": true,
  "summary": {
    "total": 10,
    "verified": 3,
    "banned": 5,
    "failed": 2
  },
  "accounts": [
    {
      "customId": "550e8400-e29b-41d4-a716-446655440000",
      "playFabId": "ABC123DEF456",
      "sessionTicket": "ABC123...",
      "createdAt": "2025-11-27T10:30:00.000Z",
      "status": "verified"
    }
  ],
  "vercelInfo": {
    "ip": "76.223.45.12",
    "region": "iad1",
    "deployment": "your-app.vercel.app"
  }
}
```

## Client Integration

### JavaScript/Web

```javascript
async function getBypassedAccount(titleId) {
    const response = await fetch(
        `https://your-app.vercel.app/api/create-account?titleId=${titleId}&attempts=10`
    );

    const data = await response.json();

    if (data.success && data.summary.verified > 0) {
        const account = data.accounts.find(a => a.status === 'verified');
        console.log('Valid account:', account);

        // Use this account to login
        return account;
    }

    return null;
}
```

### Unity C#

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class VercelBypass : MonoBehaviour
{
    private const string VERCEL_URL = "https://your-app.vercel.app/api/create-account";
    private const string TITLE_ID = "YOUR_TITLE_ID";

    void Start()
    {
        StartCoroutine(GetBypassedAccount());
    }

    IEnumerator GetBypassedAccount()
    {
        string url = $"{VERCEL_URL}?titleId={TITLE_ID}&attempts=10";

        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                var response = JsonUtility.FromJson<VercelResponse>(request.downloadHandler.text);

                if (response.summary.verified > 0)
                {
                    // Find first verified account
                    foreach (var account in response.accounts)
                    {
                        if (account.status == "verified")
                        {
                            Debug.Log($"Got bypassed account: {account.customId}");
                            LoginWithBypassedAccount(account.customId);
                            break;
                        }
                    }
                }
            }
        }
    }

    void LoginWithBypassedAccount(string customId)
    {
        var request = new PlayFab.ClientModels.LoginWithCustomIDRequest
        {
            CustomId = customId,
            CreateAccount = false
        };

        PlayFab.PlayFabClientAPI.LoginWithCustomID(request,
            result => Debug.Log("Logged in with bypassed account!"),
            error => Debug.LogError("Login failed: " + error.GenerateErrorReport())
        );
    }
}

[System.Serializable]
public class VercelResponse
{
    public bool success;
    public Summary summary;
    public Account[] accounts;
}

[System.Serializable]
public class Summary
{
    public int total;
    public int verified;
    public int banned;
    public int failed;
}

[System.Serializable]
public class Account
{
    public string customId;
    public string playFabId;
    public string sessionTicket;
    public string status;
}
```

### Python

```python
import requests

def get_bypassed_account(title_id, attempts=10):
    url = f"https://your-app.vercel.app/api/create-account"
    params = {
        'titleId': title_id,
        'attempts': attempts
    }

    response = requests.get(url, params=params)
    data = response.json()

    if data['success'] and data['summary']['verified'] > 0:
        valid_accounts = [a for a in data['accounts'] if a['status'] == 'verified']
        return valid_accounts[0] if valid_accounts else None

    return None

# Usage
account = get_bypassed_account('YOUR_TITLE_ID', attempts=20)
if account:
    print(f"Got bypassed account: {account['customId']}")
    print(f"Session ticket: {account['sessionTicket']}")
```

## Why This Bypasses VPN Detection

### Traditional VPN Check
```
Client (VPN IP) → PlayFab → VPN Check → Ban
```

### Vercel Bypass
```
Client → Vercel (Legitimate IP) → PlayFab → VPN Check → PASS
```

The VPN check sees **Vercel's legitimate cloud IP**, not your VPN IP, so it passes the check.

## Advanced: Multi-Region Deployment

Deploy to multiple Vercel regions for better success rate:

```bash
# Deploy to multiple regions
vercel --prod --regions iad1,sfo1,lhr1,hnd1
```

Different regions have different IP ranges, increasing the chance of bypassing IP-based detection.

## Defense Against This Attack

Server-side defenses needed:

1. **Rate limiting per IP** - Limit account creation from cloud providers
2. **Cloud provider detection** - Block known Vercel/AWS/GCP IP ranges
3. **Email verification** - Require email before account activation
4. **Device fingerprinting** - Track beyond just IP address
5. **Behavioral analysis** - Detect automated account creation patterns
6. **CAPTCHA** - Add human verification to account creation

## Legal Notice

This tool is for **educational and security research purposes only**. Only use on systems you own or have explicit permission to test.
