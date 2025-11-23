  // ================================================================
  // 🌊 CHASE AQUATICS - PROFILE SCRIPT (LOCALHOST/127.0.0.1 AUTO FIXED)
  // ================================================================

// ✅ Auto-detect backend URL (local + Render)
const BACKEND_URL =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:3000"                 // local dev
    : "https://chase-aquatics.onrender.com";  // deployed backend

// ✅ Helper: ayusin lahat ng path galing backend (old localhost + new uploads)
function resolveBackendImage(raw) {
  if (!raw) return "";
  let s = String(raw).trim();

  // Strip any old localhost base (http://localhost:3000 / 127.0.0.1:3000)
  s = s.replace(/^https?:\/\/(127\.0\.0\.1|localhost):\d+/i, "");

  // Kung CDN o full https URL na (ibang domain), hayaan na lang
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // Normal /uploads/... path → lagyan ng tamang BACKEND_URL
  return `${BACKEND_URL.replace(/\/+$/, "")}${s.startsWith("/") ? "" : "/"}${s}`;
}


/// --- Toast helper (toast-first, no alert UI)
let __lastTopToast = 0;

function notify({
  title = 'Notice',
  message = '',
  type = 'info',
  duration = 2200,
  position = 'top'
} = {}) {
  const now = Date.now();
  if (position !== 'br' && now - __lastTopToast < 1200) return;
  if (position !== 'br') __lastTopToast = now;

  const payload = { title, message, type, duration, position };

  // Debug so we can see what happens
  console.log('[notify]', payload, 'Toast?', !!(window.Toast && window.Toast.showToast));

  if (window.Toast && typeof window.Toast.showToast === 'function') {
    window.Toast.showToast(payload);
  } else {
    // ❗ NO alert here, we keep look consistent.
    // If you *really* want a debug popup while building, uncomment this line:
    // alert(`${title}\n${message}`);
  }
}



  // ======= Initialize EmailJS =======
  if (typeof emailjs !== "undefined") {
    emailjs.init("hhTpOoi07kd04LwsH");
  }

  // ======= DOM Elements =======
  const editBtn = document.getElementById("editProfileBtn");
  const saveBtn = document.getElementById("saveProfileBtn");
  const inputs = document.querySelectorAll(".edit-input");

  const emailOtpSection    = document.getElementById("profileEmailOtpSection");
  const sendEmailOtpBtn    = document.getElementById("profileSendEmailOtp");
  const verifyEmailOtpBtn  = document.getElementById("profileVerifyEmailOtp");
  const emailInput         = document.getElementById("emailInput");
  const emailOtpInput      = document.getElementById("profileEmailOtp");
  const emailTargetPreview = document.getElementById("profileEmailTarget");

  // ---- Valid ID UI ----
  const validIdFile     = document.getElementById('validIdFile');
  const submitValidIdBtn= document.getElementById('submitValidIdBtn');
  const validIdNote     = document.getElementById('validIdNote');
  const idVerifyBadge   = document.getElementById('idVerifyBadge');
  const idVerifyBadge2  = document.getElementById('idVerifyBadge2'); // legacy block (optional)


  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const changePasswordSection = document.getElementById("changePasswordSection");
  const savePasswordBtn = document.getElementById("savePasswordBtn");
  const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");

  // Shared header/subtext (show only on Profile)
  const profileHeader = document.querySelector('.card-body h3.mb-1');
  const profileSub    = document.querySelector('.card-body .text-muted.mb-4');

