// Seeds sample categories, products and offers into the LOCAL development database.
// Safe to re-run: products are upserted by slug, offers by promo code.
//
// Usage: node scripts/seed-local-data.mjs
//
// Photos in public/assets/menu-photos/ are from Unsplash (free to use under the Unsplash License).
//
// Refuses to run unless DATABASE_URL / PGHOST points at localhost, so it can
// never write sample data into the production VPS database.

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
const host = connectionString ? new URL(connectionString).hostname : process.env.PGHOST
const port = connectionString ? new URL(connectionString).port : process.env.PGPORT

if (!['127.0.0.1', 'localhost', '::1'].includes(host) || String(port) === '55432') {
  console.error(`Refusing to seed: database ${host}:${port} is not the local development database.`)
  process.exit(1)
}

const pool = new pg.Pool(connectionString ? { connectionString } : undefined)

const categories = [
  ['Signature', 1], ['Rice Specials', 2], ['Burgers', 3], ['Wraps', 4], ['Street Grill', 5],
  ['Milkshake', 10], ['Berry Special', 11], ['Chocolate', 12], ['Mojito', 13], ['Iced Coffee', 14], ['Hot Drinks', 15],
]

// [slug, name, category, kind, price, image, accent, description, ingredients, serving, spice, dietary, dairy, featured, isNew]
const products = [
  ['zen-panda-welcome', 'Zen Panda Welcome', 'Signature', 'food', 1850, '/assets/menu-photos/zen-panda-welcome.jpg', '#a32722',
    'The visual signature of Zen Kitchen — a chef’s welcome platter of seasonal bites.', 'Seasonal vegetables, house dips, toasted bread', 'Sharing platter · 2 people', 'none', 'veg', null, true, false],
  ['samurai-feast-rice', 'Samurai Feast Rice', 'Rice Specials', 'food', 1650, '/assets/menu-photos/samurai-feast-rice.jpg', '#b14d2b',
    'A generous spiced rice platter with roasted chicken, herbs and garnish.', 'Seasoned rice, roasted chicken, herbs, cashews, house garnish', 'Main course · hearty serving', 'medium', 'non-veg', null, true, false],
  ['zen-veg-fried-rice', 'Zen Garden Fried Rice', 'Rice Specials', 'food', 1150, '/assets/menu-photos/zen-veg-fried-rice.jpg', '#5f8a3a',
    'Wok-tossed rice with crisp garden vegetables, egg-free and lightly spiced.', 'Rice, carrot, leeks, beans, spring onion, soy', 'Main course', 'mild', 'veg', null, false, true],
  ['black-armor-burger', 'Black Armor Burger Set', 'Burgers', 'food', 1950, '/assets/menu-photos/black-armor-burger.jpg', '#7f2d19',
    'A full double burger and fries set with a premium café presentation.', 'Burger bun, double filling, cheese, vegetables, fries, house dip', 'Main course · served with fries', 'mild', 'non-veg', null, true, false],
  ['crispy-chicken-burger', 'Crispy Ninja Chicken Burger', 'Burgers', 'food', 1450, '/assets/menu-photos/crispy-chicken-burger.jpg', '#a3501f',
    'Crunchy fried chicken fillet, slaw and spicy mayo in a toasted brioche bun.', 'Chicken fillet, brioche, slaw, spicy mayo', 'Served with fries', 'medium', 'non-veg', null, false, true],
  ['warrior-fire-wraps', 'Warrior Fire Wraps', 'Wraps', 'food', 1250, '/assets/menu-photos/warrior-fire-wraps.jpg', '#9f241f',
    'Hot stuffed wraps with smoky filling, fresh herbs and sauce.', 'Flatbread, seasoned filling, fresh herbs, vegetables, house sauce', 'Street-food style · warm', 'hot', 'non-veg', null, true, false],
  ['paneer-tikka-wrap', 'Paneer Tikka Wrap', 'Wraps', 'food', 1100, '/assets/menu-photos/paneer-tikka-wrap.jpg', '#c06a2b',
    'Charred paneer tikka with onions, mint chutney and crunchy salad.', 'Paneer, flatbread, onion, mint chutney, salad', 'Warm wrap', 'medium', 'veg', null, false, false],
  ['zen-street-dogs', 'Zen Street Dogs', 'Street Grill', 'food', 950, '/assets/menu-photos/zen-street-dogs.jpg', '#a33f1f',
    'Grilled hot dogs with layered sauces and dips in a playful Zen Kitchen presentation.', 'Grilled sausage, bun, fresh garnish, house sauces', 'Grill favourite · served warm', 'mild', 'non-veg', null, true, false],
  ['zen-strawberry-cloud', 'Zen Strawberry Cloud', 'Milkshake', 'drink', 850, '/assets/menu-photos/zen-strawberry-cloud.jpg', '#c43b5b',
    'A creamy strawberry signature drink with a bright fruit finish.', 'Strawberry, chilled milk, cream, house syrup', 'Served chilled', null, null, 'milk', true, false],
  ['zen-berry-bliss', 'Zen Berry Bliss', 'Berry Special', 'drink', 950, '/assets/menu-photos/zen-berry-bliss.jpg', '#7a55c5',
    'A smooth purple berry shake with a bold, refreshing fruit profile.', 'Mixed berries, chilled milk, cream, house syrup', 'Served chilled', null, null, 'milk', true, false],
  ['zen-choco-armor', 'Zen Choco Armor', 'Chocolate', 'drink', 900, '/assets/menu-photos/zen-choco-armor.jpg', '#8c5a42',
    'A rich chocolate milkshake layered with cream and a deep café-style finish.', 'Chocolate, chilled milk, cream, cocoa drizzle', 'Served chilled', null, null, 'milk-powder', true, false],
  ['zen-citrus-mojito', 'Zen Citrus Mojito', 'Mojito', 'drink', 750, '/assets/menu-photos/zen-citrus-mojito.jpg', '#4a9a68',
    'A cool citrus mojito with mint and lemon for a light, sparkling finish.', 'Lemon, mint, soda, citrus syrup, ice', 'Served over ice · non-alcoholic', null, null, 'dairy-free', true, false],
  ['zen-iced-brew', 'Zen Iced Brew', 'Iced Coffee', 'drink', 800, '/assets/menu-photos/zen-iced-brew.jpg', '#976544',
    'A chilled coffee creation with a soft premium finish and mellow café aroma.', 'Coffee, chilled milk, ice, house sweetener', 'Served chilled', null, null, 'milk', true, false],
  ['zen-mango-tango', 'Zen Mango Tango', 'Milkshake', 'drink', 850, '/assets/menu-photos/zen-mango-tango.jpg', '#e0942a',
    'Jaffna mango blended thick with cream and a hint of cardamom.', 'Mango, chilled milk, cream, cardamom', 'Served chilled', null, null, 'milk', false, true],
  ['zen-blue-lagoon', 'Zen Blue Lagoon', 'Mojito', 'drink', 800, '/assets/menu-photos/zen-blue-lagoon.jpg', '#2f7fb8',
    'Blue curaçao-style syrup, lime and soda — a bright party-room favourite.', 'Blue syrup, lime, mint, soda, ice', 'Served over ice · non-alcoholic', null, null, 'dairy-free', false, true],
  ['zen-masala-tea', 'Zen Masala Tea', 'Hot Drinks', 'drink', 350, '/assets/menu-photos/zen-masala-tea.jpg', '#9b6a3c',
    'Ceylon tea simmered with ginger, cardamom and cinnamon.', 'Ceylon tea, milk, ginger, cardamom, cinnamon', 'Served hot', null, null, 'milk', false, false],
]

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

