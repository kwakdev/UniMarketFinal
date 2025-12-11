import sql from 'mssql';
import sqlNative from 'mssql/msnodesqlv8';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Use msnodesqlv8 driver for Windows Authentication (better LocalDB support)
const useNativeDriver = process.env.DB_USE_NATIVE_DRIVER !== 'false'; // Default to true

// Debug: Log environment variables (remove in production)
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 DB_CONNECTION_STRING:', process.env.DB_CONNECTION_STRING ? 'Set' : 'Not set');
  console.log('🔍 DB_SERVER:', process.env.DB_SERVER || 'Not set');
  console.log('🔍 DB_DATABASE:', process.env.DB_DATABASE || 'Not set');
}

function parseConnectionString(connectionString: string): sql.config {
  const config: any = {
    options: {
      enableArithAbort: true,
    },
    pool: {
      max: 5, // Reduced for development to minimize connections
      min: 0,
      idleTimeoutMillis: 15000, // Close idle connections faster
      acquireTimeoutMillis: 30000,
    },
  };

  // Parse connection string
  const parts = connectionString.split(';').filter(p => p.trim());
  
  for (const part of parts) {
    const [key, value] = part.split('=').map(s => s.trim());
    if (!key || !value) continue;

    switch (key.toLowerCase()) {
      case 'server':
        // Handle LocalDB format: (localdb)\MSSQLLocalDB
        // Remove extra backslashes that might come from .env file escaping
        let serverValue = value.replace(/\\\\/g, '\\');
        
        // For LocalDB, convert (localdb)\InstanceName to localhost\InstanceName
        // The mssql/tedious driver doesn't understand (localdb) format
        if (serverValue.includes('(localdb)')) {
          // Extract instance name if present
          const instanceMatch = serverValue.match(/\\([^\\]+)$/);
          const instanceName = instanceMatch ? instanceMatch[1] : 'MSSQLLocalDB';
          // Use localhost with instance name
          config.server = `localhost\\${instanceName}`;
          config.port = undefined; // LocalDB uses named pipes, not TCP port
        } else if (serverValue.toLowerCase().includes('localdb')) {
          // Handle case where it's just "localdb" or similar
          config.server = 'localhost\\MSSQLLocalDB';
          config.port = undefined;
        } else {
          config.server = serverValue;
        }
        break;
      case 'database':
        config.database = value;
        break;
      case 'user id':
      case 'uid':
        config.user = value;
        break;
      case 'password':
      case 'pwd':
        config.password = value;
        break;
      case 'trusted_connection':
        if (value.toLowerCase() === 'true') {
          // For Windows Authentication, don't set user/password
          config.user = undefined;
          config.password = undefined;
          config.options = {
            ...config.options,
            trustedConnection: true,
          };
        }
        break;
      case 'encrypt':
        config.options = {
          ...config.options,
          encrypt: value.toLowerCase() === 'true',
        };
        break;
      case 'trustservercertificate':
        config.options = {
          ...config.options,
          trustServerCertificate: value.toLowerCase() === 'true',
        };
        break;
    }
  }

  return config;
}

let config: sql.config;

// Support both connection string and individual parameters
const connectionString = process.env.DB_CONNECTION_STRING;

// For LocalDB, it's better to use individual parameters
// Check if connection string contains LocalDB
const isLocalDB = connectionString && (
  connectionString.includes('(localdb)') || 
  connectionString.includes('localdb') ||
  connectionString.toLowerCase().includes('mssqllocaldb')
);

