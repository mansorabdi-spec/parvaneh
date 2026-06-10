USE [parvaneh]
GO

-- Check the amounts for the most recent exploitation license request
SELECT TOP 5
    RequestID,
    TrackingNo,
    NationalCode,
    CompanyNationalId,
    LicenseTypeId,
    OperationTypeId,
    OriginalAmount,
    DiscountAmount,
    FinalAmount,
    DiscountStatus,
    Status,
    CreatedAt
FROM VehicleRequests
WHERE TrackingNo LIKE '100-%'
ORDER BY RequestID DESC;
GO
