/**
 * SocioChat /free-training — Google Apps Script Web App.
 *
 * Deploy:
 *   1. Create a NEW Google Sheet. Rename the first tab to "Optin_Leads".
 *      Add a second tab called "Call_Bookings".
 *   2. Extensions → Apps Script. Paste this whole file into Code.gs. Save.
 *   3. Deploy → New Deployment → Type: "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Copy the resulting /exec URL.
 *   4. Paste the /exec URL into public/free-training/index.html, replacing
 *      the SHEET_WEBAPP_URL placeholder. Rebuild + redeploy the SocioChat FE.
 *
 * The page posts text/plain JSON (no CORS preflight). Routing is by the
 * `form` field: "optin" → Optin_Leads tab, "booking" → Call_Bookings tab.
 */

const SHEET_OPTIN = 'Optin_Leads';
const SHEET_BOOKING = 'Call_Bookings';

const HEADERS_OPTIN = [
  'Timestamp',
  'Full Name',
  'Email',
  'Country Code',
  'Phone',
  'Full Phone',
  'WhatsApp Consent',
  'Page URL',
  'fbclid'
];

const HEADERS_BOOKING = [
  'Timestamp',
  'Full Name',
  'Email',
  'Social Media Link',
  'Website Link',
  'Preferred Date',
  'Preferred Time Slot',
  'Phone (from opt-in)',
  'Page URL',
  'fbclid'
];

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const form = String(data.form || '').toLowerCase();
    const now = new Date();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (form === 'optin') {
      const sheet = ensureSheet(ss, SHEET_OPTIN, HEADERS_OPTIN);
      sheet.appendRow([
        now,
        data.full_name || '',
        data.email || '',
        data.country_code || '',
        data.phone || '',
        data.full_phone || '',
        data.whatsapp_consent === true ? 'TRUE' : 'FALSE',
        data.page || '',
        data.fbclid || ''
      ]);
    } else if (form === 'booking') {
      const sheet = ensureSheet(ss, SHEET_BOOKING, HEADERS_BOOKING);
      sheet.appendRow([
        now,
        data.full_name || '',
        data.email || '',
        data.social_link || '',
        data.website || '',
        data.preferred_date || '',
        data.preferred_time || '',
        data.phone_from_optin || '',
        data.page || '',
        data.fbclid || ''
      ]);
    } else {
      return jsonOut({ ok: false, error: 'unknown form: ' + form });
    }

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonOut({ ok: true, status: 'alive' });
}

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
