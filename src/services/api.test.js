import axios from 'axios';
import './api';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  })),
}));

const reject = axios.create.mock.results[0].value.interceptors.response.use.mock.calls[0][1];

test('a rejected login stays on the page and preserves the error for the sign-in form', async () => {
  const error = { config: { url: '/auth/login' }, response: { status: 401, data: { error: 'Invalid credentials.' } } };
  localStorage.setItem('token', 'synthetic-current-session');
  localStorage.setItem('user', 'synthetic-current-user');
  const location = window.location.href;
  try {
    await expect(reject(error)).rejects.toBe(error);
    expect(window.location.href).toBe(location);
    expect(localStorage.getItem('token')).toBe('synthetic-current-session');
    expect(localStorage.getItem('user')).toBe('synthetic-current-user');
  } finally {
    localStorage.clear();
  }
});
