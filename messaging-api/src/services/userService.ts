import sql from 'mssql';
import { getDbPool } from '../config/database';
import { User, CreateUserPayload, UpdateUserPayload } from '../types';

export class UserService {
  /**
   * Create a new user
   */
  async createUser(payload: CreateUserPayload): Promise<User> {
    const pool = await getDbPool();

    try {
      // Check if user already exists
      const existingUserRequest = pool.request();
      const existingUser = await existingUserRequest
        .input('Id', sql.NVarChar, payload.id)
        .query('SELECT Id FROM dbo.Users WHERE Id = @Id');

      if (existingUser.recordset.length > 0) {
        throw new Error('User already exists');
      }

      // Check if username is already taken
      const existingUsernameRequest = pool.request();
      const existingUsername = await existingUsernameRequest
        .input('Username', sql.NVarChar, payload.username)
        .query('SELECT Id FROM dbo.Users WHERE Username = @Username');

      if (existingUsername.recordset.length > 0) {
        throw new Error('Username already taken');
      }

      // Create user
      const insertRequest = pool.request();
      await insertRequest
        .input('Id', sql.NVarChar, payload.id)
        .input('Username', sql.NVarChar, payload.username)
        .input('Email', sql.NVarChar, payload.email || null)
        .input('DisplayName', sql.NVarChar, payload.displayName || null)
        .input('AvatarUrl', sql.NVarChar, payload.avatarUrl || null)
        .query(`
          INSERT INTO dbo.Users (Id, Username, Email, DisplayName, AvatarUrl)
          VALUES (@Id, @Username, @Email, @DisplayName, @AvatarUrl)
        `);

      // Return created user
      return await this.getUser(payload.id);
    } catch (error: any) {
      // Preserve specific error messages
      if (error.message?.includes('already exists') || error.message?.includes('already taken')) {
        throw error;
      }
      
      // Log the actual error for debugging
      console.error('Error creating user:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        number: error.number,
        originalError: error.originalError?.message,
        sqlState: error.originalError?.sqlState,
        stack: error.stack,
      });
      
      // Check for SQL Server specific errors
      if (error.number) {
        // SQL Server error number
        if (error.number === 2627) {
          // Primary key violation
          throw new Error('User ID already exists');
        }
        if (error.number === 2601) {
          // Unique constraint violation
          throw new Error('Username already taken');
        }
      }
      
      // Provide more helpful error message
      const errorMessage = error.originalError?.message || error.message || 'Unknown error';
      throw new Error(`Failed to create user: ${errorMessage}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('Id', sql.NVarChar, userId)
      .query(`
        SELECT 
          Id,
          Username,
          Email,
          DisplayName,
          AvatarUrl,
          CreatedAt,
          UpdatedAt,
          IsActive,
          IsGuest
        FROM dbo.Users
        WHERE Id = @Id
      `);

    if (result.recordset.length === 0) {
      throw new Error('User not found');
    }

    const row = result.recordset[0];
    return {
      id: row.Id,
      username: row.Username,
      email: row.Email || null,
      displayName: row.DisplayName || null,
      avatarUrl: row.AvatarUrl || null,
      createdAt: row.CreatedAt.toISOString(),
      updatedAt: row.UpdatedAt.toISOString(),
      isActive: row.IsActive === 1,
      isGuest: row.IsGuest === 1,
    };
  }

  /**
   * Update user
   */
  async updateUser(userId: string, payload: UpdateUserPayload): Promise<User> {
    const pool = await getDbPool();
    const request = pool.request();

    // Check if user exists
    const existingUser = await request
      .input('Id', sql.NVarChar, userId)
      .query('SELECT Id FROM dbo.Users WHERE Id = @Id');

    if (existingUser.recordset.length === 0) {
      throw new Error('User not found');
    }

    // Check if username is being changed and if it's already taken
    if (payload.username) {
      const existingUsername = await pool.request()
        .input('Username', sql.NVarChar, payload.username)
        .input('Id', sql.NVarChar, userId)
        .query('SELECT Id FROM dbo.Users WHERE Username = @Username AND Id != @Id');

      if (existingUsername.recordset.length > 0) {
        throw new Error('Username already taken');
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    if (payload.username !== undefined) {
      updates.push('Username = @Username');
      request.input('Username', sql.NVarChar, payload.username);
    }
    if (payload.email !== undefined) {
      updates.push('Email = @Email');
      request.input('Email', sql.NVarChar, payload.email || null);
    }
    if (payload.displayName !== undefined) {
      updates.push('DisplayName = @DisplayName');
      request.input('DisplayName', sql.NVarChar, payload.displayName || null);
    }
    if (payload.avatarUrl !== undefined) {
      updates.push('AvatarUrl = @AvatarUrl');
      request.input('AvatarUrl', sql.NVarChar, payload.avatarUrl || null);
    }
    if (payload.isActive !== undefined) {
      updates.push('IsActive = @IsActive');
      request.input('IsActive', sql.Bit, payload.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      // No updates, just return current user
      return await this.getUser(userId);
    }

    updates.push('UpdatedAt = GETUTCDATE()');
    request.input('Id', sql.NVarChar, userId);

    await request.query(`
      UPDATE dbo.Users
      SET ${updates.join(', ')}
      WHERE Id = @Id
    `);

    return await this.getUser(userId);
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('Username', sql.NVarChar, username)
      .query(`
        SELECT 
          Id,
          Username,
          Email,
          DisplayName,
          AvatarUrl,
          CreatedAt,
          UpdatedAt,
          IsActive,
          IsGuest
        FROM dbo.Users
        WHERE Username = @Username
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      id: row.Id,
      username: row.Username,
      email: row.Email || null,
      displayName: row.DisplayName || null,
      avatarUrl: row.AvatarUrl || null,
      createdAt: row.CreatedAt.toISOString(),
      updatedAt: row.UpdatedAt.toISOString(),
      isActive: row.IsActive === 1,
      isGuest: row.IsGuest === 1,
    };
  }

