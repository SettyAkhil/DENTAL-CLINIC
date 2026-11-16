import React, { useState } from 'react';
import api from '../../services/api';
import hospaiDentalLogo from '../../assets/hospai-dental-logo-dark.png';
import hospaiLoginLogo from '../../assets/hospai-login-logo.png';
import loginToothWatermark from '../../assets/login-tooth-watermark.png';
import kalpraTechLogo from '../../assets/kalpra-tech-logo.png';
import './LoginPage.css';

type IconName =
  | 'staff'
  | 'doctor'
  | 'admin'
  | 'lock'
  | 'tooth'
  | 'eye'
  | 'arrow'
  | 'x'
  | 'key';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const p: Record<IconName, React.ReactNode> = {
    staff: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21a7 7 0 0 1 14 0M17 8h5M19.5 5.5v5" />
      </>
    ),
    doctor: (
      <>
        <path d="M4.5 3v5a5.5 5.5 0 0 0 11 0V3" />
        <path d="M10 13.5V17a4 4 0 0 0 8 0v-2.5" />
        <circle cx="18" cy="14" r="1.5" />
        <path d="M3 3h3M14 3h3" />
      </>
    ),
    admin: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    tooth: (
      <path d="M7 3c-3 1-4 5-2 9 1 2 1 9 4 9 2 0 1-6 3-6s1 6 3 6c3 0 3-7 4-9 2-4 1-8-2-9-2-1-3 1-5 1S9 2 7 3Z" />
    ),
    eye: (
      <>
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    arrow: <path d="m5 12 14 0M14 7l5 5-5 5" />,
    x: <path d="m6 6 12 12M18 6 6 18" />,
    key: (
      <>
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m21 2-9.6 9.6M15.5 7.5l3 3M18.5 4.5l3 3" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p[name]}
    </svg>
  );
}

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState<'staff' | 'doctor' | 'admin'>('admin');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [remember, setRemember] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim()) {
      setError(
        role === 'admin'
          ? 'Please enter your admin username or email'
          : role === 'doctor'
          ? 'Please enter your doctor email or username'
          : 'Please enter your work email or username'
      );
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.post('/auth/login', {
        username: username.trim(),
        password: password,
      });

      if (res.data && res.data.success) {
        localStorage.setItem('clinic_token', res.data.token);
        localStorage.setItem('clinic_user', JSON.stringify(res.data.user));
        onLoginSuccess(res.data.user);
      } else {
        setError(res.data?.message || 'Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Unable to connect to authentication server. Please check credentials or contact administrator.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fillQuickCredentials = (u: string, p: string, r: 'staff' | 'doctor' | 'admin') => {
    setRole(r);
    setUsername(u);
    setPassword(p);
    setShowHelpModal(false);
    setError('');
  };

  return (
    <div className="login-page">
      {/* SVG Background Scene with S-curve divider, arcs, dots & tooth watermark */}
      <svg
        className="login-scene"
        viewBox="0 0 1600 800"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect className="login-scene-base" width="1600" height="800" />
        <circle className="login-scene-arc login-scene-arc-top-a" cx="290" cy="-245" r="385" />
        <circle className="login-scene-arc login-scene-arc-top-b" cx="290" cy="-245" r="455" />
        <circle className="login-scene-arc login-scene-arc-bottom-a" cx="75" cy="1010" r="350" />
        <circle className="login-scene-arc login-scene-arc-bottom-b" cx="75" cy="1010" r="420" />
        <image href={loginToothWatermark} x="548" y="245" width="187" height="205" />
        <path
          className="login-scene-surface"
          d="M815 0C714 128 713 190 754 278C801 377 830 421 776 520C735 596 651 698 570 800H1600V0H815Z"
        />
        <circle
          className="login-scene-right-arc login-scene-right-top-a"
          cx="1555"
          cy="-150"
          r="275"
        />
        <circle
          className="login-scene-right-arc login-scene-right-top-b"
          cx="1555"
          cy="-150"
          r="345"
        />
        <circle
          className="login-scene-right-arc login-scene-right-bottom-a"
          cx="1510"
          cy="925"
          r="280"
        />
        <circle
          className="login-scene-right-arc login-scene-right-bottom-b"
          cx="1510"
          cy="925"
          r="350"
        />
        <path
          className="login-scene-divider-wide"
          d="M815 0C714 128 713 190 754 278C801 377 830 421 776 520C735 596 651 698 570 800"
        />
        <path
          className="login-scene-divider"
          d="M815 0C714 128 713 190 754 278C801 377 830 421 776 520C735 596 651 698 570 800"
        />
      </svg>

      {/* Brand Hero Panel (Left) */}
      <section className="login-brand-panel">
        <div className="login-brand-content">
          <img className="login-brand-logo" src={hospaiLoginLogo} alt="HospAI Dental" />
          <div className="login-message">
            <span>CLINICAL OPERATIONS PLATFORM</span>
            <h1>Precision at every point of care.</h1>
            <p>
              One secure workspace for patient care, clinical records, treatment, pharmacy and
              practice operations.
            </p>
          </div>
          <div className="login-trust">
            <div>
              <Icon name="lock" size={17} />
              <span>
                <strong>Protected workspace</strong>
                Role-based access and audited actions
              </span>
            </div>
            <div>
              <Icon name="tooth" size={17} />
              <span>
                <strong>Dental-first workflows</strong>
                Built around the complete patient journey
              </span>
            </div>
          </div>
        </div>
        <p>DentalCare Clinic · Standalone clinical workspace</p>
      </section>

      {/* Main Login Form Panel (Right) */}
      <main className="login-main">
        <div className="login-card">
          <img className="login-mobile-logo" src={hospaiDentalLogo} alt="HospAI Dental" />
          <div className="login-heading">
            <span className="login-secure-badge">SECURE SIGN IN</span>
            <h2>
              {role === 'staff' && 'Staff Portal'}
              {role === 'doctor' && 'Doctor Portal'}
              {role === 'admin' && 'Admin Portal'}
            </h2>
            <p>
              {role === 'admin'
                ? 'Sign in to system administration & configuration.'
                : role === 'doctor'
                ? 'Sign in to your clinical treatment workspace.'
                : 'Sign in to the Clinic Staff workspace.'}
            </p>
          </div>

          <div className="login-mode" role="tablist" aria-label="Choose login type">
            <button
              type="button"
              className={role === 'staff' ? 'active' : ''}
              onClick={() => {
                setRole('staff');
                setError('');
              }}
            >
              <Icon name="staff" size={14} /> Staff
            </button>
            <button
              type="button"
              className={role === 'doctor' ? 'active' : ''}
              onClick={() => {
                setRole('doctor');
                setError('');
              }}
            >
              <Icon name="doctor" size={14} /> Doctor
            </button>
            <button
              type="button"
              className={role === 'admin' ? 'active' : ''}
              onClick={() => {
                setRole('admin');
                setError('');
              }}
            >
              <Icon name="admin" size={14} /> Admin
            </button>
          </div>

          {error && (
            <div className="login-error-alert" role="alert">
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={submit}>
            <label>
              <span className="login-form-label-text">
                {role === 'admin'
                  ? 'Admin username or email'
                  : role === 'doctor'
                  ? 'Doctor email or username'
                  : 'Work email or username'}
              </span>
              <div className="login-input">
                <Icon
                  name={role === 'doctor' ? 'doctor' : role === 'admin' ? 'admin' : 'staff'}
                  size={15}
                />
                <input
                  type="text"
                  placeholder={
                    role === 'admin'
                      ? 'Enter admin username or email'
                      : role === 'doctor'
                      ? 'Enter doctor email or username'
                      : 'Enter work email or username'
                  }
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </label>
            <label>
              <span className="login-form-label-text">Password</span>
              <div className="login-input">
                <Icon name="lock" size={15} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name="eye" size={15} />
                </button>
              </div>
            </label>
            <div className="login-options">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
              <button type="button" onClick={() => setShowHelpModal(true)}>
                Forgot password?
              </button>
            </div>

            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? (
                <span className="login-spinner" />
              ) : (
                <>
                  <span>
                    {role === 'doctor'
                      ? 'Sign in as Doctor'
                      : role === 'admin'
                      ? 'Sign in as Admin'
                      : 'Sign in as Staff'}
                  </span>
                  <span className="login-submit-arrow">→</span>
                </>
              )}
            </button>
          </form>

          <div className="login-security">
            <Icon name="lock" size={15} />
            <span>
              This is a synthetic prototype. No production authentication or patient data is used.
            </span>
          </div>
        </div>

        <p className="login-help">
          Need access help?{' '}
          <button type="button" onClick={() => setShowHelpModal(true)}>
            Contact clinic administration
          </button>
        </p>

        <div className="login-powered">
          <span>POWERED BY</span>
          <img src={kalpraTechLogo} alt="Kalpra Tech" />
        </div>
      </main>

      {/* Access Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 relative text-slate-800"
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full transition"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              aria-label="Close dialog"
            >
              <Icon name="x" size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#ecf8fc',
                  color: '#0c6f93',
                  borderRadius: '10px',
                  display: 'flex',
                }}
              >
                <Icon name="key" size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#183344' }}>
                  Clinic Workspace Access
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#718692' }}>
                  Staff roles &amp; test credentials
                </p>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#526b78', lineHeight: 1.5, marginBottom: '16px' }}>
              Access is restricted to authorized clinic staff. For prototype testing, you can click
              any pre-configured account:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div
                onClick={() => fillQuickCredentials('priya.menon@dentalcare.example', 'admin123', 'doctor')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #dce8ea',
                  cursor: 'pointer',
                  backgroundColor: '#f3f9fa',
                  transition: 'background-color 150ms',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#183344' }}>
                      Dr. Priya Menon
                    </span>
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        backgroundColor: '#ddf3fa',
                        color: '#0c6f93',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Doctor
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#2baad8', fontWeight: 600 }}>Use &rarr;</span>
                </div>
                <div style={{ fontSize: '11px', color: '#718692', marginTop: '4px' }}>
                  <span>email: priya.menon@dentalcare.example</span>
                  <span style={{ margin: '0 6px' }}>&middot;</span>
                  <span>pass: admin123</span>
                </div>
              </div>

              <div
                onClick={() => fillQuickCredentials('admin', 'admin123', 'admin')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #dce8ea',
                  cursor: 'pointer',
                  backgroundColor: '#f3f9fa',
                  transition: 'background-color 150ms',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#183344' }}>
                      System Administrator
                    </span>
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        backgroundColor: '#ddf3fa',
                        color: '#0c6f93',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Admin
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#2baad8', fontWeight: 600 }}>Use &rarr;</span>
                </div>
                <div style={{ fontSize: '11px', color: '#718692', marginTop: '4px' }}>
                  <span>user: admin</span>
                  <span style={{ margin: '0 6px' }}>&middot;</span>
                  <span>pass: admin123</span>
                </div>
              </div>

              <div
                onClick={() => fillQuickCredentials('admin', 'admin123', 'staff')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #dce8ea',
                  cursor: 'pointer',
                  backgroundColor: '#f3f9fa',
                  transition: 'background-color 150ms',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#183344' }}>
                      Clinic Staff / Reception
                    </span>
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        backgroundColor: '#ddf3fa',
                        color: '#0c6f93',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Staff
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#2baad8', fontWeight: 600 }}>Use &rarr;</span>
                </div>
                <div style={{ fontSize: '11px', color: '#718692', marginTop: '4px' }}>
                  <span>user: admin</span>
                  <span style={{ margin: '0 6px' }}>&middot;</span>
                  <span>pass: admin123</span>
                </div>
              </div>
            </div>

            <div
              style={{
                paddingTop: '12px',
                borderTop: '1px solid #eaf0f1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: '#718692',
              }}
            >
              <span>Admin contact: support@hospai.internal</span>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#eef6f9',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#183344',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
