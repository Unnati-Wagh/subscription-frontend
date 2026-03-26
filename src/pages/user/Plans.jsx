import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import UserNavbar from "../../components/UserNavbar";
import UserSidebar from "../../components/UserSidebar";
import { getAllPlansAPI } from "../../services/planService";
import {
  switchPlanAPI,
  calculateUpgradeAPI,
  getMyActivePlanAPI,
} from "../../services/subscriptionService";
import { initiatePaymentAPI } from "../../services/paymentService";

function Plans() {
  const { user } = useAuth();

  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [toast, setToast] = useState({ msg: "", type: "" });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("browse"); // 'browse' | 'compare'

  // ── Fetch plans + active subscription on mount ───────────────
  // ✅ Plans.jsx — combined fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [plansResult, subResult] = await Promise.allSettled([
          getAllPlansAPI(),
          getMyActivePlanAPI(),
        ]);

        // Handle plans
        if (plansResult.status === "fulfilled") {
          setPlans(plansResult.value);
        } else {
          setFetchError(
            plansResult.reason?.response?.data?.message ||
              "Failed to load plans.",
          );
          const cached = sessionStorage.getItem("smp_plans");
          if (cached) setPlans(JSON.parse(cached));
        }

        // Handle subscription
        if (subResult.status === "fulfilled") {
          const data = subResult.value;
          if (!data || !data.planId || !data.planName) {
            setCurrentSub(null);
            sessionStorage.removeItem(`smp_subscription_${user?.email}`);
          } else {
            const subscription = {
              subId: data.subId,
              planId: String(data.planId),
              planName: data.planName,
              price: data.price || data.planPrice || data.Price || 0,
              billing: data.billing || data.billingInterval,
              startDate: data.startDate,
              renewalDate: data.endDate,
              status: data.status,
            };
            setCurrentSub(subscription);
            sessionStorage.setItem(
              `smp_subscription_${user?.email}`,
              JSON.stringify(subscription),
            );
          }
        } else {
          const status = subResult.reason?.response?.status;
          if (status === 404) {
            setCurrentSub(null);
            sessionStorage.removeItem(`smp_subscription_${user?.email}`);
          } else if (status === 403) {
            // 403 often means duplicate active subscriptions in DB
            // Clear cache and show no subscription — backend fix required
            setCurrentSub(null);
            sessionStorage.removeItem(`smp_subscription_${user?.email}`);
            setFetchError(
              "Unable to load subscription. This may be due to a duplicate subscription in the database. Please contact support.",
            );
          } else {
            const cached = sessionStorage.getItem(
              `smp_subscription_${user?.email}`,
            );
            setCurrentSub(cached ? JSON.parse(cached) : null);
          }
        }
      } finally {
        setLoading(false); // ✅ Only renders cards after BOTH calls finish
      }
    };

    fetchAll();

    // Listen for subscription changes from other pages (e.g., Subscription.jsx)
    const handleSubscriptionUpdate = (event) => {
      console.log("📍 Subscription update event received:", event.detail);
      if (event.detail?.action === "cancel") {
        console.log("✅ Subscription was cancelled. Clearing currentSub...");
        setCurrentSub(null);
        sessionStorage.removeItem(`smp_subscription_${user?.email}`);
      } else if (
        event.detail?.action === "subscribe" ||
        event.detail?.action === "switch"
      ) {
        console.log("✅ Subscription was updated. Refreshing...");
        fetchMySub();
      }
    };

    window.addEventListener(
      "smp-subscription-updated",
      handleSubscriptionUpdate,
    );
    return () => {
      window.removeEventListener(
        "smp-subscription-updated",
        handleSubscriptionUpdate,
      );
    };
  }, [user]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  // ── Subscribe / switch plan ───────────────────────────────────
  const handleConfirmSubscribe = async () => {
    const plan = confirmPlan;
    setConfirmPlan(null);
    setPaymentLoading(true);

    try {
      if (currentSub) {
        const upgrade = await calculateUpgradeAPI(plan.id);
        console.log("📍 Upgrade calculation result:", upgrade);
        if (upgrade.extraAmountToPay > 0) {
          const payment = await initiatePaymentAPI(
            plan.id,
            upgrade.extraAmountToPay,
            "INR",
            
          );
          localStorage.setItem("smp_payment_isswitch", "true");
          localStorage.setItem(
            "smp_payment_amount",
            String(upgrade.extraAmountToPay),
          );
          window.location.href = payment.checkoutUrl;
        } else {
          const data = await switchPlanAPI(plan.id, upgrade.remainingDays);
          const subscription = {
            subId: data.subId,
            planId: data.planId,
            planName: data.planName,
            tier: data.tier,
            price: data.price || data.planPrice,
            billing: data.billing || data.billingInterval,
            startDate: data.startDate,
            renewalDate: data.endDate,
            daysRemaining: data.daysRemaining,
            autoRenew: data.autoRenew,
            status: data.status,
          };
          sessionStorage.setItem(
            `smp_subscription_${user?.email}`,
            JSON.stringify(subscription),
          );
          setCurrentSub(subscription);
          const refreshed = await getAllPlansAPI();
          setPlans(refreshed);
          showToast(`Switched to ${data.planName} successfully!`);
        }
      } else {
        const payment = await initiatePaymentAPI(
          plan.id,
          plan.price,
          "INR",
          
        );
        localStorage.setItem("smp_payment_isswitch", "false");
        localStorage.setItem("smp_payment_amount", "0");
        window.location.href = payment.checkoutUrl;
      }
    } catch (err) {
      console.error("❌ Payment initiation error:", {
        status: err.response?.status,
        message: err.response?.data?.message,
        data: err.response?.data,
      });

      const errorMsg =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";

      // Handle "already have active subscription" error
      if (
        errorMsg.includes("already have") ||
        errorMsg.includes("active subscription")
      ) {
        console.warn(
          "⚠️ User has active subscription. Refreshing subscription data...",
        );

        // Refresh subscription status from backend
        try {
          const freshSub = await getMyActivePlanAPI();
          if (freshSub) {
            const subscription = {
              subId: freshSub.subId,
              planId: String(freshSub.planId),
              planName: freshSub.planName,
              price:
                freshSub.price || freshSub.planPrice || freshSub.Price || 0,
              billing: freshSub.billing,
              startDate: freshSub.startDate,
              renewalDate: freshSub.endDate,
              status: freshSub.status,
            };
            setCurrentSub(subscription);
            sessionStorage.setItem(
              `smp_subscription_${user?.email}`,
              JSON.stringify(subscription),
            );

            showToast(
              "You currently have an active subscription. Please cancel it first if you want to switch plans.",
              "error",
            );
          }
        } catch (refreshErr) {
          console.error("Error refreshing subscription:", refreshErr);
          showToast(
            "You may already have an active subscription. Please check your subscription status or contact support.",
            "error",
          );
        }
      } else {
        showToast(errorMsg, "error");
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── Display helpers ───────────────────────────────────────────
  const displayBilling = (interval = "") =>
    interval.charAt(0) + interval.slice(1).toLowerCase();

  const getFeatures = (plan) =>
    Array.isArray(plan.features)
      ? plan.features
      : (plan.features || "")
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);

  const tierStyle = {
    BASIC: { text: "#3730a3", bg: "#e0e7ff" },
    PRO: { text: "#9d174d", bg: "#fce7f3" },
    ENTERPRISE: { text: "#92400e", bg: "#fef3c7" },
  };

  const activePlans = plans.filter((p) => p.active);

  return (
    <div>
      <UserNavbar />
      <div className="user-shell">
        <UserSidebar />
        <main className="user-content">
          {/* Toast */}
          {toast.msg && (
            <div
              style={{
                position: "fixed",
                top: "76px",
                right: "28px",
                zIndex: 300,
                background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                color: toast.type === "success" ? "#166534" : "#991b1b",
                borderRadius: "10px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: "500",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              {toast.type === "success" ? "✓" : "✗"} {toast.msg}
            </div>
          )}

          {/* Page header + tabs */}
          <div style={{ marginBottom: "24px" }}>
            {/* <h1 className="admin-page-title">Browse Plans</h1> */}
            <p className="admin-page-title" style={{ marginBottom: "20px" }}>
              {currentSub
                ? `You are on the ${currentSub.planName} plan. Switch anytime.`
                : "Choose the plan that best fits your needs."}
            </p>

            {/* Tab switcher */}
            <div
              style={{
                display: "flex",
                gap: "2px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "4px",
                width: "fit-content",
              }}
            >
              {[
                { key: "browse", label: "📋 Browse Plans" },
                { key: "compare", label: "⚖️ Compare Plans" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-sm)",
                    fontWeight: activeTab === tab.key ? "600" : "400",
                    background:
                      activeTab === tab.key ? "var(--bg-card)" : "transparent",
                    color:
                      activeTab === tab.key
                        ? "var(--brand)"
                        : "var(--text-muted)",
                    boxShadow:
                      activeTab === tab.key ? "var(--shadow-sm)" : "none",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fetch error */}
          {fetchError && (
            <div className="smp-error-msg" style={{ marginBottom: "16px" }}>
              {fetchError}
            </div>
          )}

          {/* Current plan banner */}
          {currentSub && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                padding: "16px 24px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "22px" }}>✅</span>
              <div>
                <div
                  style={{
                    fontWeight: "600",
                    color: "#166534",
                    fontSize: "14px",
                    marginBottom: "2px",
                  }}
                >
                  Current plan: {currentSub.planName}
                </div>
                <div style={{ fontSize: "13px", color: "#4d7c60" }}>
                  ₹{currentSub.price}/{displayBilling(currentSub.billing)} ·
                  Renews on {currentSub.renewalDate}
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                padding: "80px",
                textAlign: "center",
                color: "var(--text-light)",
                fontSize: "14px",
              }}
            >
              Loading plans...
            </div>
          ) : activePlans.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "var(--bg-card)",
                borderRadius: "16px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
              <div
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "var(--text-dark)",
                  marginBottom: "8px",
                }}
              >
                No plans available
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                The admin hasn't published any plans yet. Check back soon!
              </div>
            </div>
          ) : (
            <>
              {/* ══ TAB: BROWSE PLANS ══ */}
              {activeTab === "browse" && (
                <div className="plans-grid">
                  {activePlans.map((plan, index) => {
                    const planIdFromUser = String(currentSub?.planId || "");
                    const planIdFromList = String(plan.id || "");
                    const isCurrent =
                      planIdFromUser === planIdFromList ||
                      (currentSub?.planName &&
                        currentSub.planName === plan.name);
                    const isPopular = plan.tier === "PRO";
                    const colors = tierStyle[plan.tier] || tierStyle.BASIC;

                    return (
                      <div
                        key={`${plan.id}-${index}`}
                        className={
                          "plan-card" +
                          (isPopular && !isCurrent ? " popular" : "") +
                          (isCurrent ? " current-plan" : "")
                        }
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        {isPopular && !isCurrent && (
                          <div className="popular-badge">⭐ Most Popular</div>
                        )}
                        {isCurrent && (
                          <div className="current-badge">✓ Current Plan</div>
                        )}

                        {/* Card header */}
                        <div
                          className="plan-card-header"
                          style={{
                            background:
                              plan.tier === "ENTERPRISE"
                                ? "linear-gradient(135deg, #1e1b4b, #312e81)"
                                : plan.tier === "PRO"
                                  ? "#f5f3ff"
                                  : "#fafbff",
                          }}
                        >
                          <div
                            className="plan-tier-label"
                            style={{
                              color:
                                plan.tier === "ENTERPRISE"
                                  ? "#a5b4fc"
                                  : colors.text,
                            }}
                          >
                            {plan.tier}
                          </div>
                          <div
                            className="plan-name"
                            style={{
                              color:
                                plan.tier === "ENTERPRISE"
                                  ? "white"
                                  : "var(--text-dark)",
                            }}
                          >
                            {plan.name}
                          </div>

                          {plan.description && (
                            <div
                              style={{
                                fontSize: "12px",
                                marginBottom: "8px",
                                color:
                                  plan.tier === "ENTERPRISE"
                                    ? "rgba(255,255,255,0.6)"
                                    : "var(--text-light)",
                              }}
                            >
                              {plan.description}
                            </div>
                          )}

                          <div
                            className="plan-price"
                            style={{
                              color:
                                plan.tier === "ENTERPRISE"
                                  ? "#67e8f9"
                                  : "var(--brand)",
                            }}
                          >
                            ₹{plan.price}
                            <span className="plan-price-cycle">
                              /{displayBilling(plan.billingInterval)}
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div
                          className="plan-card-body"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            flex: 1,
                          }}
                        >
                          <ul className="plan-feature-list">
                            {getFeatures(plan).map((f, i) => (
                              <li key={i}>
                                <span className="check">✓</span>
                                {f}
                              </li>
                            ))}
                          </ul>

                          {plan.subscriberCount !== undefined && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--text-light)",
                                marginBottom: "12px",
                              }}
                            >
                              👥 {plan.subscriberCount} subscriber
                              {plan.subscriberCount !== 1 ? "s" : ""}
                            </div>
                          )}

                          <button
                            className={
                              "btn-select-plan" + (isCurrent ? " current" : "")
                            }
                            disabled={isCurrent}
                            onClick={() => !isCurrent && setConfirmPlan(plan)}
                            style={{
                              marginTop: "auto",
                              ...(plan.tier === "ENTERPRISE" && !isCurrent
                                ? { background: "#4f46e5" }
                                : {}),
                            }}
                          >
                            {isCurrent
                              ? "✓ Current plan"
                              : currentSub
                                ? "Switch to this plan"
                                : "Select plan"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ══ TAB: COMPARE PLANS ══ */}
              {activeTab === "compare" && (
                <div className="data-table-card">
                  <div className="data-table-header">
                    <h3>Plan comparison</h3>
                    <span
                      style={{ fontSize: "13px", color: "var(--text-light)" }}
                    >
                      {activePlans.length} plans available
                    </span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Tier</th>
                        <th>Price</th>
                        <th>Billing</th>
                        <th>Features</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePlans.map((plan, index) => {
                        const planIdFromUser = String(currentSub?.planId || "");
                        const planIdFromList = String(plan.id || "");
                        const isCurrent =
                          planIdFromUser === planIdFromList ||
                          (currentSub?.planName &&
                            currentSub.planName === plan.name);

                        return (
                          <tr key={`table-${plan.id}-${index}`}>
                            <td style={{ fontWeight: 600 }}>{plan.name}</td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 10px",
                                  borderRadius: "20px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  background: (
                                    tierStyle[plan.tier] || tierStyle.BASIC
                                  ).bg,
                                  color: (
                                    tierStyle[plan.tier] || tierStyle.BASIC
                                  ).text,
                                }}
                              >
                                {plan.tier}
                              </span>
                            </td>
                            <td
                              style={{ fontWeight: 600, color: "var(--brand)" }}
                            >
                              ₹{plan.price}
                            </td>
                            <td>{displayBilling(plan.billingInterval)}</td>
                            <td
                              style={{
                                color: "var(--text-muted)",
                                fontSize: "13px",
                              }}
                            >
                              {getFeatures(plan).join(", ")}
                            </td>
                            <td>
                              {isCurrent ? (
                                <span className="badge badge-active">
                                  Current
                                </span>
                              ) : (
                                <button
                                  className="btn-admin-secondary"
                                  onClick={() => setConfirmPlan(plan)}
                                >
                                  Select
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Confirm modal */}
      {confirmPlan && (
        <div className="modal-overlay" onClick={() => setConfirmPlan(null)}>
          <div
            className="confirm-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-icon">
              {confirmPlan.tier === "ENTERPRISE"
                ? "🏢"
                : confirmPlan.tier === "PRO"
                  ? "⭐"
                  : "📋"}
            </div>
            <div className="confirm-modal-title">
              {currentSub ? "Switch plan?" : "Subscribe to plan?"}
            </div>
            <div className="confirm-modal-body">
              {currentSub
                ? `You're switching from ${currentSub.planName} to `
                : "You are subscribing to "}
              <strong>{confirmPlan.name}</strong> for{" "}
              <strong>
                ₹{confirmPlan.price}/
                {displayBilling(confirmPlan.billingInterval)}
              </strong>
              .
              <br />
              <br />
              <div
                style={{
                  background: "var(--info-bg)",
                  border: "1px solid var(--info-border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#1e40af",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>🔒</span>
                You will be redirected to Stripe's secure payment page.
              </div>
            </div>
            <div className="confirm-modal-actions">
              <button
                className="btn-modal-cancel"
                onClick={() => setConfirmPlan(null)}
              >
                Cancel
              </button>
              <button
                className="btn-admin-primary"
                onClick={handleConfirmSubscribe}
                disabled={paymentLoading}
                style={{ opacity: paymentLoading ? 0.7 : 1 }}
              >
                {paymentLoading
                  ? "Preparing payment..."
                  : currentSub
                    ? "Yes, switch plan"
                    : "Proceed to payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Plans;