// Name fields
  const firstNameInput = document.getElementById("firstNameInput");
  const lastNameInput  = document.getElementById("lastNameInput");
  const fullNameComputed = document.getElementById("fullNameComputed");
  const usernameInput = document.getElementById("usernameInput"); // ✅ NEW
  const phoneInput = document.getElementById("phoneInput");

  // Address (cascading + manual ZIP)
  const addrLine1 = document.getElementById('addrLine1');
  const rSel = document.getElementById('addrRegion');
  const pSel = document.getElementById('addrProvince');
  const cSel = document.getElementById('addrCity');
  const bSel = document.getElementById('addrBrgy');
  const zInp = document.getElementById('addrZip');
  const saveAddressBtn = document.getElementById("saveAddressBtn");
  const editAddressBtn = document.getElementById("editAddressBtn");

  // 🔴 Clear red border once user starts fixing the postal code
  if (zInp) {
    zInp.addEventListener('input', () => {
      zInp.classList.remove('is-invalid');
    });
  }



  // Avatar
  let selectImageBtn = document.getElementById("selectImageBtn");
  let profileImageInput = document.getElementById("profileImageInput");
  const bigAvatar = document.querySelector(".big-avatar");

  // Right pane (avatar block; hidden on non-profile tabs)
  const rightPane = document.querySelector(".right-pane");

  // ======= Profile email-change OTP vars =======
  let generatedEmailOtp = null;
  let otpSent = false;
  let emailVerified = false;
  let originalEmail = ""; // assigned after profile load

  // ======= Change-Password: OTP + Meter refs =======
  const pwSendOtpBtn   = document.getElementById('pwSendOtpBtn');
  const pwVerifyOtpBtn = document.getElementById('pwVerifyOtpBtn');
  const pwOtpInput     = document.getElementById('pwOtpInput');
  const pwOtpStatus    = document.getElementById('pwOtpStatus');

  const pwInput        = document.getElementById('newPassword');
  const cpInput        = document.getElementById('confirmPassword');
  const pwMeterBar     = document.getElementById('pwMeterBar');
  const pwMeterLabel   = document.getElementById('pwMeterLabel');

  let pwOtpGenerated   = null;
  let pwOtpSent        = false;
  let pwEmailVerified  = false;

  // ======= Helpers =======
  function generateUserId() {
    const prefix = "USR";
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${randomNum}`;
  }

  function buildFullNamePreview() {
    const f = (firstNameInput?.value || "").trim();
    const l = (lastNameInput?.value || "").trim();
    const preview = l && f ? `${l}, ${f}` : (l || f || "");
    if (fullNameComputed) fullNameComputed.value = preview || "Auto-filled from Surname, First name";
  }

function forceRightAlign() {
    [firstNameInput, lastNameInput, usernameInput, phoneInput].forEach(el => { // ✅ added usernameInput
      if (el && !el.classList.contains("text-end-input")) {
        el.classList.add("text-end-input");
      }
    });
  }

  // Show avatar pane & shared header only on Profile tab
  function updateRightPaneForTab(targetSel) {
    const isProfile = targetSel === '#pane-profile';
    if (rightPane) rightPane.style.display = isProfile ? '' : 'none';
    if (profileHeader) profileHeader.style.display = isProfile ? '' : 'none';
    if (profileSub)    profileSub.style.display    = isProfile ? '' : 'none';

    const formCol = document.querySelector('.profile-shell .row .col-xl-8') 
                || document.querySelector('.profile-shell .row .col-xl-12');
    if (formCol) {
      if (isProfile) {
        formCol.classList.remove('col-xl-12');
        formCol.classList.add('col-xl-8');
      } else {
        formCol.classList.remove('col-xl-8');
        formCol.classList.add('col-xl-12');
      }
    }
  }

  function renderIdStatus(validId) {
    const s = (validId?.status || 'none').toLowerCase();
    const note = validId?.note || '';
    const fileUrl = validId?.path || '';

    const textMap = {
      approved: 'ID: Verified',
      pending : 'ID: Pending',
      rejected: 'ID: Declined',
      declined: 'ID: Declined',
      none    : 'ID: Not submitted'
    };
    const label = textMap[s] || 'ID: Not submitted';

    const apply = (el) => {
      if (!el) return;
      el.textContent = label;
      // keep your existing badge style classes; just toggle "subtle" for not-verified
      if (s === 'approved') el.classList.remove('subtle');
      else el.classList.add('subtle');
    };
    apply(idVerifyBadge);
    apply(idVerifyBadge2);

    if (validIdNote) {
      let msg = '';
      if (s === 'approved') {
        msg = `✅ Your Valid ID has been approved.`;
      } else if (s === 'pending') {
        msg = `⏳ Your Valid ID is under review.`;
      } else if (s === 'rejected' || s === 'declined') {
        msg = `⚠️ Your Valid ID was declined${note ? ` — Reason: ${note}` : ''}.`;
      } else {
        msg = `Upload a clear photo or PDF of a government/Student ID.`;
      }
      // link to last file if available
      if (fileUrl) {
        const href = resolveBackendImage(fileUrl);
        msg += ` <a href="${href}" target="_blank" rel="noopener">View last upload</a>`;
      }

      validIdNote.innerHTML = msg;
      validIdNote.hidden = false;
    }
  }

  async function submitValidId() {
    const token = localStorage.getItem('token');
if (!token) {
  notify({
    title: 'Not signed in',
    message: 'Please log in first.',
    type: 'error',
    duration: 5000,
    position: 'top'
  });

setTimeout(() => {
    window.location.href = "../index.html";
  }, 800);   // 👈 important so toast shows

  return;
}


    const f = validIdFile?.files?.[0];
    if (!f) {
      notify({ title:'No file', message:'Choose an image or PDF first.', type:'error', duration:5000, position:'top' });
      return;
    }

    // validate type + size (match backend filter + 8MB limit)
    const okType = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$|^application\/pdf$/i.test(f.type);
    if (!okType) {
      notify({ title:'Unsupported file', message:'Upload JPG, PNG, GIF, WEBP, BMP, SVG, or PDF.', type:'error', duration:6000, position:'top' });
      return;
    }
    const MAX = 8 * 1024 * 1024;
    if (f.size > MAX) {
      notify({ title:'Too large', message:'Max file size is 8MB.', type:'error', duration:6000, position:'top' });
      return;
    }

    const fd = new FormData();
    fd.append('validId', f);

    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/valid-id`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      notify({ title:'Submitted', message:'Your Valid ID is now pending review.', type:'success', duration:2200, position:'br' });
      validIdFile.value = '';
      renderIdStatus({ status:'pending', path:data.file || '' });
    } catch (e) {
      console.error(e);
      notify({ title:'Upload failed', message:String(e.message || e), type:'error', duration:6000, position:'top' });
    }
  }
  submitValidIdBtn?.addEventListener('click', submitValidId);


// ======= EDIT PROFILE =======
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      inputs.forEach((input) => (input.disabled = false));
      if (firstNameInput) firstNameInput.disabled = false;
      if (lastNameInput) lastNameInput.disabled = false;
      if (usernameInput) usernameInput.disabled = false; // ✅ NEW
      if (!emailVerified && emailInput) emailInput.disabled = false;

      if (firstNameInput) firstNameInput.addEventListener("input", buildFullNamePreview);
      if (lastNameInput)  lastNameInput.addEventListener("input", buildFullNamePreview);
      buildFullNamePreview();
      forceRightAlign();

      editBtn.classList.add('d-none');
      saveBtn.classList.remove('d-none');
      if (emailOtpSection) emailOtpSection.style.display = "block";
      
      notify({ 
        title: 'Edit mode', 
        message: 'You can now edit your profile fields.', 
        type: 'info', 
        duration: 2000, 
        position: 'br' 
      }); // ✅ NEW toast
    });
  }

  // ======= SAVE PROFILE =======
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        notify({ title: 'Session expired', message: 'Please log in again.', type: 'error', duration: 6000, position: 'top' });
        window.location.href = "../index.html";
        return;
      }

      if (emailInput && emailInput.value.trim() !== originalEmail.trim() && !emailVerified) {
        notify({ title: 'Verify email', message: 'You changed your email. Please verify it before saving.', type: 'error', duration: 6000, position: 'top' });
        return;
      }

