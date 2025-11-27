// Vercel Serverless Function - PlayFab Account Creator Bypass
// Deploy to Vercel and access via: https://your-app.vercel.app/api/create-account

const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Helper function to make PlayFab API requests
function playfabRequest(titleId, endpoint, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);

        const options = {
            hostname: `${titleId}.playfabapi.com`,
            path: `/Client/${endpoint}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode === 200 && parsed.data) {
                        resolve(parsed);
                    } else {
                        reject(parsed);
                    }
                } catch (e) {
                    reject({ error: 'Failed to parse response', raw: responseData });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

// Main handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { titleId, attempts = 1, batch = false } = req.query;

        if (!titleId) {
            return res.status(400).json({
                error: 'Missing titleId parameter',
                usage: '/api/create-account?titleId=YOUR_TITLE_ID&attempts=10'
            });
        }

        console.log(`[*] Creating account(s) for title: ${titleId}`);
        console.log(`[*] Attempts: ${attempts}`);
        console.log(`[*] Vercel IP: ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);

        const results = [];
        const maxAttempts = Math.min(parseInt(attempts), 100); // Cap at 100

        for (let i = 0; i < maxAttempts; i++) {
            const customId = uuidv4();

            console.log(`[*] Attempt ${i + 1}/${maxAttempts}: ${customId}`);

            try {
                // Create account
                const loginResult = await playfabRequest(titleId, 'LoginWithCustomID', {
                    TitleId: titleId,
                    CustomId: customId,
                    CreateAccount: true
                });

                const accountData = {
                    customId: customId,
                    playFabId: loginResult.data.PlayFabId,
                    sessionTicket: loginResult.data.SessionTicket,
                    createdAt: new Date().toISOString(),
                    status: 'created'
                };

                console.log(`[+] Account created: ${loginResult.data.PlayFabId}`);

                // Wait 5 seconds to see if account survives VPN check
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Verify account is still active
                try {
                    await playfabRequest(titleId, 'GetAccountInfo', {});
                    accountData.status = 'verified';
                    console.log(`[+++] Account survived VPN check!`);
                } catch (verifyError) {
                    accountData.status = 'banned';
                    console.log(`[-] Account was banned by VPN check`);
                }

                results.push(accountData);

                // If we found a valid account and not in batch mode, return immediately
                if (accountData.status === 'verified' && !batch) {
                    console.log(`[!] Valid account found, returning immediately`);
                    break;
                }

            } catch (error) {
                console.error(`[-] Failed to create account: ${error.errorMessage || error.message}`);
                results.push({
                    customId: customId,
                    status: 'failed',
                    error: error.errorMessage || error.message
                });
            }

            // Small delay between attempts
            if (i < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Summary
        const verified = results.filter(r => r.status === 'verified');
        const banned = results.filter(r => r.status === 'banned');
        const failed = results.filter(r => r.status === 'failed');

        return res.status(200).json({
            success: true,
            summary: {
                total: results.length,
                verified: verified.length,
                banned: banned.length,
                failed: failed.length
            },
            accounts: results,
            vercelInfo: {
                ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                region: process.env.VERCEL_REGION || 'unknown',
                deployment: process.env.VERCEL_URL || 'local'
            }
        });

    } catch (error) {
        console.error('[!] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
