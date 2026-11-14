-- Add Wheels column to Vehicles table
ALTER TABLE [dbo].[Vehicles]
ADD [Wheels] [int] NOT NULL DEFAULT 4;
GO