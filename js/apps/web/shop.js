// Mega Mall Online: a shop from the early days of buying things on
// the web. Put things in the shopping cart and place an order.
// Nothing costs real money: you "pay cash when it arrives", and it
// never arrives. No card number or address is ever asked for.

import { link } from './common.js';

const SHOP = 'http://www.megamall.web/';
const CART = `${SHOP}cart.html`;

// Every product: a symbol for its "photo", the photo's color, and
// its price in cents
const PRODUCTS = [
  { id: 'floppies', name: '3.5" Floppy Disks (10 pack)', symbol: '▣', color: '#3355cc', price: 999,
    blurb: 'Room for 14 MB of your stuff! Labels included.' },
  { id: 'mousepad', name: 'Dolphin Mouse Pad', symbol: '≋', color: '#1e90c8', price: 499,
    blurb: 'Ocean sunset with leaping dolphins. Very calming.' },
  { id: 'pet', name: 'Pocket Pet', symbol: '◕', color: '#e0508a', price: 1499,
    blurb: 'A pet on your keyring! Feed it, or else.' },
  { id: 'modem', name: '56k Modem', symbol: '☎', color: '#606060', price: 14900,
    blurb: 'Twice as fast as 28.8! Squeals included free.' },
  { id: 'cdrom', name: 'CD-ROM: Encyclopedia of Everything', symbol: '◎', color: '#909090', price: 3995,
    blurb: 'All human knowledge on one shiny disc. Needs 8 MB of RAM.' },
  { id: 'pigeon', name: 'Glow-in-the-Dark Coo Figure', symbol: '♥', color: '#7d8599', price: 250,
    blurb: 'Official fan club merchandise. Glows for up to 4 minutes.' },
  { id: 'cover', name: 'Beige Keyboard Cover', symbol: '⌨', color: '#c8b88a', price: 699,
    blurb: 'Keeps crumbs out. Matches your computer perfectly.' },
  { id: 'wipes', name: 'Anti-Static Screen Wipes', symbol: '✦', color: '#40a0a0', price: 349,
    blurb: 'For that crackle-free, just-dusted CRT look.' },
];

// The cart lasts as long as ANACHRON is on: { productId: count }
const cart = {};

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const cartCount = () => Object.values(cart).reduce((sum, count) => sum + count, 0);
const cartTotal = () => PRODUCTS.reduce((sum, p) => sum + (cart[p.id] ?? 0) * p.price, 0);

function header() {
  return `
    <div class="web-mall-header">
      <span class="web-mall-logo">MEGA<b>MALL</b> online</span>
      <span>${link(SHOP, 'Shop')} | ${link(CART, 'Shopping Cart')} (<span data-cart-count>${cartCount()}</span>)</span>
    </div>`;
}

function photo(product) {
  return `<span class="web-mall-photo" style="background:${product.color}">${product.symbol}</span>`;
}

const front = {
  title: 'Mega Mall Online',
  keywords: 'mega mall online shop shopping store buy cart floppy disks modem mouse pad pocket pet',
  render: () => `
    <div class="web-page web-mall">
      ${header()}
      <p class="web-center"><b>The biggest store on the Information Superhighway!</b><br>
        <span class="web-small">Secure shopping. Delivery in 6 to 8 weeks.</span></p>
      <div class="web-mall-grid">
        ${PRODUCTS.map((p) => `
          <div class="web-mall-item">
            ${photo(p)}
            <b>${p.name}</b>
            <span class="web-small">${p.blurb}</span>
            <span class="web-mall-price">${money(p.price)}</span>
            <button class="push-button" data-add="${p.id}">Add to Cart</button>
          </div>`).join('')}
      </div>
      <p class="web-center web-small web-mall-note"></p>
    </div>`,
  setUp: (root) => {
    const note = root.querySelector('.web-mall-note');
    root.querySelector('.web-mall-grid').addEventListener('click', (event) => {
      const button = event.target.closest('[data-add]');
      if (!button) return;
      const product = PRODUCTS.find((p) => p.id === button.dataset.add);
      cart[product.id] = (cart[product.id] ?? 0) + 1;
      root.querySelector('[data-cart-count]').textContent = cartCount();
      note.textContent = `${product.name} was added to your cart.`;
    });
  },
};

const cartPage = {
  title: 'Your Shopping Cart - Mega Mall Online',
  keywords: 'mega mall shopping cart checkout order',
  render: () => {
    const items = PRODUCTS.filter((p) => cart[p.id]);
    return `
      <div class="web-page web-mall">
        ${header()}
        <h1>Your Shopping Cart</h1>
        ${items.length === 0 ? `
          <p>Your cart is empty. Why not ${link(SHOP, 'go shopping')}?</p>` : `
          <table class="web-table web-mall-cart">
            <tr><th>Item</th><th>Price</th><th>How many</th><th>Total</th><th></th></tr>
            ${items.map((p) => `
              <tr>
                <td>${p.name}</td><td>${money(p.price)}</td><td>${cart[p.id]}</td>
                <td>${money(p.price * cart[p.id])}</td>
                <td><button class="push-button" data-remove="${p.id}">Remove</button></td>
              </tr>`).join('')}
            <tr><td colspan="3"><b>Grand total</b></td><td colspan="2"><b>${money(cartTotal())}</b></td></tr>
          </table>
          <p class="web-center">Payment: cash when your order arrives. No credit card needed!</p>
          <p class="web-center"><button class="push-button" data-order>Place Order</button></p>`}
        <div class="web-mall-done"></div>
      </div>`;
  },
  setUp: (root, browser) => {
    // Listen on the page itself, not root: root stays when we leave
    root.querySelector('.web-mall').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        delete cart[remove.dataset.remove];
        browser.go(CART);
      }

      if (event.target.closest('[data-order]')) {
        const total = money(cartTotal());
        const number = 10000 + Math.floor(Math.random() * 90000);
        for (const id of Object.keys(cart)) delete cart[id];

        root.querySelector('.web-mall-cart').remove();
        for (const p of root.querySelectorAll('.web-center')) p.remove();
        root.querySelector('[data-cart-count]').textContent = '0';
        root.querySelector('.web-mall-done').innerHTML = `
          <h2>Thank you for your order!</h2>
          <p>Your order number is <b>${number}</b>. Please have <b>${total}</b> ready
             when it arrives in 6 to 8 weeks (or so).</p>
          <p>${link(SHOP, 'Keep shopping')}</p>`;
      }
    });
  },
};

export const SITE = {
  'www.megamall.web': { '/': front, '/cart.html': cartPage },
};
