// After successful payment or COD order placement
function handleOrderSuccess(orderId) {
    // Clear cart
    clearCart();
    
    // Redirect to orders page
    window.location.href = `/order?success=true&orderId=${orderId}`;
} 