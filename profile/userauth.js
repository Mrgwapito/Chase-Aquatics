// ================================================================
// 🌊 CHASE AQUATICS - USER AUTH HANDLER (DEFAULT COLOR + ACTIVE PAGE)
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 Auth Status Checker Loaded");

  const loginTrigger = document.getElementById("loginTrigger");
  const loginContainer = document.getElementById("loginContainer");

  // ✅ Get stored user info
  const token = localStorage.getItem("token");
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    console.warn("⚠️ Corrupted user data in localStorage.");
    user = null;
  }

  const isProfilePage = window.location.pathname.includes("/profile/profile.html");

  // ✅ Default icon color
  const defaultColor = "#335A02";
  const activeColor = "#2b4d02"; // slightly darker only for "active" page look

  // ✅ If logged in
  if (token && user) {
    // ✅ Ensure compatibility with new backend (handle first + last name)
    if (!user.fullName && (user.firstName || user.lastName)) {
      user.fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }

    console.log("✅ User logged in:", user.fullName || user.email);

    if (loginTrigger) {
      loginTrigger.classList.add("logged-in");
      loginTrigger.title = isProfilePage ? "Your Profile" : "Go to Profile";
      loginTrigger.style.color = isProfilePage ? activeColor : defaultColor;

      // Clicking the icon should open profile page (except if already there)
      loginTrigger.onclick = () => {
        if (!isProfilePage) window.location.href = "/profile/profile.html";
      };
    }

    if (loginContainer) loginContainer.style.display = "none"; // hide popup if logged in
  }

  // ✅ If not logged in
  else {
    console.log("⚠️ No active user session found.");
    if (loginTrigger) {
      loginTrigger.classList.remove("logged-in");
      loginTrigger.title = "Login";
      loginTrigger.style.color = defaultColor;

      loginTrigger.onclick = () => {
        const popup = document.getElementById("loginContainer");
        if (popup) popup.style.display = "block";
        else alert("⚠️ Login popup not found.");
      };
    }
  }
});
  