const firstName = firstNameInput?.value.trim() || "";
      const lastName  = lastNameInput?.value.trim() || "";
      const username  = usernameInput?.value.trim() || ""; // ✅ NEW
      const fullName  = `${firstName} ${lastName}`.trim();

      const updatedData = {
        firstName,
        lastName,
        username, // ✅ NEW
        fullName,
        phone: phoneInput ? phoneInput.value.trim() : "",
        address: document.getElementById("addressInput")?.value?.trim?.() || "",
        gender: document.getElementById("genderInput")?.value?.trim?.() || "",
        birthday: document.getElementById("birthdayInput")?.value?.trim?.() || "",
      };

      try {
        const res = await fetch(`${BACKEND_URL}/api/update-profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedData),
        });

        let data;
        try { data = await res.json(); } 
        catch { throw new Error("Response is not JSON (check backend route)."); }

        if (!res.ok || !data.success) {
          notify({ title: 'Update failed', message: data.message || 'Server error.', type: 'error', duration: 6000, position: 'top' });
          return;
        }

        notify({ title: 'Profile updated', type: 'success', duration: 2200, position: 'br' });

        document.querySelector(".user-name").textContent =
          fullName || (lastName ? `${lastName}, ${firstName}` : firstName) || "New User";

        if (fullNameComputed) fullNameComputed.value =
          (lastName && firstName) ? `${lastName}, ${firstName}` :
          (lastName || firstName || "Auto-filled from Surname, First name");

inputs.forEach((input) => (input.disabled = true));
        if (firstNameInput) firstNameInput.disabled = true;
        if (lastNameInput)  lastNameInput.disabled  = true;
        if (usernameInput)  usernameInput.disabled  = true; // ✅ NEW
        if (emailInput)     emailInput.disabled     = true;

        editBtn.classList.remove('d-none');
        saveBtn.classList.add('d-none');
        if (emailOtpSection) emailOtpSection.style.display = "none";
        originalEmail = emailInput ? emailInput.value : originalEmail;
        forceRightAlign();
      } catch (err) {
        console.error("❌ Error updating profile:", err);
        notify({ title: 'Update failed', message: err.message, type: 'error', duration: 6000, position: 'top' });
      }
    });
  }

  // ======= SEND EMAIL OTP (profile email change) =======
  if (sendEmailOtpBtn) {
    sendEmailOtpBtn.addEventListener("click", () => {
      const userEmail = emailInput?.value?.trim?.() || "";
      const userName  = document.querySelector(".user-name")?.textContent || "User";

      if (!userEmail) {
        notify({ title: 'Missing email', message: 'Enter your email before sending an OTP.', type: 'error', duration: 5000, position: 'top' });
        return;
      }

      generatedEmailOtp = Math.floor(100000 + Math.random() * 900000);
      otpSent = true;
      emailVerified = false;

      if (emailTargetPreview) emailTargetPreview.textContent = userEmail;

      emailjs.send("service_2bfbogr", "template_bcfsv7i", {
        to_email: userEmail,
        name: userName,
        otp_code: generatedEmailOtp,
        time: new Date().toLocaleString(),
        message: `Your OTP for Life in a Box: ${generatedEmailOtp}`,
      })
      .then(() => {
        notify({ title: 'OTP sent', message: `We sent a code to ${userEmail}.`, type: 'info', duration: 5000, position: 'top' });
        console.log("Profile Email OTP:", generatedEmailOtp);
        // show OTP section if hidden
        if (emailOtpSection) emailOtpSection.hidden = false;
        verifyEmailOtpBtn?.removeAttribute('disabled');
        emailOtpInput?.focus();
      })
      .catch((err) => {
        console.error("EmailJS Error:", err);
        notify({ title: 'Send failed', message: 'Could not send OTP. Please try again.', type: 'error', duration: 6000, position: 'top' });
      });
    });
  }


  if (verifyEmailOtpBtn) {
    verifyEmailOtpBtn.addEventListener("click", () => {
      if (!otpSent) {
        notify({ title: 'No OTP yet', message: 'Please send the OTP first.', type: 'error', duration: 5000, position: 'top' });
        return;
      }
      const enteredOtp = (emailOtpInput?.value || '').trim();
      if (enteredOtp === String(generatedEmailOtp)) {
        emailVerified = true;
        otpSent = false;
        notify({ title: 'Email verified', type: 'success', duration: 2200, position: 'br' });
        emailInput && (emailInput.disabled = true);
        emailOtpInput && (emailOtpInput.value = "");
        // Optional: hide the inline OTP section after success
        emailOtpSection && (emailOtpSection.hidden = true);
      } else {
        emailVerified = false;
        notify({ title: 'Invalid OTP', message: 'Please try again.', type: 'error', duration: 6000, position: 'top' });
      }
    });
  }


  // ======= Change Password – strength meter =======
  function scorePassword(pw){
    let score = 0;
    if (!pw) return 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;

    const variety = [
      /[a-z]/.test(pw),
      /[A-Z]/.test(pw),
      /\d/.test(pw),
      /[^A-Za-z0-9]/.test(pw)
    ].filter(Boolean).length;
    if (variety >= 2) score++;
    if (variety >= 3) score++;

    return Math.max(0, Math.min(4, score));
  }
  function strengthToUI(score){
    const map = [
      { pct: 12,  color: '#dc3545', label: 'Very weak' },
      { pct: 35,  color: '#fd7e14', label: 'Weak' },
      { pct: 62,  color: '#0d6efd', label: 'Good' },
      { pct: 85,  color: '#198754', label: 'Strong' },
      { pct: 100, color: '#157347', label: 'Very strong' }
    ];
    return map[score];
  }
  function updatePwMeter(){
    const val   = pwInput?.value || '';
    const score = scorePassword(val);
    const ui    = strengthToUI(score);

    if (pwMeterBar){
      pwMeterBar.style.width = ui.pct + '%';
      pwMeterBar.style.backgroundColor = ui.color;
    }
    if (pwMeterLabel){
      pwMeterLabel.textContent = val
        ? (val.length < 8 ? 'Must be at least 8 characters' : ui.label)
        : 'Enter a strong password (min 8 chars)';
    }

    if (cpInput){
      const match = cpInput.value && cpInput.value === val;
      cpInput.classList.toggle('is-valid', !!match);
      cpInput.classList.toggle('is-invalid', !match && cpInput.value.length>0);
    }

    gateSavePassword();
  }
  pwInput?.addEventListener('input', updatePwMeter);
  cpInput?.addEventListener('input', updatePwMeter);

  // ======= Change Password – OTP send/verify =======
  function gateSavePassword(){
    const passOk = pwInput.value.length >= 8 && pwInput.value === cpInput.value;
    const canSave = pwEmailVerified && passOk;
    savePasswordBtn?.toggleAttribute('disabled', !canSave);
  }

  // palette-consistent status badge
  function showPwStatus(text, style){ // 'sent' | 'ok' | 'bad'
    const el = pwOtpStatus;
    if(!el) return;
    el.classList.remove('d-none');
    el.textContent = text;
    el.removeAttribute('style');
    el.className = 'badge badge-soft align-self-center';
    if(style==='ok'){ el.style.background='#d1e7dd'; el.style.color='#0f5132'; el.style.borderColor='#0f5132'; }
    if(style==='bad'){ el.style.background='#f8d7da'; el.style.color='#842029'; el.style.borderColor='#842029'; }
  }

  pwSendOtpBtn?.addEventListener('click', () => {
    const userEmail = document.getElementById('emailInput')?.value?.trim?.() || '';
    const userName  = document.querySelector('.user-name')?.textContent || 'User';
    if (!userEmail) {
      notify({ title:'Missing email', message:'Your account email is empty.', type:'error', duration:5000, position:'top' });
      return;
    }

    pwOtpGenerated = Math.floor(100000 + Math.random() * 900000);
    pwOtpSent      = true;
    pwEmailVerified = false;

    pwOtpInput.removeAttribute('disabled');
    pwVerifyOtpBtn.removeAttribute('disabled');
    showPwStatus('Code sent','sent');

    emailjs.send("service_2bfbogr", "template_bcfsv7i", {
      to_email: userEmail,
      name: userName,
      otp_code: pwOtpGenerated,
      time: new Date().toLocaleString(),
      message: `Your Life in a Box password change code: ${pwOtpGenerated}`,
    })
    .then(() => {
      notify({ title:'OTP sent', message:`We sent a code to ${userEmail}.`, type:'info', duration:5000, position:'top' });
      console.log('PW OTP:', pwOtpGenerated);
    })
    .catch(err => {
      console.error('EmailJS Error:', err);
      notify({ title:'Send failed', message:'Could not send OTP. Try again.', type:'error', duration:6000, position:'top' });
    });
  });

  pwVerifyOtpBtn?.addEventListener('click', () => {
    if (!pwOtpSent) {
      notify({ title:'No OTP yet', message:'Send the code first.', type:'error', duration:5000, position:'top' });
      return;
    }
    const entered = (pwOtpInput.value || '').trim();
    if (entered === String(pwOtpGenerated)) {
      pwEmailVerified = true;
      showPwStatus('Verified','ok');
      pwOtpInput.value = '';
      pwOtpInput.setAttribute('disabled','');
      pwVerifyOtpBtn.setAttribute('disabled','');
      notify({ title:'Email verified', type:'success', duration:2000, position:'br' });
    } else {
      pwEmailVerified = false;
      showPwStatus('Invalid code','bad');
      notify({ title:'Invalid OTP', message:'Please try again.', type:'error', duration:6000, position:'top' });
    }
    gateSavePassword();
  });

  // ======= CHANGE PASSWORD submit =======
  if (savePasswordBtn) {
    savePasswordBtn.addEventListener("click", async () => {
      const newPassword = pwInput?.value?.trim?.() || "";
      const confirmPassword = cpInput?.value?.trim?.() || "";

      if (!pwEmailVerified) {
        notify({ title:'Verify email', message:'Please verify the email code first.', type:'error', duration:5000, position:'top' });
        return;
      }
      if (!newPassword || !confirmPassword) {
        notify({ title: 'Missing info', message: 'Fill out both password fields.', type: 'error', duration: 5000, position: 'top' });
        return;
      }
      if (newPassword.length < 8) {
        notify({ title: 'Weak password', message: 'Minimum 8 characters.', type: 'error', duration: 5000, position: 'top' });
        return;
      }
      if (newPassword !== confirmPassword) {
        notify({ title: 'Passwords do not match', type: 'error', duration: 5000, position: 'top' });
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${BACKEND_URL}/api/change-password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword }),
        });

        let data;
        try { data = await response.json(); }
        catch { throw new Error("Response is not JSON (check backend route)."); }

        if (data.success) {
          notify({ title: 'Password updated', type: 'success', duration: 2200, position: 'br' });
          pwInput.value = '';
          cpInput.value = '';
          updatePwMeter();
          // reset OTP gate
          pwEmailVerified = false;
          pwOtpSent = false;
          pwOtpGenerated = null;
          pwOtpInput.value = '';
          pwOtpInput.setAttribute('disabled','');
          pwVerifyOtpBtn.setAttribute('disabled','');
          pwOtpStatus.classList.add('d-none');
          pwOtpStatus.textContent = '';
          pwOtpStatus.removeAttribute('style');
          savePasswordBtn.setAttribute('disabled','');
        } else {
          notify({ title: 'Update failed', message: data.message || 'Unable to update password.', type: 'error', duration: 6000, position: 'top' });
        }
      } catch (err) {
        console.error("Error updating password:", err);
        notify({ title: 'Update failed', message: err.message, type: 'error', duration: 6000, position: 'top' });
      }
    });
  }

  if (cancelPasswordBtn) {
    cancelPasswordBtn.addEventListener("click", () => {
      pwInput.value = '';
      cpInput.value = '';
      updatePwMeter();
    });
  }

  function setSelectValueLoose(sel, desired) {
    if (!sel || !desired) return false;
    const want = String(desired).trim().toLowerCase();

    // 1) try exact value match (fast path)
    sel.value = desired;
    if (sel.value === desired) return true;

    // 2) try case-insensitive match against option.value and option.text
    let matched = null;
    for (const opt of sel.options) {
      if (!opt.value) continue; // skip placeholder
      const val = String(opt.value).trim().toLowerCase();
      const txt = String(opt.text).trim().toLowerCase();
      if (val === want || txt === want) { matched = opt.value; break; }
    }
    if (matched) {
      sel.value = matched;
      return true;
    }

    // 3) last resort: inject the saved value so the UI reflects what's in DB
    const o = document.createElement('option');
    o.value = desired;
    o.textContent = desired;
    sel.appendChild(o);
    sel.value = desired;
    return true;
  }

  function applySavedAddressFromUser(user) {
    if (!user) return;

    if (addrLine1) addrLine1.value = user.addressLine1 || '';
    if (zInp) zInp.value = user.postalCode || '';

    // Region -> Province -> City -> Barangay (dispatch change to populate the next select)
    if (rSel && user.region) {
      setSelectValueLoose(rSel, user.region);
      rSel.dispatchEvent(new Event('change'));
    }
    if (pSel && user.province) {
      setSelectValueLoose(pSel, user.province);
      pSel.dispatchEvent(new Event('change'));
    }
    if (cSel && user.city) {
      setSelectValueLoose(cSel, user.city);
      cSel.dispatchEvent(new Event('change'));
    }
if (bSel && user.barangay) {
  setSelectValueLoose(bSel, user.barangay);
  // keep custom dropdown label in sync after programmatic set
  bSel.dispatchEvent(new Event('change'));
}

  }


  // ======= LOAD USER PROFILE =======
  (async function loadProfile() {
    const token = localStorage.getItem("token");
 if (!token) {
  notify({
    title: 'Not signed in',
    message: 'Please log in first.',
    type: 'error',
    duration: 5000,
    position: 'top'
  });

  window.location.href = "../index.html";
  return;
}


    try {
      const res = await fetch(`${BACKEND_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let data;
      try { data = await res.json(); }
      catch { throw new Error("Response is not JSON (check backend /api/profile)."); }

      if (!res.ok || !data.success) {
        notify({ title: 'Session expired', message: 'Please log in again.', type: 'error', duration: 6000, position: 'top' });
        localStorage.removeItem("token");
        window.location.href = "../index.html";
        return;
      }

      const user = data.user;

      // --- basic profile fields
      const uiName = user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "New User";
      const nameEl = document.querySelector(".user-name");
      if (nameEl) nameEl.textContent = uiName;

      if (firstNameInput) firstNameInput.value = user.firstName || "";
      if (lastNameInput)  lastNameInput.value  = user.lastName  || "";
      if (usernameInput)  usernameInput.value  = user.username  || "";

      const emailEl = document.getElementById("emailInput");
      if (emailEl) emailEl.value = user.email || "";

      const userIdEl = document.getElementById("userIdValue");
      if (userIdEl) userIdEl.textContent = user.userId || generateUserId();

      if (phoneInput) phoneInput.value = user.phone || "";

      originalEmail = user.email || "";

      // --- avatar image (use saved profileImage if present)
      if (bigAvatar) {
        const initialsEl = bigAvatar.querySelector('.big-initials');
        const raw = (user.profileImage || '').trim();

        if (raw) {
          const imgUrl = resolveBackendImage(raw);

          bigAvatar.style.backgroundImage    = `url('${imgUrl}')`;
          bigAvatar.style.backgroundSize     = 'cover';
          bigAvatar.style.backgroundPosition = 'center';
          bigAvatar.style.backgroundColor    = 'transparent';
          if (initialsEl) initialsEl.style.opacity = '0';
        } else {
          bigAvatar.style.removeProperty('background-image');
          bigAvatar.style.removeProperty('background-size');
          bigAvatar.style.removeProperty('background-position');
          if (initialsEl) initialsEl.style.opacity = '1';
        }
      }

      // Valid ID badge/note (status: none | pending | approved | rejected/declined)
      renderIdStatus(user.validId || null);

      buildFullNamePreview();
      forceRightAlign();
      updateRightPaneForTab('#pane-profile');
      updatePwMeter();

      // ⚠️ IMPORTANT: finish building the Region/Province/City options first…
      await initPHAddress();
      applySavedAddressFromUser(user);



    } catch (err) {
      console.error("Profile load error:", err);

    }
  })();


  // ======= NAV TOGGLE =======
  const toggleBtn = document.querySelector(".nav-toggle");
  const navlinks = document.getElementById("navlinks");
  if (toggleBtn && navlinks) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = navlinks.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // ======= LOGOUT FUNCTION =======
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      let confirmLogout;
      if (window.Toast?.confirmToast) {
        confirmLogout = await window.Toast.confirmToast({
          title: 'Log out?',
          message: 'Are you sure you want to log out?',
          okText: 'Log out',
          cancelText: 'Stay signed in',
          type: 'error'
        });
      } else {
        confirmLogout = confirm("Are you sure you want to log out?");
      }

      if (confirmLogout) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("isLoggedIn");
        sessionStorage.clear();
        notify({ title: 'Logged out', message: 'See you next time 👋', type: 'info', duration: 2200, position: 'br' });
        window.location.href = "../index.html";
      }
    });
  }

  /* =======================================================================
    🇵🇭 PH Address Loader — reads /assets/ph-geo.json
    JSON shape:
    {
      "regions":[
        {"code":"IV-A","name":"Region IV-A (CALABARZON)","provinces":[
          {"name":"Cavite","cities":[
            {"name":"Silang","zip":"4118","barangays":["...","..."]}
          ]}
        ]}
      ]
    }
    ======================================================================= */
  const FALLBACK_DATA = {
    regions:[{
      code:"IV-A",
      name:"Region IV-A (CALABARZON)",
      provinces:[{
        name:"Cavite",
        cities:[
          {name:"Carmona",zip:"4116",barangays:["Mabuhay","Maduya","Barangay 1 Poblacion","Barangay 2 Poblacion","Barangay 3 Poblacion","Barangay 4 Poblacion","Barangay 5 Poblacion","Barangay 6 Poblacion","Barangay 7 Poblacion","Barangay 8 Poblacion"]},
          {name:"Silang",zip:"4118",barangays:["Puting Kahoy","Balite","Banaba","Biga","Bulihan","Hoyo","Iba","Kalubkob","Litlit","Malabag","Mataas na Burol","Pooc","Sabutan","San Miguel I","San Miguel II","San Vicente I","San Vicente II","Tartaria"]}
        ]
      }]
    }]
  };

  let PH_FULL = null;

  async function loadPHGeo() {
    // Try backend static → backend API → same-origin static → fallback
    const candidates = [
      `${BACKEND_URL}/assets/ph-geo.json`,
      `${BACKEND_URL}/api/ph-geo`,
      `/assets/ph-geo.json`
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.regions?.length) throw new Error('empty payload');
        PH_FULL = data;
        console.log(`PH Geo loaded from: ${url}`);
        return;
      } catch (e) {
        console.warn('PH Geo source failed:', e.message || e, '→ trying next…');
      }
    }

    // Final fallback
    PH_FULL = FALLBACK_DATA;
    console.log('PH Geo loaded: FALLBACK (Cavite)');
  }


  function fillOptions(sel, arr, placeholder='Select...'){
    sel.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    sel.appendChild(opt);

    (arr || []).forEach(v => {
      const o = document.createElement('option');
      if (typeof v === 'string') {
        o.value = v;
        o.textContent = v;
      } else {
        // support { value, label }
        o.value = v.value;
        o.textContent = v.label;
      }
      sel.appendChild(o);
    });
  }

  // Map PSGC region codes (9-digit) to roman labels
  function psgcToRomanRegion(code9) {
    const m = {
      '010000000': 'I',
      '020000000': 'II',
      '030000000': 'III',
      '040000000': 'IV-A',   // CALABARZON
      '170000000': 'IV-B',   // MIMAROPA
      '050000000': 'V',
      '060000000': 'VI',
      '070000000': 'VII',
      '080000000': 'VIII',
      '090000000': 'IX',
      '100000000': 'X',
      '110000000': 'XI',
      '120000000': 'XII',
      '160000000': 'XIII',
      '130000000': 'NCR',
      '140000000': 'CAR',
      '150000000': 'BARMM'
    };
    return m[String(code9)] || (String(code9) || '').toUpperCase();
  }
  function regionLabel(r) {
    const rawCode = r.code || '';
    const upperCode = String(rawCode).toUpperCase();
    const roman = ['NCR','CAR','BARMM'].includes(upperCode)
      ? upperCode
      : psgcToRomanRegion(rawCode); // I, II, IV-A, ...

    // Full uppercase names for special regions
    const SPECIAL_FULL = {
      NCR:   'NATIONAL CAPITAL REGION',
      CAR:   'CORDILLERA ADMINISTRATIVE REGION',
      BARMM: 'BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO'
    };

    if (SPECIAL_FULL[roman]) {
      // e.g. "NCR (NATIONAL CAPITAL REGION)"
      return `${roman} (${SPECIAL_FULL[roman]})`;
    }

    // For standard regions, force EVERYTHING uppercase
    const nameUP = (r.name || '').toUpperCase();
    return `REGION ${roman} (${nameUP})`;
  }

