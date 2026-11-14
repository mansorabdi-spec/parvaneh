# Discount Approval Workflow Implementation Guide

## Overview
This document describes the implementation of the discount approval workflow feature, which requires discount documents to be reviewed and approved by a license specialist before payment can be processed.

## Workflow Logic

### Scenario 1: No Discount Documents
**Flow:** Request → Payment → Normal Workflow
- User submits request without discount documents
- User proceeds directly to payment (online or offline)
- After payment, workflow starts normally

### Scenario 2: With Discount Documents
**Flow:** Request → Discount Review → Payment (with/without discount) → Normal Workflow

1. **User submits request with discount documents**
   - System detects discount documents exist
   - Sets `DiscountStatus = 'Pending'`
   - Stores `OriginalAmount` (full tariff amount)
   - **Blocks payment** (no payment page access)

2. **Request goes to License Specialist**
   - Specialist reviews discount documents
   - Can approve or reject each discount
   - System calculates total discount percentage
   - Specialist can add notes

3. **If Approved:**
   - Calculate `DiscountAmount = OriginalAmount * (TotalDiscountPercentage / 100)`
   - Calculate `FinalAmount = OriginalAmount - DiscountAmount`
   - Set `DiscountStatus = 'Approved'`
   - **Unlock payment** with new discounted amount
   - User can now pay the discounted amount

4. **If Rejected:**
   - Set `DiscountStatus = 'Rejected'`
   - Set `FinalAmount = OriginalAmount` (no discount)
   - **Unlock payment** with full amount
   - User can pay the original amount

5. **After Payment:**
   - Continue with normal workflow (financial expert or skip based on payment type)

## Database Schema Changes

### VehicleRequests Table - New Columns

| Column Name | Type | Description |
|------------|------|-------------|
| `DiscountStatus` | NVARCHAR(20) | Status: 'None', 'Pending', 'Approved', 'Rejected' |
| `OriginalAmount` | DECIMAL(18,2) | Original tariff amount before discount |
| `DiscountAmount` | DECIMAL(18,2) | Calculated discount amount |
| `FinalAmount` | DECIMAL(18,2) | Final amount to pay (after discount) |
| `DiscountApprovedBy` | INT | User ID who approved/rejected (FK to Users) |
| `DiscountApprovedAt` | DATETIME2 | Timestamp of approval/rejection |
| `DiscountNotes` | NVARCHAR(1000) | Notes from specialist about decision |

## Backend Implementation

### 1. Request Submission (issue.controller.js)
- Check if discount documents exist
- If yes:
  - Set `DiscountStatus = 'Pending'`
  - Calculate and store `OriginalAmount`
  - Do NOT initialize workflow yet
- If no:
  - Set `DiscountStatus = 'None'`
  - Continue current flow

### 2. Discount Approval API (workflow.controller.js)
**New Endpoint:** `POST /api/workflow/requests/:requestId/discount-approval`

**Request Body:**
```json
{
  "decision": "Approved" | "Rejected",
  "notes": "Optional notes",
  "approvedDiscounts": [
    { "docTypeId": 1, "percentage": 10.5 }
  ]
}
```

**Logic:**
- Validate user is license specialist
- Calculate total discount percentage
- Calculate discount amount and final amount
- Update request with discount status and amounts
- If approved, unlock payment with discounted amount
- If rejected, unlock payment with full amount

### 3. Payment Page Logic (payments.controller.js)
- Check `DiscountStatus` before showing payment options
- If `Pending`: Show "Waiting for discount approval" message
- If `Approved` or `Rejected`: Show payment with `FinalAmount`
- If `None`: Show payment with tariff amount (current behavior)

## Frontend Implementation

### 1. Payment Page (PaymentPage.jsx)
- Add discount status check
- Show different UI based on status:
  - **Pending**: "در انتظار بررسی تخفیف"
  - **Approved**: Show discount details and final amount
  - **Rejected**: Show rejection message and full amount
  - **None**: Normal payment flow

### 2. Discount Approval UI (WorkflowRequestDetail.jsx)
- Add discount approval section for license specialist
- Show list of discount documents with checkboxes
- Show discount percentages from LookupValue
- Calculate total discount in real-time
- Show original amount, discount amount, final amount
- Approve/Reject buttons

### 3. Request Detail Display
- Show discount status badge
- Show discount calculation details if approved
- Show rejection reason if rejected

## Testing Checklist

### Test Case 1: No Discount Documents
- [ ] Submit request without discounts
- [ ] Verify payment page accessible immediately
- [ ] Verify normal workflow starts after payment

### Test Case 2: With Discount Documents - Approved
- [ ] Submit request with discount documents
- [ ] Verify payment blocked
- [ ] Verify request appears in license specialist inbox
- [ ] Approve discount
- [ ] Verify discount calculation correct
- [ ] Verify payment unlocked with discounted amount
- [ ] Complete payment
- [ ] Verify workflow continues normally

### Test Case 3: With Discount Documents - Rejected
- [ ] Submit request with discount documents
- [ ] Verify payment blocked
- [ ] Reject discount
- [ ] Verify payment unlocked with full amount
- [ ] Complete payment
- [ ] Verify workflow continues normally

### Test Case 4: Multiple Discounts
- [ ] Submit request with multiple discount types
- [ ] Verify all discounts shown to specialist
- [ ] Approve some, reject others
- [ ] Verify calculation uses only approved discounts

## Migration Steps

1. **Run SQL Migration:**
   ```sql
   -- Execute: add_discount_approval_fields.sql
   ```

2. **Update Backend:**
   - Modify issue controller
   - Add discount approval endpoint
   - Update payment logic

3. **Update Frontend:**
   - Modify payment page
   - Add discount approval UI
   - Update request detail display

4. **Test Thoroughly:**
   - Test all scenarios
   - Verify calculations
   - Check workflow routing

## Notes

- Discount percentages come from `LookupValue.DiscountPercentage`
- Multiple discounts are additive (e.g., 10% + 5% = 15% total)
- Maximum total discount should be capped (e.g., 50%)
- Discount approval is a one-time action (cannot be changed after payment)
- All discount-related data is audited (who, when, what)

## Future Enhancements

- Add discount approval history table
- Add maximum discount limit configuration
- Add discount reports and analytics
- Add email notifications for discount decisions
- Add discount document verification workflow
