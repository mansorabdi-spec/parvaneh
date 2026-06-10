import axios from 'axios';
import { api } from '../lib/api.js';

// Base URL for the payment gateway
const BASE_URL = 'https://pay.tabriz.ir/api/payment';

// Authentication credentials (should be moved to environment variables in production)
const AUTH = {
  username: 'Hamlebar',
  password: 'H123baR456'
};

export const paymentService = {
  /**
   * Initiate a payment with the payment gateway
   * @param {string} orderId - Unique order ID
   * @param {number} amount - Amount in Rials
   * @param {string} callbackUrl - Callback URL after payment
   * @param {string} vehicleId - ID of the vehicle being paid for
   * @param {string} trackingNo - Tracking number for the payment
   * @returns {Promise<{success: boolean, paymentUrl: string}>}
   */
  initiatePayment: async (orderId, amount, callbackUrl, vehicleId, trackingNo) => {
    try {
      // Generate a unique order ID with timestamp and random number to avoid duplicates
      const uniqueOrderId = `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      console.log('Initiating payment with:', {uniqueOrderId, amount, callbackUrl, vehicleId, trackingNo});
      
      // Validate input parameters (vehicleId is optional for exploitation licenses)
      if (!uniqueOrderId || !amount || !callbackUrl || !trackingNo) {
        throw new Error('پارامترهای پرداخت نامعتبر هستند');
      }

      // Note: Payment record is already created by handlePayment in FinancialPayment.jsx
      // We don't create a duplicate record here
      
      // Ensure callback URL carries tracking info
      let callbackUrlWithParams = callbackUrl;
      try {
        const u = new URL(callbackUrl);
        u.searchParams.set('trackingNo', trackingNo);
        callbackUrlWithParams = u.toString();
      } catch {}

      // Initiate payment with the external gateway
      const response = await axios.post(
        `${BASE_URL}/pay`,
        {
          OrderID: uniqueOrderId,
          Price: amount,
          callback: callbackUrlWithParams
          // Note: Removed VehicleID as it's not part of the expected payload
        },
        {
          auth: AUTH,
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Handle both string URL and object response formats
      const paymentUrl = response.data?.paymentUrl || response.data;

      if (!paymentUrl) {
        throw new Error('آدرس پرداخت در پاسخ درگاه یافت نشد');
      }

      console.log('Payment gateway response:', response.data);
      
      return {
        success: true,
        paymentUrl: paymentUrl,
        orderId: uniqueOrderId
      };
    } catch (error) {
      console.error('Payment initiation failed:', error.response?.data || error.message);
      
      // Update payment record with error
      if (error.response?.data) {
        await api.put('/api/payments/update-status', {
          orderId,
          status: 'failed',
          error: error.response.data.message || 'خطا در اتصال به درگاه پرداخت'
        });
      }
      
      if (error.response?.status === 404) {
        throw new Error('درگاه پرداخت یافت نشد');
      }
      
      throw new Error(error.response?.data?.message || 'خطا در پردازش درخواست پرداخت');
    }
  },

  /**
   * Verify a payment with the payment gateway
   * @param {string} orderId - Original order ID
   * @param {string} refId - Reference ID from the gateway
   * @param {string} saleOrderId - Sale order ID from the gateway
   * @returns {Promise<Object>} Verification result
   */
  verifyPayment: async (orderId, refId, saleOrderId, paymentId = null) => {
    try {
      console.log('Verifying payment via backend:', { orderId, refId, saleOrderId, paymentId });
      // Call our backend verification endpoint. If paymentId (DB Id) is provided, use path param to allow DB update.
      const path = paymentId ? `/api/payments/verify/${encodeURIComponent(paymentId)}` : `/api/payments/verify`;
      const res = await api.get(path , {
        params: { orderId, refId, saleOrderId }
      });
      return res.data;
    } catch (error) {
      console.error('Error verifying payment via backend:', error.response?.data || error.message);
      // Surface a clean error up to the caller
      throw new Error(error.response?.data?.message || 'خطا در بررسی وضعیت پرداخت');
    }
  }
};

export default paymentService;
