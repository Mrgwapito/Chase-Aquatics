document.getElementById('signInBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        // Check if the response is JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const textResponse = await res.text(); // Get raw response as text
            console.log('Response is not JSON:', textResponse); // Log the raw response
            alert(`Unexpected response: ${textResponse}`);
            return;
        }

        const data = await res.json(); // Parse JSON response

        if (data.success) {
            alert('Login successful!');
            // redirect or update UI
        } else {
            alert(`⚠️ Login failed: ${data.message}`);
        }
    } catch (err) {
        alert(`⚠️ Login failed: ${err.message}`);
    }
});


document.getElementById('registerBtn').addEventListener('click', async () => {
    const fullName = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullName, email, password })
        });

        // Check for the status code 400 specifically
        if (!res.ok) {
            // If the status is 400, handle it as a user already exists error
            if (res.status === 400) {
                const data = await res.json();
                if (data.message.includes('User already exists')) {
                    alert('⚠️ This email is already registered.');
                } else {
                    alert(`⚠️ Registration failed: ${data.message}`);
                }
            } else {
                throw new Error(`Failed to register. Status: ${res.status}`);
            }
            return; // Stop further execution if error occurs
        }

        // Check if the response is JSON
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await res.json();

            if (data.success) {
                alert('✅ Registration successful!');
                document.getElementById('registerContainer').style.display = 'none';
                document.getElementById('loginContainer').style.display = 'block';
            } else {
                alert(`⚠️ Registration failed: ${data.message}`);
            }
        } else {
            throw new Error('Expected JSON response, but received something else.');
        }
    } catch (err) {
        // Handle errors that happen during the fetch operation
        alert(`⚠️ Registration failed: ${err.message}`);
    }
});

document.addEventListener("DOMContentLoaded", function () {
    // LOGIN & REGISTER FORM HANDLING
    const loginTrigger = document.getElementById("loginTrigger");
    const loginContainer = document.getElementById("loginContainer");
    const closeLogin = document.getElementById("closeLogin");
    const showRegister = document.getElementById("showRegister");
    const registerContainer = document.getElementById("registerContainer");
    const backToLogin = document.getElementById("backToLogin");
    const closeRegister = document.getElementById("closeRegister");

    if (loginTrigger) {
        loginTrigger.addEventListener("click", () => {
            loginContainer.style.display = "block";
        });
        closeLogin.addEventListener("click", () => {
            loginContainer.style.display = "none";
        });
        showRegister.addEventListener("click", () => {
            loginContainer.style.display = "none";
            registerContainer.style.display = "block";
        });
        backToLogin.addEventListener("click", () => {
            registerContainer.style.display = "none";
            loginContainer.style.display = "block";
        });
        closeRegister.addEventListener("click", () => {
            registerContainer.style.display = "none";
        });
    }
  });
  
     window.addEventListener("click", function (e) {
    if (
        loginContainer.style.display === "block" &&
        !document.querySelector(".login-box").contains(e.target) &&
        !loginTrigger.contains(e.target)
    ) {
        loginContainer.style.display = "none";
    }

    if (
        registerContainer.style.display === "block" &&
        !document.querySelector(".register-box").contains(e.target) &&
        !showRegister.contains(e.target)
    ) {
        registerContainer.style.display = "none";
    }
});

