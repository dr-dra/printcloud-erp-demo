// Token management functions
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
};

export const setToken = (token: string): void => {
  localStorage.setItem('accessToken', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};