if (connectionString && !isLocalDB) {
  // Use connection string if provided and NOT LocalDB
  console.log('📝 Using connection string');
  config = parseConnectionString(connectionString);
  console.log('📝 Parsed config:', {
    server: config.server,
    database: config.database,
    hasTrustedConnection: config.options?.trustedConnection,
    port: config.port || 'undefined (using default)',
  });
} else if (connectionString && isLocalDB) {
  // For LocalDB, parse connection string but use individual parameters format
  console.log('📝 Detected LocalDB - parsing connection string to individual parameters');
  
  // Extract database name
  const dbMatch = connectionString.match(/Database=([^;]+)/i);
  const databaseName = dbMatch ? dbMatch[1].trim() : 'MessagingApp';
  
  // Extract instance name
  const instanceMatch = connectionString.match(/\\([^;)]+)/);
  const instanceName = instanceMatch ? instanceMatch[1].trim() : 'MSSQLLocalDB';
  
  // For LocalDB, we need to use the instance name format without port
  // The server should be just the instance name for LocalDB
  config = {
    server: `localhost\\${instanceName}`, // Format: localhost\InstanceName
    database: databaseName,
    options: {
      trustedConnection: true,
      enableArithAbort: true,
      encrypt: false, // LocalDB doesn't need encryption
      // Don't set instanceName when using server\instance format
    },
    pool: {
      max: 5, // Reduced for development to minimize connections
      min: 0,
      idleTimeoutMillis: 15000, // Close idle connections faster
      acquireTimeoutMillis: 30000,
    },
  };
  
  console.log('📝 LocalDB config:', {
    server: config.server,
    database: config.database,
    trustedConnection: config.options?.trustedConnection,
  });
} else {
  console.log('📝 Using individual parameters');
  // Use individual parameters
  const server = process.env.DB_SERVER || 'localhost';
  const database = process.env.DB_DATABASE || 'MessagingDB';
  const instanceName = process.env.DB_INSTANCE;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined;
  
  // Determine authentication method
  // If user/password provided, use SQL auth; otherwise use Windows auth
  const useSqlAuth = !!(user && password);
  const trustedConnection = !useSqlAuth && (
    process.env.DB_TRUSTED_CONNECTION === 'true' || 
    process.env.DB_TRUSTED_CONNECTION === 'True' ||
    (!user && !password) // Default to Windows auth if no credentials provided
  );
  
  // For LocalDB, we need special handling
  const isLocalDB = instanceName && instanceName.toLowerCase().includes('localdb');
  
  // With msnodesqlv8, we can use the (localdb)\InstanceName format directly
  // or use server\instance format - both work better than with tedious
  let finalServer: string;
  let finalInstanceName: string | undefined;
  
  if (isLocalDB && useNativeDriver) {
    // With msnodesqlv8, we can use (localdb)\InstanceName format
    finalServer = `(localdb)\\${instanceName}`;
    finalInstanceName = undefined; // Don't need instanceName in options with this format
  } else if (isLocalDB) {
    // For tedious driver, use localhost\instance format
    finalServer = `localhost\\${instanceName}`;
    finalInstanceName = instanceName;
  } else if (instanceName) {
    // For other named instances, use server\instance format
    finalServer = `${server}\\${instanceName}`;
    finalInstanceName = undefined;
  } else {
    finalServer = server;
    finalInstanceName = undefined;
  }
  
  config = {
    server: finalServer,
    database: database,
    user: useSqlAuth ? user : undefined,
    password: useSqlAuth ? password : undefined,
    // For LocalDB or named instances, don't set port (uses named pipes)
    // For regular SQL Server, use the provided port or default 1433
    port: (isLocalDB || instanceName) ? undefined : (port || 1433),
    options: {
      // Set instanceName only if needed (for tedious driver with LocalDB)
      instanceName: finalInstanceName,
      // For LocalDB, disable encryption
      encrypt: isLocalDB ? false : (process.env.DB_ENCRYPT === 'true'),
      // For LocalDB, trust server certificate
      trustServerCertificate: isLocalDB ? true : (
        process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || 
        process.env.DB_ENCRYPT !== 'true'
      ),
      trustedConnection: trustedConnection,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 30000,
    },
    pool: {
      max: 5, // Reduced for development to minimize connections
      min: 0,
      idleTimeoutMillis: 15000, // Close idle connections faster
      acquireTimeoutMillis: 30000,
    },
  };
  
  console.log('📝 Individual params config:', {
    server: config.server,
    database: config.database,
    instanceName: config.options?.instanceName || 'N/A',
    port: config.port || 'undefined (using named pipe)',
    auth: useSqlAuth ? 'SQL Authentication' : (trustedConnection ? 'Windows Authentication' : 'Default'),
    user: useSqlAuth ? user : (trustedConnection ? 'Windows Auth' : 'N/A'),
    isLocalDB: isLocalDB,
    driver: useNativeDriver ? 'msnodesqlv8 (native)' : 'tedious (default)',
  });
}

let pool: sql.ConnectionPool | null = null;

export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    try {
      // Use native driver (msnodesqlv8) for Windows Authentication
      // This works much better with LocalDB and Windows Auth
      if (useNativeDriver) {
        console.log('📦 Using msnodesqlv8 driver (Windows Authentication)');
        pool = await sqlNative.connect(config);
      } else {
        console.log('📦 Using tedious driver (default)');
        pool = await sql.connect(config);
      }
      console.log('✅ Connected to SQL Server');
    } catch (error) {
      console.error('❌ Database connection error:', error);
      throw error;
    }
  }
  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database connection closed');
  }
}

// Test connection on startup
getDbPool().catch(console.error);

