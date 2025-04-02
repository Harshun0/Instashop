async function loadProducts(category) {
    try {
        let queryString = `category=${category}`;
        
        // Fetch products from API
        const response = await fetch(`/api/products?${queryString}`);
        const products = await response.json();
        
        if (!Array.isArray(products)) {
            throw new Error("Invalid response format");
        }

        console.log(`✅ Loaded ${products.length} products for ${category}`);

        // Call function to display products on the page
        displayProducts(products);
        
    } catch (error) {
        console.error("❌ Error loading products:", error);
        document.getElementById("product-list").innerHTML = `<p class="text-red-500">Error loading products.</p>`;
    }
}

function displayProducts(products) {
    const productList = document.getElementById("product-list");
    productList.innerHTML = "";

    if (products.length === 0) {
        productList.innerHTML = `<p class="text-gray-600">No products found.</p>`;
        return;
    }

    products.forEach(product => {
        const productCard = `
            <div class="product-card">
                <img src="${product.images[0]}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>₹${product.price}</p>
                <button>Add to Cart</button>
            </div>
        `;
        productList.innerHTML += productCard;
    });
}
