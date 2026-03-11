import { createContext, type ReactNode, useContext, useState } from 'react';
import { type Product } from '../types';

export interface CartItem extends Product {
  cartQuantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string | undefined) => void
  clearCart: () => void;
  cartTotal: number;
}

export const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      // Check if item is already in cart
      const existingItem = prevCart.find(
        (item) => (item.id || item.productId) === (product.id || product.productId),
      );

      if (existingItem) {
        // Increase quantity
        return prevCart.map((item) =>
          (item.id || item.productId) === (product.id || product.productId)
            ? { ...item, cartQuantity: item.cartQuantity + 1 }
            : item,
        );
      }
      // Add new item
      return [...prevCart, { ...product, cartQuantity: 1 }];
    });
  };

  const removeFromCart = (productId: string | undefined) => {
    if(!productId) return;

    setCart((prevCart) => {
      const existingItem = prevCart.find(item => (item.id || item.productId) === productId);

      if (existingItem?.cartQuantity === 1) {
                // If there's only 1 left, remove it from the array entirely
                return prevCart.filter(item => (item.id || item.productId) !== productId);
            }

            // Otherwise, just decrease the quantity by 1
            return prevCart.map(item =>
                (item.id || item.productId) === productId
                    ? { ...item, cartQuantity: item.cartQuantity - 1 }
                    : item
            );
    })
  }

  const clearCart = () => setCart([]);

  // Calculate total price of everything in the cart
  const cartTotal = cart.reduce((total, item) => total + item.price * item.cartQuantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