// 🔒 Limit dropdown to Luzon regions only (front-end safety)
const LUZON_REGION_CODES_FRONT = new Set([
  '010000000', // Region I - Ilocos
  '020000000', // Region II - Cagayan Valley
  '030000000', // Region III - Central Luzon
  '040000000', // Region IV-A - CALABARZON
  '050000000', // Region V - Bicol
  '130000000', // NCR
  '140000000', // CAR
  '170000000'  // Region IV-B - MIMAROPA
]);

function regionsList() {
  const list = (PH_FULL?.regions || [])
    .filter(r => {
      const code = String(r.code || '').trim();

      // If code is NOT a 9-digit PSGC code (like the fallback "IV-A"),
      // don't filter it out (still allow it).
      if (!code || code.length !== 9) return true;

      // For PSGC-style codes, only keep Luzon regions
      return LUZON_REGION_CODES_FRONT.has(code);
    })
    .map(r => ({
      value: r.name,                 // keep using the NAME as the <option> value
      label: regionLabel(r),
      _orderKey: psgcToRomanRegion(r.code)
    }));

  const ORDER = ['I','II','III','IV-A','IV-B','V','VI','VII','VIII','IX','X','XI','XII','XIII','NCR','CAR','BARMM'];
  const idx = k => {
    const i = ORDER.indexOf(String(k).toUpperCase());
    return i === -1 ? 999 : i;
  };

  list.sort((a, b) => idx(a._orderKey) - idx(b._orderKey));
  return list.map(({ value, label }) => ({ value, label }));
}



  function provincesFor(regionName){
    const reg = (PH_FULL?.regions||[]).find(r=>r.name===regionName);
    return reg ? (reg.provinces||[]).map(p=>p.name) : [];
  }
  function citiesFor(regionName, provinceName){
    const reg = (PH_FULL?.regions||[]).find(r=>r.name===regionName);
    const prov = reg?.provinces?.find(p=>p.name===provinceName);
    return prov ? (prov.cities||[]).map(c=>c.name) : [];
  }
  function barangaysFor(regionName, provinceName, cityName){
    const reg = (PH_FULL?.regions||[]).find(r=>r.name===regionName);
    const prov = reg?.provinces?.find(p=>p.name===provinceName);
    const city = prov?.cities?.find(c=>c.name===cityName);
    return city?.barangays || [];
  }
  // Not used (ZIP is manual), but kept for future use.
  function zipFor(regionName, provinceName, cityName){
    const reg = (PH_FULL?.regions||[]).find(r=>r.name===regionName);
    const prov = reg?.provinces?.find(p=>p.name===provinceName);
    const city = prov?.cities?.find(c=>c.name===cityName);
    return city?.zip || '';
  }



  async function initPHAddress(){
    await loadPHGeo();
    if (!rSel) return;

    fillOptions(rSel, regionsList(), 'Select Region');

    // Optional: default to CALABARZON if present
    const calabarzon = "Region IV-A (CALABARZON)";
    if ([...rSel.options].some(o=>o.value===calabarzon)) {
      rSel.value = calabarzon;
    }
    rSel.dispatchEvent(new Event('change'));
  }

  rSel?.addEventListener('change', ()=>{
    const regionName = rSel.value;
    fillOptions(pSel, provincesFor(regionName), 'Select Province');
    fillOptions(cSel, [], 'Select City/Municipality');
    fillOptions(bSel, [], 'Select Barangay');
    if (zInp) zInp.value = ''; // ZIP is manual
  });

  pSel?.addEventListener('change', ()=>{
    const regionName = rSel.value;
    const prov = pSel.value;
    fillOptions(cSel, citiesFor(regionName, prov), 'Select City/Municipality');
    fillOptions(bSel, [], 'Select Barangay');
    if (zInp) zInp.value = ''; // ZIP is manual
  });

  cSel?.addEventListener('change', ()=>{
    const regionName = rSel.value;
    const prov = pSel.value;
    const city = cSel.value;

    const brgys = barangaysFor(regionName, prov, city);
    fillOptions(bSel, brgys, 'Select Barangay');

    if (!brgys || brgys.length === 0) {
      console.warn('[Address] No barangays found for:', { regionName, prov, city });
    }
  });


  function enhanceAll(){ [rSel, pSel, cSel, bSel].forEach(enhanceSelect); }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceAll);
} else {
  enhanceAll();
}


  // ---------- Custom dropdown: enhances native <select> with your .cs-* styles ----------
  function enhanceSelect(sel){
    if (!sel || sel.dataset.cs === 'on') return;
    sel.dataset.cs = 'on';

    const wrap = document.createElement('div');
    wrap.className = 'cs-wrap';
    sel.classList.add('cs-hidden');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cs-selected';
    btn.setAttribute('aria-haspopup','listbox');
    btn.setAttribute('aria-expanded','false');

    const labelSpan = document.createElement('span');
    labelSpan.textContent = sel.options[sel.selectedIndex]?.text || sel.options[0]?.text || 'Select';
    const caret = document.createElement('span'); caret.className = 'cs-caret';
    btn.appendChild(labelSpan); btn.appendChild(caret);
    wrap.appendChild(btn);

    const panel = document.createElement('div'); panel.className = 'cs-panel'; panel.hidden = true;
    const search = document.createElement('input'); search.type='text'; search.className='cs-search'; search.placeholder='Search...';
    const list = document.createElement('div'); list.className='cs-list';
    panel.appendChild(search); panel.appendChild(list); wrap.appendChild(panel);

    function buildItems(filter=''){
      list.innerHTML = '';
      const q = filter.trim().toLowerCase();
      Array.from(sel.options).forEach(opt=>{
        const txt = (opt.text||'').trim(); const val = opt.value;
        if (q && !txt.toLowerCase().includes(q)) return;

        const item = document.createElement('div');
        item.className='cs-item'; item.setAttribute('role','option');
        item.dataset.value=val; item.textContent = txt || '—';
        if (val === '') item.style.opacity='.6';
        if (val === sel.value) item.setAttribute('aria-selected','true');
        item.addEventListener('click', ()=>{
          sel.value = val; sel.dispatchEvent(new Event('change'));
          labelSpan.textContent = txt || 'Select'; close();
        });
        list.appendChild(item);
      });
    }
    buildItems();

    function open(){ if(sel.disabled) return;
      panel.hidden=false; btn.setAttribute('aria-expanded','true');
      search.value=''; buildItems(); setTimeout(()=>search.focus(),0);
      document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey);
    }
    function close(){
      panel.hidden=true; btn.setAttribute('aria-expanded','false');
      document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey);
      btn.focus();
    }
    function onDoc(e){ if(!wrap.contains(e.target)) close(); }
    function onKey(e){
      if(e.key==='Escape'){ e.preventDefault(); close(); }
      if((e.key==='ArrowDown'||e.key==='ArrowUp') && !panel.hidden){
        e.preventDefault();
        const items=[...list.querySelectorAll('.cs-item')];
        const cur=items.findIndex(i=>i.getAttribute('aria-selected')==='true');
        let next=e.key==='ArrowDown'?cur+1:cur-1; next=Math.max(0,Math.min(items.length-1,next));
        items.forEach(i=>i.removeAttribute('aria-selected'));
        if(items[next]){ items[next].setAttribute('aria-selected','true'); items[next].scrollIntoView({block:'nearest'}); }
      }
      if(e.key==='Enter' && !panel.hidden){
        e.preventDefault();
        (list.querySelector('.cs-item[aria-selected="true"]')||list.querySelector('.cs-item'))?.click();
      }
    }

    btn.addEventListener('click', ()=> panel.hidden ? open() : close());
    search.addEventListener('input', e=> buildItems(e.target.value));

    // keep disabled in sync
    const mo = new MutationObserver(()=> {
      btn.toggleAttribute('disabled', sel.disabled);
      if (sel.disabled && !panel.hidden) close();
    });
    mo.observe(sel, { attributes:true, attributeFilter:['disabled'] });

    sel.addEventListener('change', ()=>{
      const opt = sel.options[sel.selectedIndex];
      labelSpan.textContent = opt ? opt.text : 'Select';
    });
  }

  // ===== Address: enable fields when clicking "Edit" =====
