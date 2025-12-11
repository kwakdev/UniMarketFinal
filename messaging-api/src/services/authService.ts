import sql from 'mssql';
import { randomUUID, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDbPool } from '../config/database';
import { generateTestToken } from '../utils/generateToken';

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  isGuest: boolean;
}

export class AuthService {
  async createGuest(displayName?: string): Promise<{ token: string; user: AuthUser }> {
    const pool = await getDbPool();

    // Generate IDs
    const id = `guest-${randomUUID()}`;
    const username = `guest-${id.slice(6, 12)}`;

    const request = pool.request();
    await request
      .input('Id', sql.NVarChar, id)
      .input('Username', sql.NVarChar, username)
      .input('Email', sql.NVarChar, null)
      .input('DisplayName', sql.NVarChar, displayName || username)
      .input('AvatarUrl', sql.NVarChar, null)
      .input('IsGuest', sql.Bit, 1)
      .query(`
        INSERT INTO dbo.Users (Id, Username, Email, DisplayName, AvatarUrl, IsGuest)
        VALUES (@Id, @Username, @Email, @DisplayName, @AvatarUrl, @IsGuest)
      `);

    const token = generateTestToken(id, username);

    return {
      token,
      user: { id, username, email: null, displayName: displayName || username, avatarUrl: null, isGuest: true },
    };
  }

  async registerEmail(params: { email: string; password: string; username?: string; displayName?: string }): Promise<{ token: string; user: AuthUser }> {
    const { email, password } = params;
    const username = params.username || this.deriveUsername(email);
    const displayName = params.displayName || username;

    const pool = await getDbPool();

    // Check existing by email
    const existingByEmail = await pool.request().input('Email', sql.NVarChar, email).query(
      `SELECT TOP 1 Id FROM dbo.Users WHERE Email = @Email`
    );
    if (existingByEmail.recordset.length > 0) {
      throw new Error('Email already in use');
    }

    // Check username
    const existingByUsername = await pool
      .request()
      .input('Username', sql.NVarChar, username)
      .query(`SELECT TOP 1 Id FROM dbo.Users WHERE Username = @Username`);
    if (existingByUsername.recordset.length > 0) {
      throw new Error('Username already taken');
    }

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool
      .request()
      .input('Id', sql.NVarChar, id)
      .input('Username', sql.NVarChar, username)
      .input('Email', sql.NVarChar, email)
      .input('DisplayName', sql.NVarChar, displayName)
      .input('AvatarUrl', sql.NVarChar, null)
      .input('PasswordHash', sql.NVarChar, passwordHash)
      .input('IsGuest', sql.Bit, 0)
      .query(`
        INSERT INTO dbo.Users (Id, Username, Email, DisplayName, AvatarUrl, PasswordHash, IsGuest)
        VALUES (@Id, @Username, @Email, @DisplayName, @AvatarUrl, @PasswordHash, @IsGuest)
      `);

    const token = generateTestToken(id, username);

    return {
      token,
      user: { id, username, email, displayName, avatarUrl: null, isGuest: false },
    };
  }

  async loginEmail(params: { email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
    const { email, password } = params;
    const pool = await getDbPool();

    const result = await pool
      .request()
      .input('Email', sql.NVarChar, email)
      .query(`
        SELECT TOP 1 Id, Username, Email, DisplayName, AvatarUrl, PasswordHash, IsGuest, IsActive
        FROM dbo.Users WHERE Email = @Email
      `);

    if (result.recordset.length === 0) {
      throw new Error('Invalid credentials');
    }

    const row = result.recordset[0];
    if (!row.IsActive) {
      throw new Error('Account disabled');
    }

    const isMatch = row.PasswordHash ? await bcrypt.compare(password, row.PasswordHash) : false;
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = generateTestToken(row.Id, row.Username);

    return {
      token,
      user: {
        id: row.Id,
        username: row.Username,
        email: row.Email,
        displayName: row.DisplayName,
        avatarUrl: row.AvatarUrl,
        isGuest: row.IsGuest === 1,
      },
    };
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const pool = await getDbPool();
    const result = await pool
      .request()
      .input('Id', sql.NVarChar, userId)
      .query(`
        SELECT TOP 1 Id, Username, Email, DisplayName, AvatarUrl, IsGuest, IsActive
        FROM dbo.Users WHERE Id = @Id
      `);

    if (result.recordset.length === 0) return null;
    const row = result.recordset[0];
    return {
      id: row.Id,
      username: row.Username,
      email: row.Email,
      displayName: row.DisplayName,
      avatarUrl: row.AvatarUrl,
      isGuest: row.IsGuest === 1,
    };
  }

  private deriveUsername(email: string): string {
    const base = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'user';
    const suffix = createHash('sha1').update(email).digest('hex').slice(0, 6);
    return `${base}-${suffix}`;
  }
}

export const authService = new AuthService();
