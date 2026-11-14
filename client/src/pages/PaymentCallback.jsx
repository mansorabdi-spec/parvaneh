import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';

export default function PaymentCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [message, setMessage] = useState('در حال بررسی وضعیت پرداخت...');
  const [paymentDetails, setPaymentDetails] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const params = new URLSearchParams(location.search);
        let paymentId, orderId, refId, saleOrderId, resCode, resMessage, isSuccess = false;
        // Read DB payment Id (pid) from query string if present
        const pidParam = params.get('pid');
        const paymentIdNumeric = pidParam && !isNaN(Number(pidParam)) ? Number(pidParam) : null;
        let finalAmountCandidate = null; // fallback amount from gateway decoded data

        // Check if we have a data parameter (base64 encoded)
        const dataParam = params.get('data');
        
        // Also check the URL hash for parameters (some gateways use this)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashDataParam = hashParams.get('data');
        
        // Try to get the data from either source
        const paymentData = dataParam || hashDataParam;
        
        if (paymentData) {
          try {
            // Decode the base64 data (handle URL-encoded and base64url variants)
            const b64 = decodeURIComponent(paymentData)
              .replace(/-/g, '+')
              .replace(/_/g, '/');
            const decodedData = JSON.parse(atob(b64));
            console.log('Decoded payment data:', decodedData);
            
            // Map the decoded data to our expected fields
            orderId = (decodedData.OrderID ?? decodedData.orderId ?? '').toString();
            refId = (decodedData.RefId ?? decodedData.refId ?? '').toString();
            saleOrderId = (decodedData.SaleOrderId ?? decodedData.saleOrderId ?? '').toString();
            paymentId = decodedData.requestId || '';
            resCode = decodedData.ResCode;
            resMessage = decodedData.ResCodeMessage || '';
            // Capture FinalAmount if present for later display
            if (decodedData.FinalAmount) {
              const n = Number(decodedData.FinalAmount);
              if (!Number.isNaN(n)) finalAmountCandidate = n;
            }
            
            // Check if this is a successful payment (ResCode 0 or '0' indicates success)
            isSuccess = resCode === 0 || resCode === '0';
            
            // If we have a ResCode, check if it indicates success
            if (!isSuccess) {
              throw new Error(resMessage || 'پرداخت ناموفق بود');
            }
          } catch (e) {
            console.error('Error decoding payment data:', e);
            throw new Error('خطا در پردازش اطلاعات پرداخت');
          }
        } else {
          // Fallback to direct parameters if no data param
          paymentId = params.get('paymentId');
          orderId = params.get('orderId');
          refId = params.get('RefId');
          saleOrderId = params.get('SaleOrderId');
        }
        
        console.log('Mapped payment params:', { orderId, refId, saleOrderId });
        if (!orderId?.trim() || !refId?.trim() || !saleOrderId?.trim()) {
          throw new Error('پارامترهای پرداخت ناقص است');
        }

        // Verify the payment with our backend
        const verification = await paymentService.verifyPayment(
          orderId,
          refId,
          saleOrderId,
          paymentIdNumeric
        );

        console.log('Payment verification result:', verification);
        
        if (verification.success) {
          let renewalNotice = null
          try {
            renewalNotice = JSON.parse(sessionStorage.getItem('exploitationRenewalNotice') || 'null')
            if (renewalNotice) sessionStorage.removeItem('exploitationRenewalNotice')
          } catch {}
          const licenseTrackingNo = renewalNotice?.trackingNo || orderId
          setStatus('success');
          setMessage(renewalNotice?.message || 'پرداخت با موفقیت انجام شد و پرونده جهت تایید ارجاع گردید');
          setPaymentDetails({
            // Use backend amount if present; otherwise fallback to decoded FinalAmount
            amount: (typeof verification.amount === 'number' ? verification.amount : finalAmountCandidate) || null,
            refId: verification.refId,
            trackingNumber: licenseTrackingNo,
            renewalNotice: renewalNotice?.message || '',
            date: new Date().toLocaleString('fa-IR')
          });
          // Note: server-side verification endpoint should update DB status.
          // We intentionally skip client-side status update by Id because we do not have paymentId here.
      
          // Redirect to inbox after a short delay
          setTimeout(() => {
            navigate('/workflow/inbox');
          }, 3000);
      
        } else {
          setStatus('error');
          setMessage(verification.message || 'پرداخت ناموفق بود');
      
          // Note: server-side verification endpoint should mark the payment as failed.
        }
        
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('error');
        setMessage(error.message || 'خطا در بررسی وضعیت پرداخت');
      }
    };

    verifyPayment();
  }, [location.search]);

  const renderContent = () => {
    if (status === 'processing') {
      return (
        <div style={styles.processingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.message}>{message}</p>
        </div>
      );
    }

    if (status === 'success' && paymentDetails) {
      return (
        <div style={styles.successBox} className="printable">
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>پرداخت موفق</h2>
          <p style={styles.successMessage}>{paymentDetails.renewalNotice || 'پرداخت شما با موفقیت انجام شد'}</p>
          {paymentDetails.renewalNotice && (
            <p style={styles.successMessage}>درخواست در مرحله اول گردش تأیید تمدید پروانه بهره‌برداری قرار گرفت.</p>
          )}
          
          <div style={styles.detailsBox}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>شماره پیگیری:</span>
              <span style={styles.detailValue}>{paymentDetails.trackingNumber}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>مبلغ:</span>
              <span style={styles.detailValue}>
                {paymentDetails.amount ? paymentDetails.amount.toLocaleString('fa-IR') : ''} ریال
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>شماره مرجع:</span>
              <span style={styles.detailValue}>{paymentDetails.refId || '---'}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>تاریخ و زمان:</span>
              <span style={styles.detailValue}>{paymentDetails.date}</span>
            </div>
          </div>
          
          <div style={styles.buttonContainer} className="no-print">
            <button 
              style={styles.printButton}
              onClick={() => window.print()}
            >
              چاپ رسید
            </button>
            <button 
              style={styles.returnButton}
              onClick={() => navigate('/')}
            >
              بازگشت به صفحه اصلی
            </button>
          </div>
        </div>
      );
    }

    // Error state
    return (
      <div style={styles.errorBox}>
        <div style={styles.errorIcon}>!</div>
        <h2 style={styles.errorTitle}>خطا در پرداخت</h2>
        <p style={styles.errorMessage}>{message}</p>
        
        <div style={styles.buttonContainer}>
          <button 
            style={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            تلاش مجدد
          </button>
          <button 
            style={styles.returnButton}
            onClick={() => navigate('/')}
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {renderContent()}
    </div>
  );
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
  processingBox: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%'
  },
  successBox: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%'
  },
  errorBox: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
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
  successIcon: {
    width: '80px',
    height: '80px',
    backgroundColor: '#4caf50',
    borderRadius: '50%',
    color: 'white',
    fontSize: '50px',
    lineHeight: '80px',
    margin: '0 auto 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorIcon: {
    width: '80px',
    height: '80px',
    backgroundColor: '#f44336',
    borderRadius: '50%',
    color: 'white',
    fontSize: '50px',
    lineHeight: '80px',
    margin: '0 auto 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  successTitle: {
    color: '#2e7d32',
    marginBottom: '15px',
    fontSize: '24px'
  },
  errorTitle: {
    color: '#d32f2f',
    marginBottom: '15px',
    fontSize: '24px'
  },
  successMessage: {
    color: '#2e7d32',
    marginBottom: '25px',
    fontSize: '18px'
  },
  errorMessage: {
    color: '#d32f2f',
    marginBottom: '25px',
    fontSize: '16px',
    lineHeight: '1.6'
  },
  detailsBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    padding: '20px',
    margin: '25px 0',
    textAlign: 'right',
    border: '1px solid #eee'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    paddingBottom: '10px',
    borderBottom: '1px dashed #e0e0e0'
  },
  detailLabel: {
    color: '#666',
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '120px',
    textAlign: 'right'
  },
  detailValue: {
    color: '#333',
    fontSize: '14px',
    fontFamily: 'monospace',
    textAlign: 'left',
    flex: 1
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    flexWrap: 'wrap',
    marginTop: '30px'
  },
  printButton: {
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '12px 25px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.3s',
    minWidth: '150px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  returnButton: {
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    padding: '12px 25px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.3s',
    minWidth: '150px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  retryButton: {
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    padding: '12px 25px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.3s',
    minWidth: '150px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  message: {
    fontSize: '16px',
    color: '#333',
    marginBottom: '10px',
    lineHeight: '1.6'
  }
};

// Add keyframes for spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @media print {
    body * {
      visibility: hidden;
    }
    
    .printable, .printable * {
      visibility: visible;
    }
    
    .no-print, .no-print * {
      display: none !important;
    }
    
    body {
      background: white;
    }
    
    .printable {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 20px;
    }
  }
`;
document.head.appendChild(style);
