document.addEventListener('DOMContentLoaded', function () {
    const cartButton = document.getElementById('cart-btn');
    const cartPopup = document.querySelector('.cart-popup');
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    const clearCartButton = document.querySelector('.clear-cart-btn');
    const cartItemsContainer = cartPopup.querySelector('.cart-items');

    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    // 🔹 Add to cart
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function () {
            let name, price, image, description = 'No description available', id;

            const product = button.closest('.product-card');
            if (product) {
                name = product.querySelector('h3')?.textContent?.trim();
                price = product.querySelector('p')?.textContent?.trim();
                image = product.querySelector('img')?.src || 'placeholder.jpg';
                description = product.querySelector('.product-description')?.textContent?.trim() || 'No description available';
                id = product.getAttribute('data-category') || name; // fallback to name if no ID
            } else {
                // Standalone button
                name = button.getAttribute('data-name')?.trim();
                price = button.getAttribute('data-price')?.trim();
                image = button.getAttribute('data-image') || 'placeholder.jpg';
                id = button.getAttribute('data-id') || name; // fallback to name
            }

            // 🚫 Skip if missing any crucial info
            if (!name || !price || !image) {
                console.warn('Skipping item due to missing info:', { name, price, image });
                return;
            }

            // Check if item already in cart
            const existingItem = cart.find(item => item.id === id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({
                    id,
                    name,
                    price,
                    description,
                    image,
                    quantity: 1
                });
            }

            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartPopup();
            alert(`${name} added to cart.`);
        });
    });

  // 🔹 Update cart popup
function updateCartPopup() {
    cartItemsContainer.innerHTML = '';

    if (!cart.length) {
        cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
        return;
    }

    cart.forEach((item, index) => {
        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');
        cartItem.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="item-info">
                <h4>${item.name}</h4>
                <p>${item.price}</p>
            </div>
            <div class="item-controls">
                <button class="qty-btn" data-index="${index}" data-action="decrease">-</button>
                <span class="qty">${item.quantity}</span>
                <button class="qty-btn" data-index="${index}" data-action="increase">+</button>
                <button class="remove-btn" data-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    // Event listeners for quantity and remove buttons remain unchanged
    cartItemsContainer.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const index = this.getAttribute('data-index');
            const action = this.getAttribute('data-action');
            if (action === 'increase') {
                cart[index].quantity += 1;
            } else if (action === 'decrease' && cart[index].quantity > 1) {
                cart[index].quantity -= 1;
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartPopup();
        });
    });

    cartItemsContainer.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const index = this.getAttribute('data-index');
            cart.splice(index, 1);
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartPopup();
        });
    });
}


    // 🔹 Toggle cart popup
    cartButton?.addEventListener('click', function () {
        cartPopup.style.display = cartPopup.style.display === 'block' ? 'none' : 'block';
    });

    // 🔹 Clear cart
    clearCartButton?.addEventListener('click', function () {
        cart = [];
        localStorage.removeItem('cart');
        updateCartPopup();
        alert('Cart has been cleared.');
    });

    // 🔹 Load cart on page load
    updateCartPopup();

        window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            cartPopup.classList.add('fixed');
        } else {
            cartPopup.classList.remove('fixed');
        }
    });
    
});


