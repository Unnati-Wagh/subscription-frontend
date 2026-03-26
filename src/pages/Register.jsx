import { useState,useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  sendOtpAPI,
  verifyOtpAPI,
  verifyEmailAPI,
} from "../services/authService";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  // 'checking' | 'available' | 'taken' | ''
  const [emailChecking, setEmailChecking] = useState(false);

  // ── Check email availability with debounce ────────────────────
  // Fires 600ms after user stops typing — avoids hammering the API
  useEffect(() => {
    // Reset if email is empty or invalid format
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailStatus("");
      return;
    }

    setEmailChecking(true);
    setEmailStatus("checking");

    const timer = setTimeout(async () => {
      try {
        const data = await verifyEmailAPI(email);
        // Note: backend typo — field is "succuss" not "success"
        if (data.success === true) {
          setEmailStatus("available");
        } else {
          setEmailStatus("taken");
        }
      } catch {
        setEmailStatus(""); // silently fail — don't block registration
      } finally {
        setEmailChecking(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer); // cancel if user types again
  }, [email]);

  const { register } = useAuth();
  const navigate = useNavigate();

  // ── Send OTP via Spring Boot ──────────────────────────────────
  const handleSendOtp = async () => {
    setOtpError("");

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setOtpError("Please enter a valid email address first.");
      return;
    }

    setOtpLoading(true);
    try {
      await sendOtpAPI(email);
      // Spring Boot emails the OTP — nothing to show on screen
      setOtpSent(true);
      setEnteredOtp("");
      setEmailVerified(false);
    } catch (err) {
      const msg =
        err.response?.data?.message || "Failed to send OTP. Please try again.";
      setOtpError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Verify OTP via Spring Boot ────────────────────────────────
  const handleVerifyOtp = async () => {
    setOtpError("");

    if (!enteredOtp) {
      setOtpError("Please enter the OTP.");
      return;
    }

    setVerifyLoading(true);
    try {
      await verifyOtpAPI(email, enteredOtp);
      // If no error thrown → OTP matched
      setEmailVerified(true);
      setOtpError("");
    } catch (err) {
      const msg =
        err.response?.data?.message || "Incorrect OTP. Please try again.";
      setOtpError(msg);
      setEmailVerified(false);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Reset OTP state when user changes email
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setOtpSent(false);
    setEmailVerified(false);
    setEnteredOtp("");
    setOtpError("");
    setEmailStatus(""); // reset check when email changes
  };

  // ── Register ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !email || !mobile || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (emailStatus === "taken") {
      setError("This email is already registered. Please log in instead.");
      return;
    }
    if (emailStatus !== "available") {
      setError("Please enter a valid email address.");
      return;
    }
    if (!emailVerified) {
      setError("Please verify your email before creating an account.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const result = await register(name, email, mobile, password);
    setLoading(false);

    if (result.success) {
      setSuccess("Account created! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } else {
      setError(result.message);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── LEFT PANEL ── */}
      <div className="smp-left-panel">
        <div className="smp-brand">
          <div className="smp-logo-icon">💳</div>
          <span className="smp-brand-name">
            Sub<span className="smp-brand-accent">Manage</span>
          </span>
        </div>
        <h1 className="smp-headline">
          Start managing
          <br />
          <em>smarter today.</em>
        </h1>
        <p className="smp-subtext">
          Create your free account and get instant access to all subscription
          tools.
        </p>
        <div className="smp-float-cards">
          <div className="smp-fcard">
            <span className="smp-fcard-num">Free</span>To join
          </div>
          <div className="smp-fcard">
            <span className="smp-fcard-num">JWT</span>Secured
          </div>
          <div className="smp-fcard">
            <span className="smp-fcard-num">AWS</span>Powered
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="smp-right-panel">
        <div className="smp-form-box">
          <h2 className="smp-form-title">Create account</h2>
          <p className="smp-form-subtitle">
            Join SubManage — it's free to sign up
          </p>

          {error && <div className="smp-error-msg">{error}</div>}
          {success && <div className="smp-success-msg">{success}</div>}

          <form onSubmit={handleSubmit}>
            {/* Full name */}
            <div className="smp-field">
              <label>Full name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email + Send OTP */}
            <div className="smp-field">
              <label>
                Email address
                {/* Real-time availability indicator */}
                {emailChecking && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      color: "var(--text-light)",
                      fontWeight: 400,
                    }}
                  >
                    Checking...
                  </span>
                )}
                {!emailChecking && emailStatus === "available" && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      color: "var(--success)",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Email available
                  </span>
                )}
                {!emailChecking && emailStatus === "taken" && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      color: "var(--error)",
                      fontWeight: 600,
                    }}
                  >
                    ✗ Email already registered
                  </span>
                )}
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  style={{
                    flex: 1,
                    borderColor: emailVerified
                      ? "var(--success)"
                      : emailStatus === "available"
                        ? "var(--success)"
                        : emailStatus === "taken"
                          ? "var(--error)"
                          : undefined,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="smp-otp-send-btn"
                  // Disable Send OTP if email is taken or still checking
                  disabled={
                    emailVerified ||
                    otpLoading ||
                    emailStatus === "taken" ||
                    emailStatus === "checking" ||
                    emailStatus === ""
                  }
                >
                  {otpLoading
                    ? "Sending..."
                    : emailVerified
                      ? "✓ Sent"
                      : otpSent
                        ? "Resend"
                        : "Send OTP"}
                </button>
              </div>

              {/* Taken error message below input */}
              {emailStatus === "taken" && (
                <p
                  style={{
                    color: "var(--error)",
                    fontSize: "12px",
                    marginTop: "6px",
                    fontWeight: "500",
                  }}
                >
                  This email is already registered.{" "}
                  <span
                    onClick={() => (window.location.href = "/login")}
                    style={{
                      color: "var(--brand)",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Log in instead?
                  </span>
                </p>
              )}
            </div>

            {/* Info message after OTP is sent */}
            {otpSent && !emailVerified && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#1e40af",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>📬</span>
                OTP sent to <strong>{email}</strong> — check your inbox (and
                spam folder).
              </div>
            )}

            {/* OTP input — shown after Send OTP clicked */}
            {otpSent && !emailVerified && (
              <div className="smp-field">
                <label>
                  Enter OTP{" "}
                  <span style={{ color: "var(--text-light)", fontWeight: 400 }}>
                    (6-digit code from your email)
                  </span>
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="e.g. 482910"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => {
                      setEnteredOtp(e.target.value);
                      setOtpError("");
                    }}
                    style={{
                      flex: 1,
                      letterSpacing: "0.25em",
                      fontWeight: "700",
                      fontSize: "18px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    className="smp-otp-verify-btn"
                    disabled={verifyLoading || enteredOtp.length < 4}
                  >
                    {verifyLoading ? "Verifying..." : "Verify"}
                  </button>
                </div>
                {otpError && (
                  <p
                    style={{
                      color: "var(--error)",
                      fontSize: "12px",
                      marginTop: "6px",
                    }}
                  >
                    {otpError}
                  </p>
                )}
              </div>
            )}

            {/* Verified badge */}
            {emailVerified && (
              <div className="smp-verified-badge">
                ✓ Email verified — {email}
              </div>
            )}

            {/* Mobile */}
            <div className="smp-field">
              <label>Mobile number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>

            <div className="smp-field">
              <label>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-light)",
                    fontSize: "16px",
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit — disabled until email verified */}
            <button
              type="submit"
              className="smp-btn-primary"
              disabled={!emailVerified || loading}
              style={{ opacity: !emailVerified ? 0.5 : 1 }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="smp-link-row">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
