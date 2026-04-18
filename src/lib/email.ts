type OrderItem = {
  name: string;
  quantity: number;
  unit_amount_pence: number;
};

export async function sendOrderConfirmation(opts: {
  to: string;
  customerName?: string | null;
  orderId: string;
  amountTotalPence: number;
  currency: string;
  items: OrderItem[];
}) {
  const key = import.meta.env.RESEND_API_KEY as string;
  if (!key) {
    console.warn('RESEND_API_KEY missing — skipping email');
    return { skipped: true };
  }

  const fmt = (pence: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: (opts.currency || 'gbp').toUpperCase(),
    }).format(pence / 100);

  const rows = opts.items
    .map(
      (i) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #2a2a2a;color:#f2ece2;">
            ${escapeHtml(i.name)} <span style="color:#7e7569;">× ${i.quantity}</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #2a2a2a;text-align:right;color:#d6a16a;font-variant-numeric:tabular-nums;">
            ${fmt(i.unit_amount_pence * i.quantity)}
          </td>
        </tr>`
    )
    .join('');

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#0a0a0a;color:#f2ece2;padding:40px 0;">
    <table style="max-width:560px;margin:0 auto;background:#111111;border:1px solid #242424;">
      <tr><td style="padding:36px 36px 8px 36px;">
        <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:-0.01em;color:#f2ece2;">Candle Atelier</div>
        <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7e7569;margin-top:8px;">Order confirmed</div>
      </td></tr>
      <tr><td style="padding:12px 36px 4px 36px;">
        <p style="color:#bdb3a4;line-height:1.7;margin:18px 0;">
          ${opts.customerName ? `Dear ${escapeHtml(opts.customerName)},` : 'Hello,'}
          <br/>Thank you. Your candles are being hand-finished and will ship within 3 working days.
        </p>
      </td></tr>
      <tr><td style="padding:8px 36px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}
          <tr>
            <td style="padding:18px 0 6px 0;color:#7e7569;text-transform:uppercase;letter-spacing:0.15em;font-size:11px;">Total</td>
            <td style="padding:18px 0 6px 0;text-align:right;color:#f2ece2;font-size:18px;">${fmt(opts.amountTotalPence)}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 36px 36px 36px;">
        <p style="color:#7e7569;font-size:12px;line-height:1.7;margin:24px 0 0 0;">
          Order ref <span style="color:#bdb3a4;">${escapeHtml(opts.orderId)}</span><br/>
          Questions? Reply to this email and a human will answer.
        </p>
      </td></tr>
    </table>
    <div style="text-align:center;color:#4a463e;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-top:24px;">
      Hand poured · Small batch
    </div>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Candle Atelier <onboarding@resend.dev>',
      to: [opts.to],
      subject: `Order confirmed — Candle Atelier`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Resend error', res.status, body);
    return { skipped: false, ok: false, error: body };
  }
  return { skipped: false, ok: true };
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