// [code, title, description, discountType, discountValue, startsAt, endsAt, active, image]
const offers = [
  ['ZENWELCOME', 'Welcome to Zen', 'First visit? Enjoy 15% off your whole bill.', 'percentage', 15, day(-7), day(60), true, '/assets/menu-photos/offer-welcome.jpg'],
  ['SHAKE2', 'Shake Duo Tuesday', 'Any two milkshakes for a flat LKR 300 off, every Tuesday.', 'fixed', 300, day(-3), day(45), true, '/assets/menu-photos/zen-strawberry-cloud.jpg'],
  ['PARTY10', 'Party Room Special', 'Book the private party room for 10+ guests and get 10% off food.', 'percentage', 10, day(0), day(90), true, '/assets/menu-photos/offer-party-room.jpg'],
  ['BURGER500', 'Black Armor Burger Deal', 'LKR 500 off the Black Armor Burger Set this weekend.', 'fixed', 500, day(1), day(14), true, '/assets/menu-photos/black-armor-burger.jpg'],
  ['MONSOON20', 'Monsoon Comfort (ended)', 'Last season’s rainy-day 20% off hot drinks.', 'percentage', 20, day(-60), day(-10), false, '/assets/menu-photos/zen-masala-tea.jpg'],
]

const client = await pool.connect()
try {
  await client.query('BEGIN')

  const categoryIds = {}
  for (const [name, sort] of categories) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const res = await client.query(
      `INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = NOW()
       RETURNING id`,
      [name, slug, sort]
    )
    categoryIds[name] = res.rows[0].id
  }

  let sort = 0
  for (const [slug, name, cat, kind, price, image, accent, description, ingredients, serving, spice, dietary, dairy, featured, isNew] of products) {
    await client.query(
      `INSERT INTO products (category_id, name, slug, description, price, image_url, is_available, is_featured, sort_order,
                             kind, ingredients, serving, accent, is_new, spice_level, dietary_type, dairy_type)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (slug) DO UPDATE SET
         category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description,
         price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_featured = EXCLUDED.is_featured,
         sort_order = EXCLUDED.sort_order, kind = EXCLUDED.kind, ingredients = EXCLUDED.ingredients,
         serving = EXCLUDED.serving, accent = EXCLUDED.accent, is_new = EXCLUDED.is_new,
         spice_level = EXCLUDED.spice_level, dietary_type = EXCLUDED.dietary_type,
         dairy_type = EXCLUDED.dairy_type, updated_at = NOW()`,
      [categoryIds[cat], name, slug, description, price, image, featured, sort++, kind, ingredients, serving, accent, isNew, spice, dietary, dairy]
    )
  }

  for (const [code, title, description, type, value, startsAt, endsAt, active, image] of offers) {
    await client.query('DELETE FROM offers WHERE code = $1', [code])
    await client.query(
      `INSERT INTO offers (title, description, image_url, discount_type, discount_value, starts_at, ends_at, is_active, code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [title, description, image, type, value, startsAt, endsAt, active, code]
    )
  }

  await client.query('COMMIT')
  const counts = await client.query(
    'SELECT (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM offers) AS offers'
  )
  console.log('Seeded local database:', counts.rows[0])
} catch (err) {
  await client.query('ROLLBACK')
  console.error('Seed failed:', err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