  /**
   * Search users by username or display name
   */
  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('Query', sql.NVarChar, `%${query}%`)
      .input('Limit', sql.Int, limit)
      .query(`
        SELECT TOP (@Limit)
          Id,
          Username,
          Email,
          DisplayName,
          AvatarUrl,
          CreatedAt,
          UpdatedAt,
          IsActive,
          IsGuest
        FROM dbo.Users
        WHERE (Username LIKE @Query OR DisplayName LIKE @Query)
          AND IsActive = 1
        ORDER BY Username
      `);

    return result.recordset.map((row: any) => ({
      id: row.Id,
      username: row.Username,
      email: row.Email || null,
      displayName: row.DisplayName || null,
      avatarUrl: row.AvatarUrl || null,
      createdAt: row.CreatedAt.toISOString(),
      updatedAt: row.UpdatedAt.toISOString(),
      isActive: row.IsActive === 1,
      isGuest: row.IsGuest === 1,
    }));
  }

  /**
   * Get all active users (for dropdowns/lists)
   */
  async getAllUsers(limit: number = 100): Promise<User[]> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('Limit', sql.Int, limit)
      .query(`
        SELECT TOP (@Limit)
          Id,
          Username,
          Email,
          DisplayName,
          AvatarUrl,
          CreatedAt,
          UpdatedAt,
          IsActive,
          IsGuest
        FROM dbo.Users
        WHERE IsActive = 1
        ORDER BY Username
      `);

    return result.recordset.map((row: any) => ({
      id: row.Id,
      username: row.Username,
      email: row.Email || null,
      displayName: row.DisplayName || null,
      avatarUrl: row.AvatarUrl || null,
      createdAt: row.CreatedAt.toISOString(),
      updatedAt: row.UpdatedAt.toISOString(),
      isActive: row.IsActive === 1,
      isGuest: row.IsGuest === 1,
    }));
  }
}

export const userService = new UserService();

