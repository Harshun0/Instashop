async function checkUserStatus() {
    try {
        let response = await fetch("/user");
        let data = await response.json();
        let userActionText = document.getElementById("userActionText");

        if (data.loggedIn) {
            userActionText.textContent = "Logout";
            document.getElementById("userButton").onclick = handleLogout;
        } else {
            userActionText.textContent = "Login";
            document.getElementById("userButton").onclick = handleUserClick;
        }
    } catch (error) {
        console.error("Error checking login status", error);
    }
}

async function handleUserClick() {
    window.location.href = "/login";
}

async function handleLogout() {
    window.location.href = "/logout";
}

async function handleCartClick() {
    try {
        const response = await fetch("/user");
        const data = await response.json();
        
        if (data.loggedIn) {
            window.location.href = "/cart.html";
        } else {
            window.location.href = "/login";
        }
    } catch (error) {
        console.error("Error checking login status:", error);
    }
}

async function updateCartCount() {
    try {
        const response = await fetch("/cart");
        const data = await response.json();
        
        const cartCount = document.getElementById("cart-count");
        if (cartCount && data.cart) {
            cartCount.textContent = data.cart.reduce((total, item) => total + item.quantity, 0);
        }
    } catch (error) {
        console.error("Error updating cart count:", error);
    }
}

// Initialize header functionality when page loads
document.addEventListener("DOMContentLoaded", () => {
    checkUserStatus();
    updateCartCount();
}); 