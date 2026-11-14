# Discount Approval Workflow - Implementation Progress

## ✅ Completed

### 1. Database Schema (100%)
- ✅ Created SQL migration script: `add_discount_approval_fields.sql`
- ✅ Added 7 new columns to VehicleRequests table:
  - `DiscountStatus` (None/Pending/Approved/Rejected)
  - `OriginalAmount` (tariff amount before discount)
  - `DiscountAmount` (calculated discount)
  - `FinalAmount` (amount after discount)
  - `DiscountApprovedBy` (FK to Users)
  - `DiscountApprovedAt` (timestamp)
  - `DiscountNotes` (specialist notes)
- ✅ Added check constraint for DiscountStatus
- ✅ Added foreign key constraint for DiscountApprovedBy
- ✅ SQL script executed successfully

### 2. Backend API (80%)
- ✅ Created discount approval endpoint: `POST /api/workflow/requests/:requestId/discount-approval`
- ✅ Added validation schema for discount approval
- ✅ Implemented discount calculation logic (additive percentages, capped at 100%)
- ✅ Added role-based access control (license specialist only)
- ✅ Integrated with process history tracking
- ✅ Registered route in workflow router

**Endpoint Details:**
```javascript
POST /api/workflow/requests/:requestId/discount-approval
Headers: Authorization: Bearer <token>
Body: {
  "decision": "Approved" | "Rejected",
  "notes": "Optional notes",
  "approvedDiscounts": [
    { "docTypeId": 1, "percentage": 10.5 }
  ]
}
```

### 3. Documentation (100%)
- ✅ Created comprehensive implementation guide: `DISCOUNT_APPROVAL_WORKFLOW.md`
- ✅ Created progress tracking document: `DISCOUNT_WORKFLOW_PROGRESS.md`

## 🔄 In Progress / Pending

### 4. Request Submission Logic (0%)
**File:** `server/src/controllers/issue.controller.js`

**TODO:**
- [ ] Find the finalize/submit request function
- [ ] Check if discount documents exist for the vehicle
- [ ] If discount documents exist:
  - Set `DiscountStatus = 'Pending'`
  - Calculate and store `OriginalAmount` from tariff
  - Set `FinalAmount = OriginalAmount`
  - Do NOT redirect to payment page
  - Do NOT initialize workflow yet
- [ ] If no discount documents:
  - Set `DiscountStatus = 'None'`
  - Set `FinalAmount = OriginalAmount`
  - Continue current flow (redirect to payment)

### 5. Payment Page Logic (0%)
**File:** `server/src/controllers/payments.controller.js` & `client/src/pages/PaymentPage.jsx`

**Backend TODO:**
- [ ] Add endpoint to check discount status: `GET /api/payments/discount-status/:requestId`
- [ ] Return: `{ discountStatus, originalAmount, discountAmount, finalAmount, canPay }`

**Frontend TODO:**
- [ ] Check discount status when page loads
- [ ] If `DiscountStatus === 'Pending'`:
  - Show message: "در انتظار بررسی تخفیف توسط کارشناس"
  - Hide payment buttons
  - Show discount documents submitted
- [ ] If `DiscountStatus === 'Approved'`:
  - Show discount details (original, discount, final)
  - Show payment buttons with final amount
- [ ] If `DiscountStatus === 'Rejected'`:
  - Show rejection message and notes
  - Show payment buttons with original amount
- [ ] If `DiscountStatus === 'None'`:
  - Normal payment flow

### 6. Discount Approval UI (0%)
**File:** `client/src/pages/WorkflowRequestDetail.jsx`

**TODO:**
- [ ] Add discount approval section for license specialist
- [ ] Show only when:
  - User role is "کارشناس صدور پروانه"
  - DiscountStatus is "Pending"
- [ ] Display:
  - List of discount documents with their types
  - Discount percentages from LookupValue
  - Checkboxes to approve/reject each discount
  - Real-time calculation of total discount
  - Original amount, discount amount, final amount
  - Notes textarea
  - Approve/Reject buttons
- [ ] On submit:
  - Call discount approval API
  - Refresh request detail
  - Show success message

### 7. Request Detail Display (0%)
**File:** `client/src/pages/WorkflowRequestDetail.jsx`

**TODO:**
- [ ] Add discount status badge to request header
- [ ] Show discount information section:
  - If Pending: "در انتظار بررسی تخفیف"
  - If Approved: Show discount calculation details
  - If Rejected: Show rejection reason
  - If None: Don't show anything

### 8. Workflow Integration (0%)
**File:** `server/src/controllers/workflow.controller.js`

**TODO:**
- [ ] Modify `initializeWorkflow` to check discount status
- [ ] Only initialize workflow after:
  - Payment is completed (if no discount or discount rejected)
  - Discount is approved AND payment is completed

### 9. Request Detail API Enhancement (0%)
**File:** `server/src/controllers/workflow.controller.js`

**TODO:**
- [ ] Update `getRequestDetail` to include discount information
- [ ] Return discount documents with their percentages from LookupValue
- [ ] Return discount status and amounts

## 📊 Overall Progress

- Database: ✅ 100%
- Backend API: ✅ 80%
- Frontend UI: ⏳ 0%
- Integration: ⏳ 0%
- Testing: ⏳ 0%

**Total: ~35% Complete**

## 🎯 Next Steps (Priority Order)

1. **Find and modify request submission logic** to detect discount documents and set status
2. **Update request detail API** to return discount information
3. **Implement payment page logic** to check and display discount status
4. **Create discount approval UI** for license specialist
5. **Test the complete flow** with all scenarios
6. **Add workflow integration** to ensure proper routing

## 🧪 Testing Scenarios

### Scenario 1: No Discount Documents
- [ ] Submit request without discount documents
- [ ] Verify DiscountStatus = 'None'
- [ ] Verify payment page accessible immediately
- [ ] Verify normal workflow after payment

### Scenario 2: With Discount - Approved
- [ ] Submit request with discount documents
- [ ] Verify DiscountStatus = 'Pending'
- [ ] Verify payment blocked
- [ ] Login as license specialist
- [ ] Approve discount
- [ ] Verify calculation correct
- [ ] Verify payment unlocked with discounted amount
- [ ] Complete payment
- [ ] Verify workflow continues

### Scenario 3: With Discount - Rejected
- [ ] Submit request with discount documents
- [ ] Verify payment blocked
- [ ] Reject discount
- [ ] Verify payment unlocked with full amount
- [ ] Complete payment
- [ ] Verify workflow continues

### Scenario 4: Multiple Discounts
- [ ] Submit with multiple discount types
- [ ] Approve some, reject others
- [ ] Verify only approved discounts calculated

## 📝 Notes

- Discount percentages are stored in `LookupValue.DiscountPercentage`
- Multiple discounts are additive (10% + 5% = 15% total)
- Total discount is capped at 100%
- All discount actions are logged in RequestProcessHistory
- Discount approval is a one-time action (cannot be changed after decision)
