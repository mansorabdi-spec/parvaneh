import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';

export default function RedirectToBank() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState({
    amount: 0,
    orderId: '',
    trackingNo: ''
  });

  useEffect(() => {
    const processPayment = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const dataParam = params.get('data');
        
        if (!dataParam) {
          throw new Error('پارامترهای پرداخت یافت نشد');
        }

        // Decode the base64 string and handle URL-encoded characters
        const base64Decoded = atob(dataParam.replace(/-/g, '+').replace(/_/g, '/'));
        
        // Convert the binary string to a UTF-8 string
        const decodedString = decodeURIComponent(Array.from(base64Decoded).map(c => 
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        
        // Parse the JSON string
        const decodedData = JSON.parse(decodedString);
        console.log('Decoded payment data:', decodedData);
        
        // Validate required fields
        if (!decodedData.amount || isNaN(decodedData.amount)) {
          throw new Error('مبلغ پرداخت نامعتبر است');
        }
        
        if (!decodedData.paymentId) {
          throw new Error('شناسه پرداخت نامعتبر است');
        }

        setPaymentInfo({
          amount: parseInt(decodedData.amount),
          orderId: `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          trackingNo: decodedData.trackingNo || '',
          paymentId: decodedData.paymentId
        });
        
        // Construct the full callback URL to our server endpoint
        // Use backend base URL from env (remove trailing slash if present)
        const serverBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
        // Include the payment ID in the callback URL so we can identify the payment record
        const callbackUrl = `${serverBase}/api/payments/callback?pid=${decodedData.paymentId}`;
        
        console.log('Using callback URL:', callbackUrl);
        
        console.log('Initiating payment with:', {
          orderId: decodedData.paymentId,
          amount: decodedData.amount,
          callbackUrl
        });
        
        // Call the payment service to initiate the payment
        const paymentResult = await paymentService.initiatePayment(
          decodedData.orderId, // This will be used as a base but the service will generate a unique one
          decodedData.amount,
          callbackUrl,
          decodedData.vehicleId,
          decodedData.trackingNo
        );
        
        console.log('Payment service response:', paymentResult);
        
        if (paymentResult?.success && paymentResult.paymentUrl) {
          // Update the URL to include the new orderId for reference
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('orderId', paymentResult.orderId);
          window.history.replaceState({}, '', newUrl);
          
          // Redirect to payment gateway
          window.location.href = paymentResult.paymentUrl;
        } else {
          throw new Error('پاسخ نامعتبر از درگاه پرداخت');
        }
      } catch (err) {
        console.error('Payment error:', err);
        setError(err.message || 'خطا در اتصال به درگاه پرداخت');
        setLoading(false);
      }
    };

    processPayment();
  }, [location.search]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>در حال انتقال به درگاه پرداخت ...</p>
          <p style={styles.amountText}>مبلغ: {paymentInfo.amount.toLocaleString('fa-IR')} ریال</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <h3 style={styles.errorTitle}>خطا در پرداخت</h3>
          <p style={styles.errorText}>{error}</p>
          <div style={styles.buttonContainer}>
            <button 
              style={styles.backButton}
              onClick={() => window.history.back()}
            >
              بازگشت به صفحه قبل
            </button>
            <button 
              style={styles.homeButton}
              onClick={() => navigate('/')}
            >
              بازگشت به صفحه اصلی
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null; // Will redirect before rendering anything else
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'Tahoma, Arial, sans-serif',
    direction: 'rtl',
    padding: '20px',
    textAlign: 'center'
  },
  loadingBox: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%'
  },
  spinner: {
    border: '5px solid #f3f3f3',
    borderTop: '5px solid #3498db',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  loadingText: {
    fontSize: '18px',
    color: '#333',
    marginBottom: '10px'
  },
  amountText: {
    fontSize: '16px',
    color: '#666',
    marginTop: '15px'
  },
  errorBox: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%'
  },
  errorTitle: {
    color: '#d32f2f',
    marginBottom: '15px',
    fontSize: '20px'
  },
  errorText: {
    color: '#333',
    marginBottom: '25px',
    lineHeight: '1.6'
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  backButton: {
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.3s',
    minWidth: '150px'
  },
  homeButton: {
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.3s',
    minWidth: '150px'
  }
};

// Add keyframes for spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
