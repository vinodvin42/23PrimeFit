/**
 * Manual webhook E2E helper — posts a demo Razorpay payload.
 * Usage (API running, AUTH not required for webhook):
 *   npx ts-node scripts/razorpay-webhook-smoke.ts
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001/api';

async function main() {
  const body = {
    payload: {
      payment: {
        entity: {
          order_id: process.env.RAZORPAY_TEST_ORDER_ID ?? 'order_demo_smoke',
        },
      },
    },
  };
  const res = await fetch(`${API}/webhooks/razorpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log('status', res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
