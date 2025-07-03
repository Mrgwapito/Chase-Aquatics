// cartModal.js

async function addToCart(product, quantity = 1) {
    const userId = localStorage.getItem('userId') || '12345';

    if (!userId) {
        alert("User not logged in.");
        return;
    }

    if (quantity <= 0) {
        alert("Invalid quantity.");
        return;
    }

    try {
        const response = await fetch('/api/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, productId: product._id, quantity })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert(`${product.name} added to cart.`);
        } else {
            alert("Failed to add to cart.");
        }
    } catch (err) {
        console.error("Cart error:", err);
        alert("Error adding to cart.");
    }
}
