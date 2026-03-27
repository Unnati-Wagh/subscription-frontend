import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import UserNavbar from "../../components/UserNavbar";
import UserSidebar from "../../components/UserSidebar";
import {
  updateProfileAPI,
  getProfileAPI,
  updateProfilePhotoAPI,
} from "../../services/authService";

const formatDate = (isoString) => {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (isoString) => {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

function Profile() {
  const { user, updateUser, updateAvatar } = useAuth();
  const fileInputRef = useRef(null);

  const [editing, setEditing]       = useState(false);
  const [name, setName]             = useState(user?.name || "");
  const [mobile, setMobile]         = useState("");
  const [avatarUrl, setAvatarUrl]   = useState(null);
  const [createdAt, setCreatedAt]   = useState(null);
  const [updatedAt, setUpdatedAt]   = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [fetching, setFetching]     = useState(true);

  const [photoPreview, setPhotoPreview]     = useState(null);
  const [photoFile, setPhotoFile]           = useState(null);
  const [photoError, setPhotoError]         = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [toast, setToast]   = useState({ msg: "", type: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setFetching(true);
      try {
        const data = await getProfileAPI();
        setName(data.fullName || user?.name || "");
        setMobile(data.mobile || "");
        setAvatarUrl(data.avatarUrl || null);
        if (data.avatarUrl && updateAvatar) updateAvatar(data.avatarUrl);
        setCreatedAt(data.createdAt || null);
        setUpdatedAt(data.updatedAt || null);
      } catch {
        setFetchError("Could not load profile data.");
      } finally {
        setFetching(false);
      }
    };
    fetchProfile();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Please select a valid image file."); return; }
    if (file.size > 1 * 1024 * 1024) { setPhotoError("Image must be under 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setPhotoFile(file);
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    setPhotoError("");
    try {
      const data = await updateProfilePhotoAPI(photoFile);
      setAvatarUrl(data.avatarUrl);
      setPhotoPreview(null);
      setPhotoFile(null);
      if (updateAvatar) updateAvatar(data.avatarUrl);
      showToast("Profile photo updated successfully!");
    } catch (err) {
      setPhotoError(err.response?.data?.message || "Failed to upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCancelPhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    setPhotoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setError("");
    if (!name.trim()) { setError("Name cannot be empty."); return; }
    if (!mobile.trim()) { setError("Mobile number cannot be empty."); return; }
    if (mobile.trim().length !== 10) { setError("Please enter a valid 10-digit mobile number."); return; }
    if (!/^[0-9+\s\-]{7,15}$/.test(mobile.trim())) { setError("Please enter a valid mobile number."); return; }

    setLoading(true);
    try {
      const data = await updateProfileAPI(name.trim(), mobile.trim());
      setUpdatedAt(new Date().toISOString());
      const currentUser = JSON.parse(sessionStorage.getItem("smp_user") || "{}");
      const updatedUser = { ...currentUser, name: name.trim() };
      sessionStorage.setItem("smp_user", JSON.stringify(updatedUser));
      if (updateUser) updateUser(updatedUser);
      setEditing(false);
      showToast(data?.message || "Profile updated successfully!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || "");
    setError("");
    setEditing(false);
  };

  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const displayAvatar = photoPreview || avatarUrl;

  return (
    <div>
      <UserNavbar />
      <div className="user-shell">
        <UserSidebar />
        <main className="user-content" style={{ padding: "20px 28px" }}>

          {/* Toast */}
          {toast.msg && (
            <div style={{
              position: "fixed", top: "68px", right: "24px", zIndex: 300,
              background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              color: toast.type === "success" ? "#166534" : "#991b1b",
              borderRadius: "10px", padding: "10px 18px",
              fontSize: "13px", fontWeight: "500",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}>
              {toast.type === "success" ? "✓" : "✗"} {toast.msg}
            </div>
          )}

          {/* Page title row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 700, color: "var(--text-dark)", marginBottom: "2px" }}>
                My Profile
              </h1>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>View and update your account details.</p>
            </div>
          </div>

          {fetching ? (
            <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--border)", padding: "40px", textAlign: "center", color: "var(--text-light)", fontSize: "14px" }}>
              Loading profile...
            </div>
          ) : (
            <>
              {fetchError && <div className="smp-error-msg" style={{ marginBottom: "12px" }}>{fetchError}</div>}

              {/* ── Single compact card ── */}
              <div style={{ background: "white", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>

                {/* Thin colour band */}
                <div style={{ height: "56px", background: "linear-gradient(135deg, #0f4c3a, #1d9e75)" }} />

                {/* Avatar + name + edit button row */}
                <div style={{ padding: "0 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "-28px", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "14px" }}>

                    {/* Avatar */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {displayAvatar ? (
                        <img src={displayAvatar} alt="Profile" style={{ width: "56px", height: "56px", borderRadius: "50%", objectFit: "cover", border: "3px solid white", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                      ) : (
                        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "white", border: "3px solid white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--brand)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                          {initials}
                        </div>
                      )}
                      {editing && (
                        <button type="button" onClick={() => fileInputRef.current?.click()} title="Upload photo"
                          style={{ position: "absolute", bottom: 0, right: 0, width: "20px", height: "20px", borderRadius: "50%", background: "#0f4c3a", color: "white", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "10px" }}>
                          📷
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoSelect} />
                    </div>

                    {/* Name + role */}
                    <div style={{ paddingBottom: "4px" }}>
                      <div style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700, color: "var(--text-dark)", marginBottom: "3px" }}>{name}</div>
                      <span style={{ display: "inline-block", background: "#dcfce7", color: "#166534", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>User</span>
                    </div>
                  </div>

                  {/* Edit / Save / Cancel */}
                  <div style={{ display: "flex", gap: "8px", paddingBottom: "4px" }}>
                    {!editing ? (
                      <button className="btn-admin-secondary" style={{ padding: "7px 14px", fontSize: "13px" }} onClick={() => setEditing(true)}>
                        ✏️ Edit
                      </button>
                    ) : (
                      <>
                        <button className="btn-profile-save" onClick={handleSave} disabled={loading} style={{ padding: "7px 16px", fontSize: "13px", opacity: loading ? 0.7 : 1 }}>
                          {loading ? "Saving..." : "Save"}
                        </button>
                        <button className="btn-profile-cancel" onClick={handleCancel} disabled={loading} style={{ padding: "7px 14px", fontSize: "13px" }}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Photo upload bar */}
                {photoFile && (
                  <div style={{ margin: "0 24px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "13px" }}>📷</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#166534" }}>{photoFile.name}</div>
                      <div style={{ fontSize: "11px", color: "#4d7c60" }}>{(photoFile.size / 1024).toFixed(1)} KB · Preview shown above</div>
                    </div>
                    <button className="btn-profile-save" onClick={handlePhotoUpload} disabled={uploadingPhoto} style={{ padding: "5px 12px", fontSize: "12px", opacity: uploadingPhoto ? 0.7 : 1 }}>
                      {uploadingPhoto ? "Uploading..." : "Upload"}
                    </button>
                    <button className="btn-profile-cancel" onClick={handleCancelPhoto} disabled={uploadingPhoto} style={{ padding: "5px 10px", fontSize: "12px" }}>
                      Cancel
                    </button>
                  </div>
                )}

                {/* Errors */}
                {photoError && <div style={{ margin: "0 24px 10px" }}><div className="smp-error-msg">{photoError}</div></div>}
                {error      && <div style={{ margin: "0 24px 10px" }}><div className="smp-error-msg">{error}</div></div>}

                {/* ── Fields + Account info in one grid ── */}
                <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

                  {/* Full name */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Full name</label>
                    <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} disabled={!editing} placeholder="Your full name"
                      style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-dark)", background: editing ? "white" : "var(--bg)", outline: "none" }} />
                  </div>

                  {/* Email */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email address</label>
                    <input type="email" value={user?.email || ""} disabled
                      style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-mid)", background: "var(--bg)", outline: "none" }} />
                  </div>

                  {/* Mobile */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Mobile number {editing && <span style={{ color: "var(--text-light)", fontWeight: 400, textTransform: "none" }}>({mobile.length}/10)</span>}
                    </label>
                    <input type="tel" value={mobile}
                      onChange={(e) => { const val = e.target.value.replace(/\D/g, ""); if (val.length <= 10) { setMobile(val); setError(""); } }}
                      disabled={!editing} placeholder="e.g. 9876543210"
                      style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-dark)", background: editing ? "white" : "var(--bg)", outline: "none" }} />
                  </div>

                  {/* Role */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Account role</label>
                    <input value="User" disabled
                      style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-mid)", background: "var(--bg)", outline: "none" }} />
                  </div>

                  {/* Member since */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Member since</label>
                    <div style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-mid)", background: "var(--bg)" }}>
                      {formatDate(createdAt)}
                    </div>
                  </div>

                  {/* Last updated */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Last updated</label>
                    <div style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-mid)", background: "var(--bg)" }}>
                      {formatDateTime(updatedAt)}
                    </div>
                  </div>

                  {/* Email verified */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email verified</label>
                    <div style={{ padding: "8px 12px", border: "1.5px solid #bbf7d0", borderRadius: "8px", fontSize: "13px", color: "#166534", fontWeight: 600, background: "#f0fdf4" }}>
                      ✓ Verified
                    </div>
                  </div>

                  {/* Last login */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Last login</label>
                    <div style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-mid)", background: "var(--bg)" }}>
                      Today
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Profile;