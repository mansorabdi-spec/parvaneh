-- =============================================
-- Create RequestProcessHistory Table
-- =============================================
-- This table tracks all actions performed on vehicle requests
-- including approvals, rejections, and fix deficiency actions
-- =============================================

USE [parvaneh]
GO

-- Check if table exists
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RequestProcessHistory')
BEGIN
    CREATE TABLE [dbo].[RequestProcessHistory](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [RequestID] [bigint] NOT NULL,
        [ActionType] [nvarchar](50) NOT NULL,
        [ActionByUserId] [int] NULL,
        [ActionByUserName] [nvarchar](100) NULL,
        [ActionByRole] [nvarchar](50) NULL,
        [FromStatus] [nvarchar](50) NULL,
        [ToStatus] [nvarchar](50) NULL,
        [StepOrder] [int] NULL,
        [Notes] [nvarchar](max) NULL,
        [CreatedAt] [datetime2](7) NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY CLUSTERED 
    (
        [Id] ASC
    )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

    -- Add foreign key constraint
    ALTER TABLE [dbo].[RequestProcessHistory]  WITH CHECK ADD FOREIGN KEY([ActionByUserId])
    REFERENCES [dbo].[Users] ([Id])

    ALTER TABLE [dbo].[RequestProcessHistory]  WITH CHECK ADD FOREIGN KEY([RequestID])
    REFERENCES [dbo].[VehicleRequests] ([RequestID])
    ON DELETE CASCADE

    PRINT 'RequestProcessHistory table created successfully'
END
ELSE
BEGIN
    PRINT 'RequestProcessHistory table already exists'
END
GO

-- =============================================
-- Action Types Reference:
-- =============================================
-- 'Created' - Request was created
-- 'Approved' - Step was approved
-- 'Rejected' - Step was rejected
-- 'FixDeficiency' - Request returned to previous step for deficiency fix
-- 'DiscountApproved' - Discount was approved
-- 'DiscountRejected' - Discount was rejected
-- 'Updated' - Request was updated
-- 'Deleted' - Request was deleted
-- =============================================
