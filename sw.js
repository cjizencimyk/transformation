// Transformation : fonctionne hors ligne. Version 6e976e6c32
const VERSION = 'tf-6e976e6c32';
const CORE = ["./", "index.html", "app.js", "data.js", "anim.js", "foods.js", "icons.js", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "favicon-64.png", "icon.svg", "vendor/zxing.min.js", "fonts/lexend-latin-400-normal.woff2", "fonts/lexend-latin-500-normal.woff2", "fonts/lexend-latin-600-normal.woff2", "fonts/lexend-latin-700-normal.woff2", "fonts/lexend-latin-800-normal.woff2", "fonts/unbounded-latin-600-normal.woff2", "fonts/unbounded-latin-700-normal.woff2", "fonts/unbounded-latin-800-normal.woff2", "em/1st_place_medal.webp", "em/avocado.webp", "em/baguette_bread.webp", "em/balance_scale.webp", "em/banana.webp", "em/beer_mug.webp", "em/bento_box.webp", "em/bowl_with_spoon.webp", "em/bread.webp", "em/broccoli.webp", "em/bullseye.webp", "em/burrito.webp", "em/butter.webp", "em/camera_with_flash.webp", "em/canned_food.webp", "em/carrot.webp", "em/chart_increasing.webp", "em/cheese_wedge.webp", "em/chocolate_bar.webp", "em/clipboard.webp", "em/collision.webp", "em/cooked_rice.webp", "em/cookie.webp", "em/crescent_moon.webp", "em/croissant.webp", "em/cucumber.webp", "em/cup_with_straw.webp", "em/custard.webp", "em/cut_of_meat.webp", "em/doughnut.webp", "em/droplet.webp", "em/egg.webp", "em/falafel.webp", "em/fire.webp", "em/fish.webp", "em/flexed_biceps.webp", "em/fork_and_knife_with_plate.webp", "em/gem_stone.webp", "em/glass_of_milk.webp", "em/glowing_star.webp", "em/grapes.webp", "em/green_salad.webp", "em/hamburger.webp", "em/high_voltage.webp", "em/hot_beverage.webp", "em/hourglass_done.webp", "em/hundred_points.webp", "em/ice_cream.webp", "em/leafy_green.webp", "em/lollipop.webp", "em/mantelpiece_clock.webp", "em/pancakes.webp", "em/party_popper.webp", "em/peanuts.webp", "em/pear.webp", "em/person_lifting_weights.webp", "em/person_rowing_boat.webp", "em/person_running.webp", "em/pizza.webp", "em/popcorn.webp", "em/potato.webp", "em/poultry_leg.webp", "em/red_apple.webp", "em/rocket.webp", "em/sandwich.webp", "em/shallow_pan_of_food.webp", "em/shortcake.webp", "em/shrimp.webp", "em/sleeping_face.webp", "em/spaghetti.webp", "em/sparkles.webp", "em/spiral_calendar.webp", "em/sports_medal.webp", "em/star.webp", "em/steaming_bowl.webp", "em/stopwatch.webp", "em/strawberry.webp", "em/stuffed_flatbread.webp", "em/sun.webp", "em/sunrise.webp", "em/sushi.webp", "em/taco.webp", "em/tangerine.webp", "em/tomato.webp", "em/trophy.webp", "em/wine_glass.webp"];
const BIG = ['products.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => caches.open(VERSION).then((c) => Promise.all(BIG.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {})))))));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }))));
});