editAddressBtn?.addEventListener('click', () => {
  // enable all address inputs
  [addrLine1, rSel, pSel, cSel, bSel, zInp].forEach(el => {
    if (el) el.disabled = false;
  });

  // show Save, hide Edit while in edit mode
  saveAddressBtn?.classList.remove('d-none');
  editAddressBtn.classList.add('d-none');
});


  // ======= Save Address (structured + single string for backward-compat) =======
  saveAddressBtn?.addEventListener('click', async ()=>{
    const token = localStorage.getItem("token");
    if (!token) {
      notify({ title:'Session expired', message:'Please log in again.', type:'error', duration:6000, position:'top' });
      window.location.href="../index.html"; return;
    }

    const line1 = (addrLine1?.value || '').trim();
    const region = (rSel?.value || '').trim();
    const province = (pSel?.value || '').trim();
    const city = (cSel?.value || '').trim();
    const barangay = (bSel?.value || '').trim();
    const zip = (zInp?.value || '').trim();

    // Required: all fields must be present
    if (!line1) { notify({ title:'Missing address', message:'Please enter your house/building/street.', type:'error', duration:5000, position:'top' }); addrLine1?.focus(); return; }
    if (!region) { notify({ title:'Missing region', message:'Please select a Region.', type:'error', duration:5000, position:'top' }); rSel?.focus(); return; }
    if (!province){ notify({ title:'Missing province', message:'Please select a Province.', type:'error', duration:5000, position:'top' }); pSel?.focus(); return; }
    if (!city) { notify({ title:'Missing city/municipality', message:'Please select a City/Municipality.', type:'error', duration:5000, position:'top' }); cSel?.focus(); return; }
    if (!barangay){ notify({ title:'Missing barangay', message:'Please select a Barangay.', type:'error', duration:5000, position:'top' }); bSel?.focus(); return; }

    // Clear previous error state on every save attempt
    if (zInp) {
      zInp.classList.remove('is-invalid');
    }

    // Postal code MUST be exactly 4 digits
    if (!/^\d{4}$/.test(zip)) {
      if (zInp) {
        zInp.classList.add('is-invalid');  // 🔴 red border (Bootstrap .is-invalid)
      }
      notify({
        title: 'Check postal code',
        message: 'Postal code must be exactly 4 digits (e.g., 1000).',
        type: 'error',
        duration: 6000,
        position: 'top'
      });
      zInp?.focus();
      return;
    }


    const payload = {
      addressLine1: line1,
      region, province, city, barangay,
      postalCode: zip
    };
    payload.address = [
      payload.addressLine1,
      payload.barangay,
      payload.city,
      payload.province,
      payload.region,
      `PH ${payload.postalCode}`
    ].filter(Boolean).join(', ');

    try{
      const res = await fetch(`${BACKEND_URL}/api/update-profile`, {
        method:'PUT',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body:JSON.stringify(payload)
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.success){
        notify({ title:'Save failed', message:data.message || 'Server error.', type:'error', duration:6000, position:'top' });
        return;
      }
notify({ title:'Address saved', message:'Your shipping address has been updated.', type:'success', duration:2200, position:'br' }); // ✅ improved message
      [addrLine1,rSel,pSel,cSel,bSel,zInp].forEach(el=>el && (el.disabled=true));
      
      // ✅ NEW: Also disable the edit mode visually
      const editAddressBtn = document.getElementById('editAddressBtn');
      const saveAddressBtn = document.getElementById('saveAddressBtn');
      if (editAddressBtn) editAddressBtn.classList.remove('d-none');
      if (saveAddressBtn) saveAddressBtn.classList.add('d-none');
      
    }catch(err){
      console.error(err);
      notify({ title:'Save failed', message:err.message, type:'error', duration:6000, position:'top' });
    }
  });


  /* =======================================================================
    Tabs: pure-JS switcher + enable address inputs + toggle right pane
    ======================================================================= */
  function switchTab(targetSel) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show', 'active'));
    const pane = document.querySelector(targetSel);
    if (pane) pane.classList.add('show', 'active');

if (targetSel === '#pane-address') {
      // ✅ Don't auto-enable fields - let user click Edit button
      // [addrLine1,rSel,pSel,cSel,bSel,zInp].forEach(el=>el && (el.disabled=false));
      
      // ✅ Show edit button, hide save button initially
      const editAddressBtn = document.getElementById('editAddressBtn');
      const saveAddressBtn = document.getElementById('saveAddressBtn');
      if (editAddressBtn) editAddressBtn.classList.remove('d-none');
      if (saveAddressBtn) saveAddressBtn.classList.add('d-none');
    }

    if (targetSel === '#pane-security') {
      pwEmailVerified = false;
      pwOtpSent = false;
      pwOtpGenerated = null;
      pwOtpInput.value = '';
      pwOtpInput.setAttribute('disabled','');
      pwVerifyOtpBtn.setAttribute('disabled','');
      pwOtpStatus.classList.add('d-none');
      pwOtpStatus.textContent = '';
      pwOtpStatus.removeAttribute('style');
      savePasswordBtn?.setAttribute('disabled','');
      updatePwMeter();
    }

    updateRightPaneForTab(targetSel);
  }

  document.querySelectorAll('.side-link').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSel = btn.getAttribute('data-bs-target');
      if (!targetSel) return;

      document.querySelectorAll('.side-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      switchTab(targetSel);
    });
  });

  // ======= Image select/upload =======
  if (!selectImageBtn) {
    const guessBtn = document.querySelector('.right-pane .btn.btn-outline-brand, .right-pane .btn.btn-outline-primary');
    if (guessBtn) selectImageBtn = guessBtn;
  }
  if (!profileImageInput) {
    profileImageInput = document.createElement('input');
    profileImageInput.type = 'file';
    profileImageInput.accept = 'image/*';
    profileImageInput.id = 'profileImageInput';
    profileImageInput.hidden = true;
    document.body.appendChild(profileImageInput);
  }

  if (selectImageBtn && profileImageInput) {
    selectImageBtn.addEventListener('click', () => profileImageInput.click());
    profileImageInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const url = URL.createObjectURL(file);
        if (bigAvatar) {
          bigAvatar.style.backgroundImage = `url('${url}')`;
          bigAvatar.style.backgroundSize = 'cover';
          bigAvatar.style.backgroundPosition = 'center';
        }
      } catch {}

