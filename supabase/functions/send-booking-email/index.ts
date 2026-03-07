import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL     = 'onboarding@resend.dev';
const SALON_EMAIL    = 'billtsitisback@gmail.com';
const SALON_NAME     = 'Μορφές κομμωτήριο & barbershop';
const SALON_PHONE    = '231 083 6982';

const GR_DAYS   = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
const GR_MONTHS = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου',
                   'Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return GR_DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + GR_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function sliceTime(t: string): string {
  return t ? t.slice(0, 5) : '';
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:     FROM_EMAIL,
      to,
      subject,
      html,
      reply_to: SALON_EMAIL,
    }),
  });
  return res;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { booking, service } = await req.json();

    const dateStr  = formatDate(booking.date);
    const start    = sliceTime(booking.start_time);
    const end      = sliceTime(booking.end_time);
    const svcName  = service?.name ?? 'Υπηρεσία';

    // ── Email to customer (only if they provided email) ──────────────────────
    if (booking.customer_email) {
      const customerHtml = `
<!DOCTYPE html>
<html lang="el">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1c2418;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1c2418;padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#252e1e;border:1px solid rgba(131,148,44,0.2);border-radius:12px;overflow:hidden;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#2e3b29,#374231);padding:36px 40px;text-align:center;border-bottom:1px solid rgba(131,148,44,0.15);">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(154,170,53,0.7);">Κομμωτήριο &amp; Barbershop</p>
          <h1 style="margin:0;font-size:36px;font-style:italic;font-weight:300;color:#ffffff;font-family:Georgia,serif;">Μορφές</h1>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#ffffff;">✅ Το ραντεβού σας επιβεβαιώθηκε!</p>
          <p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.5);">
            Γεια σας <strong style="color:rgba(255,255,255,0.8);">${booking.customer_name}</strong>, σας περιμένουμε!
          </p>

          <!-- Summary box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(131,148,44,0.15);border-radius:8px;margin-bottom:28px;">
            <tr>
              <td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.4);">Υπηρεσία</td>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#ffffff;text-align:right;font-weight:600;">${svcName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.4);">Ημερομηνία</td>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#ffffff;text-align:right;font-weight:600;">${dateStr}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,0.4);">Ώρα</td>
                    <td style="padding:8px 0;font-size:13px;color:#9aaa35;text-align:right;font-weight:700;font-size:15px;">${start} – ${end}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.4);">Για αλλαγές ή ακύρωση:</p>
          <a href="tel:2310836982" style="font-size:16px;font-weight:700;color:#9aaa35;text-decoration:none;">${SALON_PHONE}</a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px 40px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">Δελφών 95, Θεσσαλονίκη 546 44</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

      await sendEmail(
        booking.customer_email,
        `✅ Επιβεβαίωση ραντεβού — ${svcName} ${start}`,
        customerHtml,
      );
    }

    // ── Notification email to salon ──────────────────────────────────────────
    const salonHtml = `
<!DOCTYPE html>
<html lang="el">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:30px 20px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:white;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;">

      <tr>
        <td style="background:#374231;padding:24px 32px;">
          <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(154,170,53,0.8);">Νέα Κράτηση</p>
          <h2 style="margin:6px 0 0;font-size:20px;font-style:italic;font-weight:300;color:white;font-family:Georgia,serif;">Μορφές</h2>
        </td>
      </tr>

      <tr>
        <td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;width:40%;">Πελάτης</td>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:600;">${booking.customer_name}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Τηλέφωνο</td>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:600;">${booking.customer_phone}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Email</td>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#111827;">${booking.customer_email || '—'}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Υπηρεσία</td>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:600;">${svcName}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Ημερομηνία</td>
              <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:600;">${dateStr}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#6b7280;">Ώρα</td>
              <td style="padding:7px 0;color:#83942C;font-weight:700;font-size:16px;">${start} – ${end}</td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    await sendEmail(
      SALON_EMAIL,
      `📅 Νέα κράτηση — ${booking.customer_name} · ${svcName} ${start}`,
      salonHtml,
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
