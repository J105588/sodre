/**
 * GAS Script for sending OTP via Email (SoDRé)
 * 
 * Instructions:
 * 1. Create a new Google Apps Script project.
 * 2. Copy this code into `Code.gs`.
 * 3. Add Supabase Library or use UrlFetchApp to Insert OTP.
 *    (Simpler: GAS Generates OTP -> GAS Inserts to Supabase -> GAS Sends Email)
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone).
 * 5. Paste the Web App URL into `c:/dev/sodre/config.js` or `login.js`.
 */

// CONFIGURATION
const SUPABASE_URL = 'https://qrbayooyblmffolcstgg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YOUR_SERVICE_ROLE_KEY_HERE'; // Requires SERVICE_ROLE key to insert into verification_codes if RLS is strict

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const email = data.email;

        if (!email) {
            return ContentService.createTextOutput(JSON.stringify({ error: 'Email required' }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // 1. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Insert to Supabase
        const result = insertOtpToSupabase(email, otp);

        if (!result.success) {
            return ContentService.createTextOutput(JSON.stringify({ error: 'Database Error: ' + result.error }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // 3. Send Email
        MailApp.sendEmail({
            to: email,
            subject: '[SoDRé] Password Reset Verification Code',
            body: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`
        });

        return ContentService.createTextOutput(JSON.stringify({ success: true }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function insertOtpToSupabase(email, otp) {
    const endpoint = `${SUPABASE_URL}/rest/v1/verification_codes`;
    const expiration = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins

    const payload = {
        email: email,
        code: otp,
        expires_at: expiration
    };

    const options = {
        method: 'post',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const code = response.getResponseCode();

    if (code >= 200 && code < 300) {
        return { success: true };
    } else {
        return { success: false, error: response.getContentText() };
    }
}
