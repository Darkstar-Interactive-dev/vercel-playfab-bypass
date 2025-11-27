// Diagnostic endpoint to see what IPs are being sent
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const headers = req.headers;
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Get Vercel's actual outgoing IP by making a request to an IP echo service
    const https = require('https');

    let vercelOutgoingIp = 'unknown';

    try {
        const ipCheckPromise = new Promise((resolve, reject) => {
            https.get('https://api.ipify.org?format=json', (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.ip);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        vercelOutgoingIp = await ipCheckPromise;
    } catch (e) {
        vercelOutgoingIp = 'error: ' + e.message;
    }

    return res.status(200).json({
        message: "IP Diagnostic Information",
        clientIpSeenByVercel: clientIp,
        vercelOutgoingIp: vercelOutgoingIp,
        allHeaders: headers,
        whatPlayFabWillSee: vercelOutgoingIp,
        note: "PlayFab should see 'vercelOutgoingIp' not 'clientIpSeenByVercel'"
    });
};
