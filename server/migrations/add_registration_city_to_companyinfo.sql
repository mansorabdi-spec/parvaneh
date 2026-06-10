-- Add RegistrationCityId field to CompanyInfo table
-- This field stores the city where the company is registered

ALTER TABLE [dbo].[CompanyInfo]
ADD [RegistrationCityId] [int] NULL;
GO

-- Add foreign key constraint to Cities table
ALTER TABLE [dbo].[CompanyInfo]
WITH CHECK ADD CONSTRAINT [FK_CompanyInfo_RegistrationCity] 
FOREIGN KEY([RegistrationCityId])
REFERENCES [dbo].[Cities] ([ID]);
GO

ALTER TABLE [dbo].[CompanyInfo] 
CHECK CONSTRAINT [FK_CompanyInfo_RegistrationCity];
GO
