import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'vikas.auth';

  constructor(private router: Router) {}

  login(username: string, password: string): boolean {
    const normalizedUsername = username.trim();
    const isValidUser = normalizedUsername === 'admin';
    const isValidPassword = password === 'admin123';

    if (!isValidUser || !isValidPassword) {
      return false;
    }

    localStorage.setItem(
      this.storageKey,
      JSON.stringify({
        authenticated: true,
        username: normalizedUsername,
      }),
    );

    return true;
  }

  isAuthenticated(): boolean {
    try {
      const value = localStorage.getItem(this.storageKey);
      if (!value) {
        return false;
      }

      const authState = JSON.parse(value);
      return Boolean(authState?.authenticated);
    } catch {
      return false;
    }
  }

  getUsername(): string {
    try {
      const value = localStorage.getItem(this.storageKey);
      if (!value) {
        return 'User';
      }

      const authState = JSON.parse(value);
      return authState?.username ?? 'User';
    } catch {
      return 'User';
    }
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.router.navigate(['/login']);
  }
}