const token = localStorage.getItem('token');
if (!token) {
  notify({
    title: 'Not signed in',
    message: 'Please log in first.',
    type: 'error',
    duration: 5000,
    position: 'top'
  });

  setTimeout(() => {
    window.location.href = "../index.html";
  }, 600);

  return;
}




      const fd = new FormData();
      fd.append('image', file);

try {
        const res = await fetch(`${BACKEND_URL}/api/profile-image`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          notify({ title:'Upload failed', message:data.message || 'Server error.', type:'error', duration:6000, position:'top' });
          return;
        }
        
        notify({ title:'Profile image updated', message:'Your new photo is now visible!', type:'success', duration:2200, position:'br' }); // ✅ improved message
        
        // ✅ Refresh navbar avatar to show new profile image
        if (typeof window.refreshNavAvatar === 'function') {
          // Update user object in storage with new image URL
          try {
            const updatedUser = data.user || {};
            if (updatedUser && data.imageUrl) {
              updatedUser.profileImage = data.imageUrl; // ✅ ensure we have the new image URL
            }
            
            // Update both storage locations
            const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
            const merged = { ...storedUser, ...updatedUser };
            
            localStorage.setItem('user', JSON.stringify(merged));
            sessionStorage.setItem('user', JSON.stringify(merged));
          } catch (e) {
            console.warn('Failed to update user in storage:', e);
          }
          
          // Refresh the navbar avatar (this should now show the new image)
          setTimeout(() => window.refreshNavAvatar(), 100);
        }
        
      } catch (err) {
        console.error(err);
        notify({ title:'Upload failed', message:err.message, type:'error', duration:6000, position:'top' });
      }
    });
  }


  