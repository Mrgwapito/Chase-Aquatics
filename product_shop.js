// ✅ Working product detail logic (with add to cart + additional images) — DOMContentLoaded triggered
document.addEventListener('DOMContentLoaded', async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (!productId) {
        alert("Product ID not found.");
        return;
    }

    try {
        const response = await fetch(`/api/product/${productId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch product data.");
        }

        const product = await response.json();

        if (!product || !product._id) {
            alert("Invalid product data.");
            return;
        }

        // Populate product data
        document.getElementById('product-name').textContent = product.name;
        document.getElementById('product-category').textContent = `Category: ${product.category}`;
        document.getElementById('product-price').textContent = `${product.price}`;
        document.getElementById('product-description').textContent = product.description;
        document.getElementById('product-image').src = product.image;

        // Display additional images
        const additionalImagesContainer = document.getElementById('product-additional-images');
        if (additionalImagesContainer && product.additionalImages) {
            additionalImagesContainer.innerHTML = '';
            product.additionalImages.forEach(image => {
                const img = document.createElement('img');
                img.src = image;
                img.alt = `${product.name} additional image`;
                img.classList.add('img-thumbnail');
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.marginRight = '10px';
                additionalImagesContainer.appendChild(img);
            });
        }

        // Setup Add to Cart
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                const qtyInput = document.getElementById('quantity');
                const quantity = parseInt(qtyInput?.value || "1");
                if (!quantity || quantity <= 0) {
                    alert("Please enter a valid quantity.");
                    return;
                }
                addToCart(product, quantity);
            });
        }

        // Load related products
        displayRelatedProducts(product._id);

    } catch (error) {
        console.error(error);
        alert("An error occurred while loading the product.");
    }
});

// ✅ Add to Cart — stores in localStorage
function addToCart(product, quantity) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    // Check if item already in cart
    const existing = cart.find(item => item._id === product._id);
    if (existing) {
        existing.quantity += quantity;  // Update quantity if item already in cart
    } else {
        cart.push({
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity
        });
    }

    // Save updated cart to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));

    // ✅ Log cart state to console for debugging
    console.log('🛒 Cart saved to localStorage:', cart);
    alert(`${product.name} added to cart!`);
    window.location.href = 'product.html';
}

// ✅ Basic fetch version — kept as-is
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

fetch(`/api/product/${productId}`) // Updated endpoint to match the server's route for fetching products by id
    .then(response => response.json())
    .then(product => {
        if (product) {
            document.getElementById('product-name').textContent = product.name;
            document.getElementById('product-category').textContent = `Category: ${product.category}`;
            document.getElementById('product-price').textContent = ` ${product.price}`;
            document.getElementById('product-description').textContent = product.description;
            document.getElementById('product-image').src = product.image;

            const additionalImagesContainer = document.getElementById('product-additional-images');
            if (product.additionalImages) {
                product.additionalImages.forEach(image => {
                    const imgElement = document.createElement('img');
                    imgElement.src = image;
                    imgElement.alt = `Additional image for ${product.name}`;
                    imgElement.classList.add('img-thumbnail');
                    imgElement.style.width = '60px';
                    imgElement.style.height = '60px';
                    imgElement.style.marginRight = '10px';
                    additionalImagesContainer.appendChild(imgElement);
                });
            }

            displayRelatedProducts(product);
            addProductToDatabase(product);
        } else {
            alert('Product not found');
        }
    });

// ✅ Placeholder function
function addProductToDatabase(product) {
    console.log('Product added to database:', product);
}

// ✅ Alternative fetch method — also kept
async function fetchProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        console.error('Product ID is missing in URL');
        return;
    }

    try {
        const res = await fetch(`/api/product/${productId}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const product = await res.json();

        document.getElementById('product-name').textContent = product.name;
        document.getElementById('product-description').textContent = product.description;
        document.getElementById('product-price').textContent = `${product.price}`;

        document.querySelector('.product-detail-section img').src = product.image;

        displayRelatedProducts(productId);

    } catch (error) {
        console.error('Failed to fetch product details:', error);
    }
}

// ✅ Reusable related products function
async function displayRelatedProducts(productId) {
    const relatedProductsContainer = document.getElementById('related-products-container');
    if (!relatedProductsContainer) {
        console.error('related-products-container element not found.');
        return;
    }

    try {
        const res = await fetch(`/api/products/${productId}/related`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const relatedProducts = await res.json();

        relatedProductsContainer.innerHTML = '';

        if (!Array.isArray(relatedProducts) || relatedProducts.length === 0) {
            relatedProductsContainer.innerHTML = '<p>No related products found.</p>';
            return;
        }

        relatedProducts.forEach(product => {
            const productCard = `
                <div class="col-md-3">
                    <div class="product-card">
                        <div class="image-wrapper">
                            <img src="${product.image}" alt="${product.name}" class="img-fluid"/>
                        </div>
                        <h5 class="product-title">${product.name}</h5>
                        <p class="product-price">${product.price}</p>
                        <button class="btn btn-primary" onclick="viewProductDetails('${product._id}')">View Details</button>
                    </div>
                </div>
            `;
            relatedProductsContainer.innerHTML += productCard;
        });

    } catch (error) {
        console.error('Failed to load related products:', error);
    }
}

// ✅ Redirection handler
function viewProductDetails(productId) {
    console.log('Viewing details for product:', productId);
    window.location.href = `/product_shop.html?id=${productId}`;
}

// ✅ Trigger the function (optional because you're already using DOMContentLoaded)
fetchProductDetails();
