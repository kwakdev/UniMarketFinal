-- Add auth-related columns to Users table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'PasswordHash' AND Object_ID = Object_ID('dbo.Users'))
BEGIN
  ALTER TABLE dbo.Users ADD PasswordHash NVARCHAR(255) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'IsGuest' AND Object_ID = Object_ID('dbo.Users'))
BEGIN
  ALTER TABLE dbo.Users ADD IsGuest BIT NOT NULL CONSTRAINT DF_Users_IsGuest DEFAULT(0);
END
