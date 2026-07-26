import { expect, test } from '@playwright/test';

const apiBase = process.env.API_URL ?? 'http://127.0.0.1:3001/api';

test('API health endpoint is available for coach workflows', async ({ request }) => {
  const response = await request.get(`${apiBase}/health`);

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({
    status: 'ok',
    service: '23primefit-api',
  });
});
